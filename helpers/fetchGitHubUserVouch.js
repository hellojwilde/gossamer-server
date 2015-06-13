var querystring = require('querystring');
var request = require('request');
var config = require('../config');

var Promise = require('bluebird');

// github+mozillians vouching

function fetchGitHubUserVouch(github, accessToken) {
  return Promise.map(
    fetchGitHubVerifiedEmails(github, accessToken),
    fetchVouch
  ).then(function(vouches) {
    return vouches.indexOf(true) !== -1;
  });
}

function fetchGitHubVerifiedEmails(github, accessToken) {
  return new Promise(function(resolve, reject) {
    github.authenticate({type: 'oauth', token: accessToken});
    github.user.getEmails({}, function(err, result) {
      if (err) {
        reject(err);
      }

      resolve(
        result
          .filter(function(address) {return address.verified === true})
          .map(function(address) {return address.email})
      );
    })
  });
}

function fetchVouch(email) {
  var url = (
    'https://mozillians.org/api/v2/users/?' +
    querystring.stringify({
      'api-key': config.mozilliansApiKey, 
      'email': email, 
      'is_vouched': 'true'
    })
  );

  return new Promise(function(resolve, reject) {
    request(url, function(err, response, body) {
      if (err) {
        reject(err);
        return;
      }

      var parsed = JSON.parse(body);
      resolve(parsed && parsed.count && parsed.count > 0);
    })
  });
}

module.exports = fetchGitHubUserVouch;