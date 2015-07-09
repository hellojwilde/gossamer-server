const fetchGitHubArchive = require('../helpers/fetchGitHubArchive');
const fetchNodePackages = require('../helpers/fetchNodePackages');
const objectHash = require('json-hash');

const BucketFileSystem = require('../models/BucketFileSystem');
const GitHub = require('github');
const Promise = require('bluebird');

const github = new GitHub({version: '3.0.0'});
const fetchGithubArchiveLink = Promise.promisify(github.repos.getArchiveLink);
const fetchGithubBranch = Promise.promisify(github.repos.getBranch);

const ShipOverlays = [
  {
    filePath: 'package.json',
    getOverlays: async function({buffer}) {
      console.log(buffer.toString());

      let configObject = JSON.parse(buffer.toString());

      let {dependencies} = configObject;
      let depHash = objectHash.digest(dependencies);
      let depBucketId = ['npm', depHash].join('/');
      let depBucketExists = await this.models.bucket.bucketExists(depBucketId);

      if (!depBucketExists) {
        await fetchNodePackages(
          configObject,
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

  // fetch information from github about the thing that we're building:
  // - the place where we can download a full copy of the tree, and
  // - the specific commit that we're shipping, for the author's reference.
  // 
  // note: it's actually possible in certain race conditions to have the archive
  // to be of a different commit from the commit information we pull down, 
  // so we don't use that commit data for anything important.
  
  let [owner, repo, ref] = branchId.split(':');

  github.authenticate({type:'oauth', key: this.config.githubClientId, secret: this.config.githubClientSecret});
  let [archive] = await Promise.all([
    fetchGithubArchiveLink({
      user: owner,
      repo: repo,
      ref: ref,
      archive_format: 'tarball'
    }),
    // fetchGithubBranch({
    //   user: owner,
    //   repo: repo,
    //   branch: ref
    // })
  ]);

  let latestBuildId = await this.models.branch.getLatestBuildId(branchId);
  let buildId = latestBuildId + 1;
  let bucketId = this.models.branch.getBuildBucketId(branchId, buildId);
  let bucketFileSystem = new BucketFileSystem(this.models.bucket, bucketId);

  await fetchGitHubArchive(archive.meta.location, bucketFileSystem);

  // generate and merge overlays; an overlay is a series of symlinks that we
  // output when we find certain files (like build scripts).
  
  let overlayArray = await Promise.map(ShipOverlays, async (trigger) => {
    let {filePath, getOverlays} = trigger;
    let exists = await this.models.bucket.exists(bucketId, filePath);

    if (exists) {
      let file = await this.models.bucket.get(bucketId, filePath);
      return await getOverlays.call(this, file);
    }

    return null;
  });

  let overlays = Object.assign({}, ...overlayArray);

  await this.models.branch.putBuild(branchId, buildId, null, overlays);
  await this.models.branch.delLock(branchId);
}

module.exports = {
  enqueueShip,
  ship
};
