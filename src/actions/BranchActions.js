const BucketFileSystem = require('../models/BucketFileSystem');
const CompositeBucketFileSystem = require('../models/CompositeBucketFileSystem');
const GitHub = require('github');
const Promise = require('bluebird');
const Stats = require('webpack/lib/Stats');

const fetchGitHubArchive = require('../helpers/fetchGitHubArchive');
const fetchNodePackages = require('../helpers/fetchNodePackages');
const getWebpackConfig = require('../helpers/getWebpackConfig');
const getWebpackTimestamps = require('../helpers/getWebpackTimestamps');
const objectHash = require('json-hash');
const now = require('performance-now');
const merge = require('lodash.merge');
const webpackAsync = require('../helpers/webpackAsync');
const util = require('util');

const github = new GitHub({version: '3.0.0'});
const fetchGithubArchiveLink = Promise.promisify(github.repos.getArchiveLink);
const fetchGithubBranch = Promise.promisify(github.repos.getBranch);

const ShipInternalSteps = [
  // fetch information from github about the thing that we're building:
  // - the place where we can download a full copy of the tree, and
  // - the specific commit that we're shipping, for the author's reference.
  // 
  // note: it's actually possible in certain race conditions to have the archive
  // to be of a different commit from the commit information we pull down, 
  // so we don't use that commit data for anything important.

  {
    name: 'fetchBranchMetadata',
    action: async function({branchId}) {
      const [owner, repo, ref] = branchId.split(':');
      const [archive, {commit}] = await Promise.all([
        () => fetchGithubArchiveLink({
          user: owner,
          repo: repo,
          ref: ref,
          archive_format: 'tarball'
        }),
        () => fetchGithubBranch({
          user: owner,
          repo: repo,
          branch: ref
        })
      ].map((fetcher) => {
        // in order to get a reasonable API rate limit, we have to authenticate
        github.authenticate({
          type:'oauth', 
          key: this.config.githubClientId, 
          secret: this.config.githubClientSecret
        });
        return fetcher();
      }));

      return {
        archiveUrl: archive.meta.location,
        commit: {
          sha: commit.sha,
          message: commit.commit.message,
          html_url: commit.html_url
        }
      };
    }
  },

  // fetch the files for the github branch and dump them into a bucket
  // if we're rebuilding, the bucket is cached by the sha1 hash

  {
    name: 'fetchBranch',
    action: async function({archiveUrl, branchId, commit}) {
      const bucketId = ['github', branchId, commit.sha].join('/');
      const bucketIdExists = await this.models.bucket.exists(bucketId);

      if (!bucketIdExists) {
        await fetchGitHubArchive(
          archiveUrl,
          new BucketFileSystem(this.models.bucket, bucketId)
        );
      }

      return {buckets: [{folder: null, bucketId: bucketId}]};
    }
  },

  // fetch the node modules that this depends on

  {
    name: 'fetchNodePackages',
    action: async function(context, fileSystem) {
      const buffer = await fileSystem.readFile('package.json');

      const {dependencies, devDependencies} = JSON.parse(buffer.toString());
      const hash = objectHash.digest({dependencies, devDependencies});
      const bucketId = ['npm', hash].join('/');
      const bucketIdExists = await this.models.bucket.exists(bucketId);

      if (!bucketIdExists) {
        await fetchNodePackages(
          buffer,
          new BucketFileSystem(this.models.bucket, bucketId)
        );
      }

      return {buckets: [{folder: 'node_modules', bucketId: bucketId}]};
    }
  },

  // run webpack on the resulting files
  // 
  // we don't currently have a way to cache webpack results--there's a lot of 
  // work to be done here on making webpack a lot faster.
  
  {
    name: 'webpack',
    action: async function(context, fileSystem, prevContext) {
      const buffer = await fileSystem.readFile('webpack.config.js');
      const bucketId = 'webpack';
      const bucketFolder = {folder: '.build', bucketId: bucketId};
      const bucketsWithWebpack = context.buckets.concat(bucketFolder);

      // diff the previous build of the application with the current version
      // and generate file timestamps accordingly.

      const getCompositeBucketDigests = async (buckets) => {
        let maps = await Promise.map(
          buckets,
          ({bucketId}) => this.models.bucket.getAllFileDigests(bucketId)
        );
        return Object.assign({}, ...maps);
      }

      let fileTimestamps = {};

      if (prevContext.buckets && prevContext.buckets.length > 0) {
        let [prevMap, map] = await Promise.all([
          getCompositeBucketDigests(prevContext.buckets),
          getCompositeBucketDigests(bucketsWithWebpack)
        ]);

        fileTimestamps = getWebpackTimestamps(prevMap, map);
      }

      const webpack = await webpackAsync(
        this.dir,
        new CompositeBucketFileSystem(this.models.bucket, bucketsWithWebpack), 
        new BucketFileSystem(this.models.bucket, bucketId),
        getWebpackConfig(buffer),
        fileTimestamps
      );

      console.log(webpack.toString({modules: false, chunks: false}));

      return {buckets: [bucketFolder], webpackJson: webpack.toJson()};
    }
  }
];

async function enqueueShip(branchId) {
  let didGetLock = await this.models.branch.putLock(branchId);
  if (didGetLock !== null) {
    await this.models.branch.putLockStatus(branchId, 'Queued');
    this.queue.publish('build-queue', {branchId: branchId});
  }
}

async function ship(branchId) {
  await this.models.branch.putLockStatus(branchId, 'Shipping');

  let context = {branchId: branchId, buckets: [], performance: []};
  let prevContext = await this.models.branch.getLatestBuild(branchId);
  prevContext = prevContext || {};

  await Promise.each(ShipInternalSteps, async ({name, action}) => {
    console.log('Step: ' + name);

    const start = now();
    const fileSystem = new CompositeBucketFileSystem(this.models.bucket, context.buckets);
    const newContext = await action.call(this, context, fileSystem, prevContext);
    const newContextWithPerf = Object.assign({}, newContext, {
      performance: [{name: name, time: now() - start}]
    });

    merge(context, newContextWithPerf, (a, b) => {
      if (Array.isArray(a)) {
        return a.concat(b);
      }
    });
  });

  await this.models.branch.putBuild(branchId, context);
  await this.models.branch.delLock(branchId);
}

module.exports = {
  enqueueShip,
  ship
};
