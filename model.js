var assign = require('lodash.assign');

var Promise = require('bluebird');

function getUserKey(id, optSuffix) {
  var path = ['gos', 'user', id];
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
  }
};

module.exports = Model;