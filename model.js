var assign = require('lodash.assign');

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

  getExpsByUsername: function(username) {
    return Promise.map(
      this._redis.smembers(getUserKey(username, 'exps')),
      this.getExpById.bind(this)
    );
  },

  putExpEvents: function(id, events) {
    events.forEach(function(event) {
      this._timeseries.recordHit(
        [id, event.key].join(':'),
        event.timestamp,
        event.increment
      );
    }.bind(this));

    return Promise.promisify(this._timeseries.exec)()
      .return(events.length);
  },

  putNewsItem: function(username, profile, details) {
    return this._redis.pipeline()
      .lpush(getNewsKey(), JSON.stringify({
        username: username,
        profile: profile,
        details: details,
        timestamp: Math.floor(new Date() / 1000)
      }))
      .ltrim(getNewsKey(), 0, MAX_NEWS_ITEMS)
      .exec();
  },

  getAllNewsItems: function() {
    return Promise.map(
      this._redis.lrange(getNewsKey(), 0, -1), 
      JSON.parse
    );
  }
};

module.exports = Model;