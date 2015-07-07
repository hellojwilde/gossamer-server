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
   * Branches: Builds
   */
  
  putBuild(branchId, buildId, commit) {
    let timestamp = getUnixTimestamp();

    return this.redis.multi()
      .zadd(getKey('build'), timestamp, branchId)
      .rpush(
        getKey('build', branchId),
        JSON.stringify({buildId, commit, timestamp})
      )
      .exec();
  }

  getLatestBuildId(branchId) {
    return this.redis.llen(getKey('build', branchId));
  }

  getLatestBuild(branchId) {
    return this.redis.lindex(
      getKey('build', branchId), 
      -1
    ).then(JSON.parse);
  }

  getBuildBucketId(branchId, buildId) {
    return ['build', branchId, buildId].join('/');
  }

  getAllWithBuilds() {
    return Promise.map(
      this.redis.zrevrange(getKey('build'), 0, -1), 
      this.get.bind(this)
    );
  }
}

module.exports = BranchModel;