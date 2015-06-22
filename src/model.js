var Promise = require('bluebird');
var TimeSeries = require('redis-timeseries');

var MAX_NEWS_ITEMS = 100;

function getUnixTimestamp() {
  return Math.floor(new Date() / 1000);
}

function Model(config, redis) {
  this.config = config;
  this.redis = redis;
  this.timeseries = new TimeSeries(redis, 'gos:stats');
}

Model.prototype = {
  /**
   * Keys
   */
  
  getKey: function(...parts) {
    return ['gos'].concat(parts).join(':');
  },

  getKeyPrefix: function(...parts) {
    return this.getKey(...parts) + ':';
  },

  /**
   * Users
   */

  putUser: async function(profile, accessToken, isVouched) {
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
  },

  getUser: function(username) {
    return Promise.props({
      username: username,
      profile: this.redis.get(this.getKey('user', username)).then(JSON.parse),
      isVouched: this.redis.get(this.getKey('user', username, 'isVouched')),
      accessToken: this.redis.get(this.getKey('user', username, 'accessToken'))
    });
  },

  /**
   * Experiments
   */

  putExp: function(owner, repo, branch, collaborators, title) {
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
  },

  getExpId: function(owner, repo, branch) {
    return [owner, repo, branch].join(':');
  },

  haveExpById: function(id) {
    return this.redis.exists(this.getKey('exp', id));
  },

  getExpById: function(id) {
    return this.redis.hgetall(this.getKey('exp', id));
  },

  haveExpByUsernameId: function(username, id) {
    return this.redis.sismember(this.getKey('user', username, 'exps'), id);
  },

  getAllExpsWithBuilds: function() {
    return Promise.map(
      this.redis.zrevrange('gos:exps', 0, -1),
      this.getExpById.bind(this)
    );
  },

  getExpsByUsername: function(username) {
    return Promise.map(
      this.redis.smembers(this.getKey('user', username, 'exps')),
      this.getExpById.bind(this)
    );
  },

  /**
   * Experiments: Builds
   */

  putExpBuildLock: function(expId) {
    return this.redis.set(this.getKey('exp', expId, 'build'), this.config.id, 'NX');
  },

  delExpBuildLock: function(expId) {
    return this.redis.del(this.getKey('exp', expId, 'build'));
  },

  putExpBuild: function(expId, profile, commit) {
    var timestamp = getUnixTimestamp();

    return (
      this.redis.multi()
        .rpush(this.getKey('exp', expId, 'builds'), JSON.stringify({
          profile: profile,
          commit: commit,
          timestamp: timestamp
        }))
        .zadd('gos:exps', timestamp, expId)
        .exec()
    ).then(function(results) {
      return results[0][1];
    });
  },

  getLatestExpBuildId: function(expId) {
    return this.redis.llen(this.getKey('exp', expId, 'builds'));
  },

  getAllExpBuilds: function(expId) {
    return Promise.map(
      this.redis.lrange(this.getKey('exp', expId, 'builds'), 0, -1),
      function(value, index) {
        return Object.assign(JSON.parse(value), {id: index+1});
      }
    );
  },

  /**
   * Experiments: Analytics
   */

  putExpEvents: function(id, events) {
    var keySet = {};

    events.forEach(function(event) {
      var key = [id, event.key].join(':');
      keySet[key] = true;
      this.timeseries.recordHit(key, event.timestamp, event.increment);
    }.bind(this));

    return Promise.join(
      Promise.promisify(this.timeseries.exec)(),
      this.redis.sadd(this.getKey('exp', id, 'eventTypes'), Object.keys(keySet))
    ).return({
      events: events.length,
      eventTypes: Object.keys(keySet)
    });
  },

  getExpEventTypes: function(id) {
    return this.redis.smembers(this.getKey('exp', id, 'eventTypes'));
  },

  /**
   * News Feed
   */

  putNewsItem: function(profile, details) {
    return this.redis.multi()
      .lpush(this.getKey('news', ), JSON.stringify({
        profile: profile,
        details: details,
        timestamp: getUnixTimestamp()
      }))
      .ltrim(this.getKey('news', ), 0, MAX_NEWS_ITEMS)
      .exec();
  },

  getAllNewsItems: function() {
    return Promise.map(
      this.redis.lrange(this.getKey('news', ), 0, -1), 
      JSON.parse
    );
  },

  /**
   * My Build 
   */

  putMyExp: function(username, expId) {
    return this.redis.set(this.getKey('user', username, 'my'), expId);
  },

  getMyExp: function(username) {
    return this.redis.get(this.getKey('user', username, 'my'));
  },

  getMyExpBuildId: function(username, baseUrl) {
    return this.getMyExp(username).then(function(expId) {
      if (!expId) {
        return null;
      }
      return this.getLatestExpBuildId(expId, baseUrl).then(function(buildId) {
        return [expId, buildId].join('/');
      });
    }.bind(this));
  }
};

module.exports = Model;