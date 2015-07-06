const {getKey} = require('./Keys');

const Promise = require('bluebird');

class UserModel {
  constructor(registry) {
    this.redis = registry.redis;
    this.registry = registry;
  }

  get branch() {
    return this.registry.models.branch;
  }

  async put(profile, accessToken, isVouched) {
    await this.redis.multi()
      .set(getKey('user', profile.username, 'accessToken'), accessToken)
      .set(getKey('user', profile.username, 'isVouched'), isVouched)
      .set(getKey('user', profile.username), JSON.stringify(profile))
      .exec();

    return {
      username: profile.username,
      profile: profile,
      isVouched: isVouched
    };
  }

  get(username) {
    return Promise.props({
      username: username,
      profile: this.redis.get(getKey('user', username)).then(JSON.parse),
      isVouched: this.redis.get(getKey('user', username, 'isVouched')),
      accessToken: this.redis.get(getKey('user', username, 'accessToken'))
    });
  }

  putBranch(username, branchId) {
    return this.redis.set(this.getKey('user', username, 'my'), branchId);
  }

  async getBranch(username) {
    if (!username) {
      return this.config.base;
    }
    
    let branchId = await this.redis.get(this.getKey('user', username, 'my'));
    return branchId || this.config.base;
  }

  async getBranchBuild(username) {
    let branchId = await this.getBranch(username);
    let buildId = await this.branch.getLatestBuildId(branchId);
    return [branchId, buildId];
  }
}

module.exports = UserModel;