const BucketFileSystem = require('../models/BucketFileSystem');
const GitHub = require('github');
const Promise = require('bluebird');

const fetchGitHubArchive = require('../helpers/fetchGitHubArchive');
const fetchNodePackages = require('../helpers/fetchNodePackages');
const objectHash = require('json-hash');
const now = require('performance-now');

const github = new GitHub({version: '3.0.0'});
const fetchGithubArchiveLink = Promise.promisify(github.repos.getArchiveLink);
const fetchGithubBranch = Promise.promisify(github.repos.getBranch);

const ShipOverlays = [
  {
    filePath: 'package.json',
    getOverlays: async function({buffer}) {
      let {dependencies} = JSON.parse(buffer.toString());;
      let depHash = objectHash.digest(dependencies);
      let depBucketId = ['npm', depHash].join('/');
      let depBucketExists = await this.models.bucket.bucketExists(depBucketId);

      if (!depBucketExists) {
        await fetchNodePackages(
          buffer,
          new BucketFileSystem(this.models.bucket, depBucketId)
        );
      }

      return {'node_modules': depBucketId};
    }
  },
  {
    filePath: 'webpack.config.js',
    getOverlays: async function(file) {
      return;
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

  const start = now();

  // fetch information from github about the thing that we're building:
  // - the place where we can download a full copy of the tree, and
  // - the specific commit that we're shipping, for the author's reference.
  // 
  // note: it's actually possible in certain race conditions to have the archive
  // to be of a different commit from the commit information we pull down, 
  // so we don't use that commit data for anything important.
  
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

  const latestBuildId = await this.models.branch.getLatestBuildId(branchId);
  const buildId = latestBuildId + 1;
  const bucketId = this.models.branch.getBuildBucketId(branchId, buildId);
  const bucketFileSystem = new BucketFileSystem(this.models.bucket, bucketId);

  await fetchGitHubArchive(archive.meta.location, bucketFileSystem);

  // generate and merge overlays; an overlay is a series of symlinks that we
  // output when we find certain files (like build scripts).
  
  const overlayArray = await Promise.map(ShipOverlays, async (trigger) => {
    let {filePath, getOverlays} = trigger;
    let exists = await this.models.bucket.exists(bucketId, filePath);

    if (exists) {
      let file = await this.models.bucket.get(bucketId, filePath);
      return await getOverlays.call(this, file);
    }

    return null;
  });

  await this.models.branch.putBuild(
    branchId, 
    buildId, 
    {sha: commit.sha, message: commit.commit.message, html_url: commit.html_url},
    Object.assign({}, ...overlayArray),
    ((now() - start) / 1000).toFixed(2)
  );

  await this.models.branch.delLock(branchId);
}

module.exports = {
  enqueueShip,
  ship
};
