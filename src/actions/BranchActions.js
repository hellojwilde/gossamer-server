let GitHub = require('github');
let Promise = require('bluebird');

let fetchGitHubArchive = require('../helpers/fetchGitHubArchive');

async function enqueueShip(branchId) {
  let didGetLock = await this.model.putBranchLock(branchId);

  // make sure that we don't create two instances of the same build at once
  if (didGetLock !== null) {
    await this.model.putBranchLockStatus(branchId, 'queued');
    this.queue.publish('build-queue', {branchId: branchId});
  }
}

async function ship(branchId) {
  // put a note on the lock that we're shipping the build now
  await this.model.putBranchLockStatus(branchId, 'shipping');

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

  // fetch more information from redis about the experiment
  let [latestBuildId, exp] = await Promise.all([
    this.model.getLatestExpBuildId(branchId),
    this.model.getExpById(branchId)
  ]);

  let archiveUrl = archive.meta.location;
  let buildId = latestBuildId + 1;

  // deploy the commit
  await fetchGitHubArchive(
    archiveUrl, 
    this.model.getExpBuildWritableStream.bind(this.model, branchId, buildId)
  );

  // store the build and delete the lock
  await this.model.putExpBuild(branchId, buildId, null, commit);
  await this.model.delBranchLock(branchId);
}

module.exports = {
  enqueueShip,
  ship
};
