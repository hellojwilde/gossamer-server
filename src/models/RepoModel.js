const {getKey} = require('./Keys');

class RepoModel {
  constructor(registry) {
    this.redis = registry.redis;
    this.registry = registry;
  }

  getSecret(repoId) {
    return this.redis.get(getKey('repo', repoId, 'secret'));
  }
}

module.exports = RepoModel;