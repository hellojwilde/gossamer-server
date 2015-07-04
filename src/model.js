let crypto = require('crypto');
let getUnixTimestamp = require('./helpers/getUnixTimestamp');

let Promise = require('bluebird');
let {Writable} = require('stream');

class BucketWritableStream extends Writable {
  constructor(model, bucketId, filePath) {
    super();

    this.model = model;
    this.bucketId = bucketId;
    this.filePath = filePath;

    this.buffers = [];
    this.hash = crypto.createHash('sha1');

    this.on('finish', this._finish.bind(this));
  }

  _write(chunk, encoding, next) {
    if (!Buffer.isBuffer(chunk)) {
      chunk = new Buffer(chunk, encoding);
    }

    this.hash.update(chunk);
    this.buffers.push(chunk);
    
    next();
  }

  _finish() {
    return this.model.putBucketFile(
      this.bucketId,
      this.filePath, 
      this.hash.digest('base64'), 
      Buffer.concat(this.buffers)
    );
  }
}

class Model {
  constructor(config, redis) {
    this.config = config;
    this.redis = redis;
  }

  /**
   * Keys
   */
  
  getKey(...parts) {
    return ['gos'].concat(parts).join(':');
  }

  getKeyPrefix(...parts) {
    return this.getKey(...parts) + ':';
  }

  /**
   * Users
   */

  async putUser(profile, accessToken, isVouched) {
    await this.redis.multi()
      .set(this.getKey('user', profile.username, 'accessToken'), accessToken)
      .set(this.getKey('user', profile.username, 'isVouched'), isVouched)
      .set(this.getKey('user', profile.username), JSON.stringify(profile))
      .exec();

    return {
      username: profile.username,
      profile: profile,
      isVouched: isVouched
    };
  }

  getUser(username) {
    return Promise.props({
      username: username,
      profile: this.redis.get(this.getKey('user', username)).then(JSON.parse),
      isVouched: this.redis.get(this.getKey('user', username, 'isVouched')),
      accessToken: this.redis.get(this.getKey('user', username, 'accessToken'))
    });
  }

  /**
   * Repos
   */
  
  getRepoSecret(repoId) {
    return this.redis.get(this.getKey('repo', repoId, 'secret'));
  }

  /**
   * Branches
   */
  
  getBranch(branchId) {
    return Promise.props({
      branchId: branchId,
      latest: this.getLatestBranchBuild(branchId),
      lock: this.getBranchLock(branchId),
      lockStatus: this.getBranchLockStatus(branchId)
    });
  }

  /**
   * Branches: Locking
   */
  
  putBranchLock(branchId) {
    return this.redis.set(
      this.getKey('branch', branchId, 'lock'), 
      this.config.id, 
      'NX'
    );
  }

  getBranchLock(branchId) {
    return this.redis.get(this.getKey('branch', branchId, 'lock'));
  }

  putBranchLockStatus(branchId, status) {
    return this.redis.set(
      this.getKey('branch', branchId, 'lock', 'status'),
      status
    );
  }

  getBranchLockStatus(branchId) {
    return this.redis.get(this.getKey('branch', branchId, 'lock', 'status'));
  }

  delBranchLock(branchId) {
    return this.redis.multi()
      .del(this.getKey('branch', branchId, 'lock'))
      .del(this.getKey('branch', branchId, 'lock', 'status'))
      .exec();
  }

  /**
   * Branches: Builds
   */
  
  putBranchBuild(branchId, buildId, commit) {
    let timestamp = getUnixTimestamp();

    return this.redis.multi()
      .zadd(this.getKey('build'), timestamp, branchId)
      .rpush(
        this.getKey('build', branchId),
        JSON.stringify({buildId, commit, timestamp})
      )
      .exec();
  }

  getLatestBranchBuildId(branchId) {
    return this.redis.llen(this.getKey('build', branchId));
  }

  getLatestBranchBuild(branchId) {
    return this.redis.lindex(
      this.getKey('build', branchId), 
      -1
    ).then(JSON.parse);
  }

  getBranchBuildBucketId(branchId, buildId) {
    return ['build', branchId, buildId].join('/');
  }

  getAllBranchesWithBuilds() {
    return Promise.map(
      this.redis.zrevrange(this.getKey('build'), 0, -1), 
      this.getBranch.bind(this)
    );
  }

  /**
   * Blob
   */

  putBlob(digest, buffer) {
    return this.redis.set(this.getKey('blob', digest), buffer);
  }

  haveBlob(digest) {
    return this.redis.exists(this.getKey('blob', digest));
  }

  getBlobBuffer(digest) {
    return this.redis.getBuffer(this.getKey('blob', digest));
  }

  /**
   * Buckets
   */
  
  getBucketWritableStream(bucketId, filePath) {
    return new BucketWritableStream(this, bucketId, filePath);
  }

  async putBucketFile(bucketId, filePath, digest, buffer) {
    let blobExists = await this.haveBlob(digest);

    if (!blobExists) {
      await this.putBlob(digest, buffer);
    }

    await this.redis.hset(this.getKey('bucket', bucketId), filePath, digest);
  }

  getBucketFileDigest(bucketId, filePath) {
    return this.redis.hget(this.getKey('bucket', bucketId), filePath);
  }

  async getBucketFile(bucketId, filePath) {
    let digest = await this.getBucketFileDigest(bucketId, filePath);

    if (!digest) {
      return null;
    }

    return await Promise.props({
      digest: digest, 
      buffer: this.getBlobBuffer(digest)
    });
  }

  /**
   * My Build 
   */

  putMyBranch(username, branchId) {
    return this.redis.set(this.getKey('user', username, 'my'), branchId);
  }

  async getMyBranch(username) {
    if (!username) {
      return this.config.base;
    }
    
    let branchId = await this.redis.get(this.getKey('user', username, 'my'));
    return branchId || this.config.base;
  }

  async getMyBranchBuild(username) {
    let branchId = await this.getMyBranch(username);
    let buildId = await this.getLatestBranchBuildId(branchId);
    return [branchId, buildId];
  }
}

module.exports = Model;