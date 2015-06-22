let GitHub = require('github');
let Promise = require('bluebird');

let fetchGitHubArchiveAndDeploy = require('../helpers/fetchGitHubArchiveAndDeploy')

export async function enqueueShip(expId, profile) {
  let didGetLock = await this.model.putExpBuildLock(expId);

  // make sure that we don't create two instances of the same build at once
  if (didGetLock !== null) {
    await this.model.putExpBuildLockMeta(expId, profile);
    this.connections.amqp.publish('build-queue', {expId: expId});
  }
}

export async function ship(expId) {
  // fetch information from github about the thing that we're building:
  // - the place where we can download a full copy of the tree, and
  // - the specific commit that we're shipping, for the author's reference.
  let [owner, repo, ref] = expId.split(':');
  let github = new GitHub({version: '3.0.0'});

  await this.model.putExpBuildLockMetaStatus(expId, 'fetching');
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
  let [latestBuildId, exp, buildLockMeta] = await Promise.all([
    this.model.getLatestExpBuildId(expId),
    this.model.getExpById(expId),
    this.model.getExpBuildLockMeta(expId)
  ]);

  // deploy the commit
  let archiveUrl = archive.meta.location;
  let buildId = latestBuildId + 1;

  await this.model.putExpBuildLockMetaStatus(expId, 'deploying');
  await fetchGitHubArchiveAndDeploy(this.config, expId, buildId, archiveUrl);

  // store a build and news feed entry now that the deployment has finished
  await this.model.putExpBuildLockMetaStatus(expId, 'notifying');
  await Promise.all([
    this.model.putExpBuild(expId, buildId, buildLockMeta.profile, commit),
    this.model.putNewsItem(buildLockMeta.profile, {
      type: 'newExpBuild',
      id: buildId,
      expId: expId,
      exp: exp,
      commit: commit
    })
  ]);

  // clear the locks on the build
  await this.model.delExpBuildLock(expId);
}