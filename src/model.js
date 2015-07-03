let crypto = require('crypto');

let Promise = require('bluebird');
let TimeSeries = require('redis-timeseries');
let {Writable} = require('stream');

const MAX_NEWS_ITEMS = 100;

function getUnixTimestamp() {
  return Math.floor(new Date() / 1000);
}

class ModelExpBuildWritableStream extends Writable {
  constructor(model, expId, buildId, filePath) {
    super();

    this.model = model;
    this.expId = expId;
    this.buildId = buildId;
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
    return this.model.putExpBuildFile(
      this.expId, 
      this.buildId, 
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
    this.timeseries = new TimeSeries(redis, this.getKey('stats'));
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
   * Experiments
   */

  putExp(owner, repo, branch, collaborators, title) {
    let id = this.getExpId(owner, repo, branch);
    let transaction = this.redis.multi()
      .hmset(this.getKey('exp', id), {id, owner, repo, branch, title});

    collaborators.forEach((collaborator) => {
      transaction.sadd(this.getKey('user', collaborator, 'exps'), id);
    });

    return transaction.exec();
  }

  getExpId(owner, repo, branch) {
    return [owner, repo, branch].join(':');
  }

  haveExpById(id) {
    return this.redis.exists(this.getKey('exp', id));
  }

  getExpById(id) {
    return this.redis.hgetall(this.getKey('exp', id));
  }

  haveExpByUsernameId(username, id) {
    return this.redis.sismember(this.getKey('user', username, 'exps'), id);
  }

  getAllExpsWithBuilds() {
    return Promise.map(
      this.redis.zrevrange('gos:exps', 0, -1),
      this.getExpById.bind(this)
    );
  }

  getExpsByUsername(username) {
    return Promise.map(
      this.redis.smembers(this.getKey('user', username, 'exps')),
      this.getExpById.bind(this)
    );
  }

  /**
   * Experiments: Build Metadata
   */

  async putExpBuild(expId, buildId, profile, commit) {
    let timestamp = getUnixTimestamp();

    await this.redis.multi()
      .rpush(this.getKey('exp', expId, 'builds'), JSON.stringify({
        id: buildId,
        profile: profile,
        commit: commit,
        timestamp: timestamp
      }))
      .zadd('gos:exps', timestamp, expId)
      .exec();
  }

  getLatestExpBuildId(expId) {
    return this.redis.llen(this.getKey('exp', expId, 'builds'));
  }

  getAllExpBuilds(expId) {
    return Promise.map(
      this.redis.lrange(this.getKey('exp', expId, 'builds'), 0, -1),
      (value, index) => Object.assign(JSON.parse(value), {id: index+1})
    );
  }

  /**
   * Experiments: Build
   */
  
  getExpBuildWritableStream(expId, buildId, filePath) {
    return new ModelExpBuildWritableStream(this, expId, buildId, filePath);
  }

  async putExpBuildFile(expId, buildId, filePath, digest, buffer) {
    let blobKey = this.getKey('blob', digest);
    let blobExists = await this.redis.exists(blobKey);

    if (!blobExists) {
      await this.redis.set(blobKey, buffer);
    }

    await this.redis.hset(
      this.getKey('build', expId, buildId),
      filePath, 
      digest
    );
  }

  getExpBuildFileDigest(expId, buildId, filePath) {
    return this.redis.hget(this.getKey('build', expId, buildId), filePath);
  }

  async getExpBuildFile(expId, buildId, filePath) {
    let digest = await this.getExpBuildFileDigest(expId, buildId, filePath);

    if (!digest) {
      return null;
    }

    return await Promise.props({
      digest, 
      buffer: this.redis.getBuffer(this.getKey('blob', digest))
    });
  }

  /**
   * My Build 
   */

  putMyExp(username, expId) {
    return this.redis.set(this.getKey('user', username, 'my'), expId);
  }

  getMyExp(username) {
    return this.redis.get(this.getKey('user', username, 'my'));
  }

  async getMyExpBuild(username, baseUrl) {
    let expId = await this.getMyExp(username);
    if (expId) {
      let buildId = await this.getLatestExpBuildId(expId);
      return [expId, buildId];
    }
    return null;
  }
}

module.exports = Model;