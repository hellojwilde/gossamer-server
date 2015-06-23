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
   * Experiments
   */

  putExp(owner, repo, branch, collaborators, title) {
    var id = this.getExpId(owner, repo, branch);
    var exp = {
      id: id,
      owner: owner,
      repo: repo,
      branch: branch,
      title: title
    };

    var transaction = this.redis.multi()
      .hmset(this.getKey('exp', id), exp);

    collaborators.forEach(function(collaborator) {
      transaction.sadd(this.getKey('user', collaborator, 'exps'), id);
    });

    return transaction.exec().return(exp);
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
   * Experiments: Build Lock
   */

  putExpBuildLock(expId) {
    return this.redis.set(
      this.getKey('exp', expId, 'lock'), 
      this.config.id, 
      'NX'
    );
  }

  getExpBuildLock(expId) {
    return this.redis.get(this.getKey('exp', expId, 'lock'));
  }

  putExpBuildLockMeta(expId, profile) {
    return this.redis.hmset(this.getKey('exp', expId, 'lock', 'meta'), {
      profile: JSON.stringify(profile),
      timestamp: getUnixTimestamp(),
      status: 'enqueued'
    });
  }

  putExpBuildLockMetaStatus(expId, status) {
    return this.redis.hset(
      this.getKey('exp', expId, 'lock', 'meta'), 
      'status',
      status
    );
  }

  async getExpBuildLockMeta(expId) {
    let meta = await this.redis.hgetall(
      this.getKey('exp', expId, 'lock', 'meta')
    );
    if (meta.profile) {
      meta.profile = JSON.parse(meta.profile);
    }
    return meta;
  }

  delExpBuildLock(expId) {
    return this.redis.multi()
      .del(this.getKey('exp', expId, 'lock'))
      .del(this.getKey('exp', expId, 'lock', 'meta'))
      .exec();
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
   * Experiments: Analytics
   */

  async putExpEvents(id, events) {
    var keySet = {};

    events.forEach((event) => {
      var key = [id, event.key].join(':');
      keySet[key] = true;
      this.timeseries.recordHit(key, event.timestamp, event.increment);
    });

    await Promise.join(
      Promise.promisify(this.timeseries.exec)(),
      this.redis.sadd(this.getKey('exp', id, 'eventTypes'), Object.keys(keySet))
    );

    return {
      events: events.length,
      eventTypes: Object.keys(keySet)
    };
  }

  getExpEventTypes(id) {
    return this.redis.smembers(this.getKey('exp', id, 'eventTypes'));
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

  /**
   * News Feed
   */

  putNewsItem(profile, details) {
    return this.redis.multi()
      .lpush(this.getKey('news', ), JSON.stringify({
        profile: profile,
        details: details,
        timestamp: getUnixTimestamp()
      }))
      .ltrim(this.getKey('news', ), 0, MAX_NEWS_ITEMS)
      .exec();
  }

  getAllNewsItems() {
    return Promise.map(
      this.redis.lrange(this.getKey('news', ), 0, -1), 
      JSON.parse
    );
  }
}

module.exports = Model;