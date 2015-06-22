var Promise = require('bluebird');
var TimeSeries = require('redis-timeseries');

var MAX_NEWS_ITEMS = 100;

function getUnixTimestamp() {
  return Math.floor(new Date() / 1000);
}

function getKey(...parts) {
  return ['gos'].concat(parts).join(':');
}

function getKeyPrefix(...parts) {
  return getKey(...parts) + ':';
}

function Model(config, redis) {
  this.config = config;
  this.redis = redis;
  this.timeseries = new TimeSeries(redis, 'gos:stats');
}

Model.prototype = {
  /**
   * Users
   */

  putUser: function(profile, accessToken, isVouched) {
    var writePromise = this.redis.multi()
      .set(getKey('user', profile.username, 'accessToken'), accessToken)
      .set(getKey('user', profile.username, 'isVouched'), isVouched)
      .set(getKey('user', profile.username), JSON.stringify(profile))
      .exec();

    return writePromise.then(function() {
      return {
        username: profile.username,
        profile: profile,
        isVouched: isVouched
      };
    });
  },

  getUserByUsername: function(username) {
    return Promise.props({
      username: username,
      profile: this.redis.get(getKey('user', username)).then(JSON.parse),
      isVouched: this.redis.get(getKey('user', username, 'isVouched')),
      accessToken: this.redis.get(getKey('user', username, 'accessToken'))
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
      .hmset(getKey('exp', id), exp);

    collaborators.forEach(function(collaborator) {
      transaction.sadd(getKey('user', collaborator, 'exps'), id);
    });

    return transaction.exec().return(exp);
  },

  getExpId: function(owner, repo, branch) {
    return [owner, repo, branch].join(':');
  },

  haveExpById: function(id) {
    return this.redis.exists(getKey('exp', id));
  },

  getExpById: function(id) {
    return this.redis.hgetall(getKey('exp', id));
  },

  haveExpByUsernameId: function(username, id) {
    return this.redis.sismember(getKey('user', username, 'exps'), id);
  },

  getAllExpsWithBuilds: function() {
    return Promise.map(
      this.redis.zrevrange('gos:exps', 0, -1),
      this.getExpById.bind(this)
    );
  },

  getExpsByUsername: function(username) {
    return Promise.map(
      this.redis.smembers(getKey('user', username, 'exps')),
      this.getExpById.bind(this)
    );
  },

  /**
   * Experiments: Builds
   */

  putExpBuildLock: function(expId) {
    return this.redis.set(getKey('exp', expId, 'build'), this.config.id, 'NX');
  },

  delExpBuildLock: function(expId) {
    return this.redis.del(getKey('exp', expId, 'build'));
  },

  putExpBuild: function(expId, profile, commit) {
    var timestamp = getUnixTimestamp();

    return (
      this.redis.multi()
        .rpush(getKey('exp', expId, 'builds'), JSON.stringify({
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
    return this.redis.llen(getKey('exp', expId, 'builds'));
  },

  getAllExpBuilds: function(expId) {
    return Promise.map(
      this.redis.lrange(getKey('exp', expId, 'builds'), 0, -1),
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
      this.redis.sadd(getKey('exp', id, 'eventTypes'), Object.keys(keySet))
    ).return({
      events: events.length,
      eventTypes: Object.keys(keySet)
    });
  },

  getExpEventTypes: function(id) {
    return this.redis.smembers(getKey('exp', id, 'eventTypes'));
  },

  /**
   * News Feed
   */

  putNewsItem: function(profile, details) {
    return this.redis.multi()
      .lpush(getKey('news', ), JSON.stringify({
        profile: profile,
        details: details,
        timestamp: getUnixTimestamp()
      }))
      .ltrim(getKey('news', ), 0, MAX_NEWS_ITEMS)
      .exec();
  },

  getAllNewsItems: function() {
    return Promise.map(
      this.redis.lrange(getKey('news', ), 0, -1), 
      JSON.parse
    );
  },

  /**
   * My Build 
   */

  putMyExp: function(username, expId) {
    return this.redis.set(getKey('user', username, 'my'), expId);
  },

  getMyExp: function(username) {
    return this.redis.get(getKey('user', username, 'my'));
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