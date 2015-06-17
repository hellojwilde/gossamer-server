var assign = require('lodash.assign');
var getUnixTimestamp = require('./helpers/getUnixTimestamp');

var Promise = require('bluebird');
var TimeSeries = require('redis-timeseries');

var MAX_NEWS_ITEMS = 100;

function getUserKey(username, optSuffix) {
  var path = ['gos', 'user', username];
  optSuffix && path.push(optSuffix);
  return path.join(':');
}

function getExpKey(id, optSuffix) {
  var path = ['gos', 'exp', id];
  optSuffix && path.push(optSuffix);
  return path.join(':');
}

function getNewsKey(optSuffix) {
  var path = ['gos', 'news'];
  optSuffix && path.push(optSuffix);
  return path.join(':');
}

function Model(redis) {
  this._redis = redis;
  this._timeseries = new TimeSeries(this._redis, 'gos:stats');
}

Model.prototype = {
  putUser: function(profile, accessToken, isVouched) {
    var writePromise = this._redis.multi()
      .set(getUserKey(profile.username, 'accessToken'), accessToken)
      .set(getUserKey(profile.username, 'isVouched'), isVouched)
      .set(getUserKey(profile.username), JSON.stringify(profile))
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
      profile: this._redis.get(getUserKey(username)).then(JSON.parse),
      isVouched: this._redis.get(getUserKey(username, 'isVouched')),
      accessToken: this._redis.get(getUserKey(username, 'accessToken'))
    });
  },

  putExp: function(owner, repo, branch, collaborators, title) {
    var id = this.getExpId(owner, repo, branch);
    var exp = {
      id: id,
      owner: owner,
      repo: repo,
      branch: branch,
      title: title
    };

    var transaction = this._redis.multi()
      .hmset(getExpKey(id), exp);

    collaborators.forEach(function(collaborator) {
      transaction.sadd(getUserKey(collaborator, 'exps'), id);
    });

    return transaction.exec().return(exp);
  },

  getExpId: function(owner, repo, branch) {
    return [owner, repo, branch].join(':');
  },

  haveExpById: function(id) {
    return this._redis.exists(getExpKey(id));
  },

  getExpById: function(id) {
    return this._redis.hgetall(getExpKey(id));
  },

  haveExpByUsernameId: function(username, id) {
    return this._redis.sismember(getUserKey(username, 'exps'), id);
  },

  getExpsByUsername: function(username) {
    return Promise.map(
      this._redis.smembers(getUserKey(username, 'exps')),
      this.getExpById.bind(this)
    );
  },

  putExpBuild: function(profile, id, commit) {
    return this._redis.rpush(getExpKey(id, 'builds'), JSON.stringify({
      profile: profile,
      commit: commit,
      timestamp: getUnixTimestamp()
    }));
  },

  getLatestExpBuildId: function(expId) {
    return this._redis.llen(getExpKey(expId, 'builds'));
  },

  getAllExpBuilds: function(id) {
    return Promise.map(
      this._redis.lrange(getExpKey(id, 'builds'), 0, -1),
      function(value, index) {
        return assign(JSON.parse(value), {id: index+1});
      }
    );
  },

  putExpBuildOutput: function(expId, id, output) {
    return this._redis.rpush(getExpKey(expId, 'builds:' + id), output);
  },

  getAllExpBuildOutput: function(expId, id) {
    return this._redis.lrange(getExpKey(expId, 'builds:' + id), 0, -1);
  },

  putExpEvents: function(id, events) {
    var keySet = {};

    events.forEach(function(event) {
      var key = [id, event.key].join(':');
      keySet[key] = true;
      this._timeseries.recordHit(key, event.timestamp, event.increment);
    }.bind(this));

    return Promise.join(
      Promise.promisify(this._timeseries.exec)(),
      this._redis.sadd(getExpKey(id, 'eventTypes'), Object.keys(keySet))
    ).return({
      events: events.length,
      eventTypes: Object.keys(keySet)
    });
  },

  getExpEventTypes: function(id) {
    return this._redis.smembers(getExpKey(id, 'eventTypes'));
  },

  putNewsItem: function(profile, details) {
    return this._redis.pipeline()
      .lpush(getNewsKey(), JSON.stringify({
        profile: profile,
        details: details,
        timestamp: getUnixTimestamp()
      }))
      .ltrim(getNewsKey(), 0, MAX_NEWS_ITEMS)
      .exec();
  },

  getAllNewsItems: function() {
    return Promise.map(
      this._redis.lrange(getNewsKey(), 0, -1), 
      JSON.parse
    );
  },

  putMyExp: function(username) {
    return this._redis.set(getUserKey(username, 'my'));
  },

  getMyExp: function(username) {
    return this._redis.get(getUserKey(username, 'my'));
  },

  getMyExpBuildId: function(username, baseUrl) {
    return this.getMyExp(username).then(function(expId) {
      if (!expId || !expId.length) {
        return null;
      }
      return this.getLatestExpBuildId(expId, baseUrl).then(function(buildId) {
        return [expId, buildId].join('/');
      });
    }.bind(this));
  }
};

module.exports = Model;