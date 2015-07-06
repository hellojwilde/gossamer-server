const fetchGitHubArchive = require('../helpers/fetchGitHubArchive');
const fetchNodePackages = require('../helpers/fetchNodePackages');

let GitHub = require('github');
let Promise = require('bluebird');

const ShipTransformers = {
  'main.js': function(buffer, options) {
    return buffer.toString().replace(
      '{/* INJECTED_UPDATER_INFO */}',
      JSON.stringify({
        latestBuildIdUrl: options.config.publicUrl + '/api/v1/my/latest',
        buildId: options.build.join('/')
      })
    );
  }
};

const ShipGenerators = {
  'package.json': function(file, options) {
    return Promise.resolve(file.buffer);
  },

  'webpack.config.js': function(file, options) {
    return Promise.resolve(file.buffer);
  }
};

async function enqueueShip(branchId) {
  let didGetLock = await this.models.branch.putLock(branchId);
  if (didGetLock !== null) {
    await this.models.branch.putLockStatus(branchId, 'Queued');
    this.queue.publish('build-queue', {branchId: branchId});
  }
}

async function ship(branchId) {
  // put a note on the lock that we're shipping the build now.
  await this.models.branch.putLockStatus(branchId, 'Shipping');

  // fetch information from github about the thing that we're building:
  // - the place where we can download a full copy of the tree, and
  // - the specific commit that we're shipping, for the author's reference.
  let [owner, repo, ref] = branchId.split(':');
  let github = new GitHub({version: '3.0.0'});

  let [archive, {commit}] = await Promise.all([
    Promise.promisify(github.repos.getArchiveLink)({
      user: owner,
      repo: repo,
      ref: ref,
      archive_format: 'tarball'
    }),
    Promise.promisify(github.repos.getBranch)({
      user: owner,
      repo: repo,
      branch: ref
    })
  ]);

  let latestBuildId = await this.models.branch.getLatesthBuildId(branchId);
  let archiveUrl = archive.meta.location;
  let buildId = latestBuildId + 1;
  let bucketId = this.models.branch.getBuildBucketId(branchId, buildId);
  let bucketFileSystem = this.model.getBucketFileSystem(bucketId);

  // fetch the commit.
  await fetchGitHubArchive(
    archiveUrl, 
    new TransformedFileSystem(
      this.model.getBucketFileSystem(bucketId),
      ShipTransformers,
      {}
    )
  );

  // create a new 
  

  // make the new build public and delete the lock.
  await this.models.branch.putBuild(branchId, buildId, commit);
  await this.models.branch.delLock(branchId);
}

module.exports = {
  enqueueShip,
  ship
};
