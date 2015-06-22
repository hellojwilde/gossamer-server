let Promise = require('bluebird');

export async function enqueueShip(expId, profile) {
  let didGetLock = await this.model.putExpBuildLock(expId);

  // make sure that we don't create two instances of the same build at once
  if (didGetLock !== null) {
    await this.model.putExpBuildLockMeta(expId, profile);
    this.connections.aqmp.publish('build-queue', {expId: expId});
  }
}

export async function ship(expId) {
  await this.model.putExpBuildLockMetaStatus(expId, 'building');

  // fetch information from github about the thing that we're building:
  // - the place where we can download a full copy of the tree, and
  // - the specific commit that we're shipping, for the author's reference.
  let [owner, repo, ref] = req.params.expId.split(':');
  let [archive, {commit}] = await Promise.all([
    Promise.promisify(this.github.repos.getArchiveLink)({
      user: owner,
      repo: repo,
      ref: ref,
      archive_format: 'tarball'
    }),
    Promise.promisify(this.github.repos.getBranch)({
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

  await fetchGitHubArchiveAndDeploy(this.config, expId, buildId, archiveUrl);

  // store a build and news feed entry now that the deployment has finished
  await Promise.all([
    this.model.putExpBuild(buildLockMeta.profile, expId, commit),
    this.model.putNewsItem(buildLockMeta.profile, {
      type: 'newExpBuild',
      expId: expId,
      exp: exp,
      commit: commit
    })
  ]);

  // clear the locks on the build
  await this.model.delExpBuildLock(expId);
}