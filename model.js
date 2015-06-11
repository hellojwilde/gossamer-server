var assign = require('lodash.assign');
var crypto = require('crypto');

var Promise = require('bluebird');

function getUserKey(id, optSuffix) {
  var path = ['gos', 'user', id];
  optSuffix && path.push(optSuffix);
  return path.join(':');
}

function getExpKey(id, optSuffix) {
  var path = ['gos', 'exp', id];
  optSuffix && path.push(optSuffix);
  return path.join(':');
}

function Model(redis) {
  this._redis = redis;
}

Model.prototype = {
  putUser: function(profile, accessToken, isVouched) {
    var writePromise = this._redis.multi()
      .set(getUserKey(profile.id, 'accessToken'), accessToken)
      .set(getUserKey(profile.id, 'isVouched'), isVouched)
      .set(getUserKey(profile.id), JSON.stringify(profile))
      .exec();

    return writePromise.then(function() {
      return assign({}, profile, {isVouched: isVouched});
    });
  },

  getUserById: function(id) {
    return Promise.props({
      profile: this._redis.get(getUserKey(id)),
      isVouched: this._redis.get(getUserKey(id, 'isVouched'))
    })
    .then(function(user) {
      return assign(JSON.parse(user.profile), {isVouched: user.isVouched});
    });
  },

  putExp: function(userId, url, description) {
    var hash = crypto.createHash('sha1');
    hash.update(url, 'ascii');

    var id = hash.digest('base64');
    var exp = {
      id: id,
      userId: userId,
      url: url, 
      description: description
    };

    var writePromise = this._redis.multi()
      .hmset(getExpKey(id), exp)
      .sadd(getUserKey(userId, 'exps'), id)
      .exec();

    return writePromise.then(function() {
      return exp;
    });
  },

  getExpById: function(id) {
    return this._redis.get(getExpKey(id));
  },

  getExpsByUserId: function(userId) {
    return Promise.map(
      this._redis.smembers(getUserKey(userId, 'exps')),
      this.getExpById.bind(this)
    );
  }
};

module.exports = Model;