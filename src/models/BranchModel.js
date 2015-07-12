const getUnixTimestamp = require('../helpers/getUnixTimestamp');
const {getKey} = require('./Keys');

const Promise = require('bluebird');

class BranchModel {
  constructor(registry) {
    this.redis = registry.redis;
    this.config = registry.config;
    this.registry = registry;
  }

  get(branchId) {
    return Promise.props({
      branchId: branchId,
      latest: this.getLatestBuild(branchId),
      lock: this.getLock(branchId),
      lockStatus: this.getLockStatus(branchId)
    });
  }

  getAllWithBuilds() {
    return Promise.map(
      this.redis.zrevrange(getKey('build'), 0, -1), 
      this.get.bind(this)
    );
  }

  /**
   * Locking
   */
  
  putLock(branchId) {
    return this.redis.set(
      getKey('branch', branchId, 'lock'), 
      this.config.id, 
      'NX'
    );
  }

  getLock(branchId) {
    return this.redis.get(getKey('branch', branchId, 'lock'));
  }

  putLockStatus(branchId, status) {
    return this.redis.set(
      getKey('branch', branchId, 'lock', 'status'),
      status
    );
  }

  getLockStatus(branchId) {
    return this.redis.get(getKey('branch', branchId, 'lock', 'status'));
  }

  delLock(branchId) {
    return this.redis.multi()
      .del(getKey('branch', branchId, 'lock'))
      .del(getKey('branch', branchId, 'lock', 'status'))
      .exec();
  }

  /**
   * Build
   */
  
  putBuild(branchId, ctx) {
    const timestamp = getUnixTimestamp();

    return this.redis.multi()
      .zadd(getKey('build'), timestamp, branchId)
      .rpush(
        getKey('build', branchId), 
        JSON.stringify(Object.assign(ctx, {timestamp: timestamp}))
      )
      .exec();
  }

  getLatestBuildId(branchId) {
    return this.redis.llen(getKey('build', branchId));
  }

  getBuildBucketId(branchId, buildId) {
    return ['build', branchId, buildId].join('/');
  }

  async getLatestBuild(branchId) {
    let raw = await this.redis.lindex(getKey('build', branchId), -1);
    return JSON.parse(raw);
  }
}

module.exports = BranchModel;