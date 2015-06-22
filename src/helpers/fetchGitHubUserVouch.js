var querystring = require('querystring');
var request = require('request');

var Promise = require('bluebird');
var GitHub = require('github');

// github+mozillians vouching

function fetchGitHubUserVouch(githubUserToken, mozilliansApiKey) {
  return Promise.map(
    fetchGitHubVerifiedEmails(githubUserToken),
    fetchVouch.bind(null, mozilliansApiKey)
  ).then(function(vouches) {
    return vouches.indexOf(true) !== -1;
  });
}

function fetchGitHubVerifiedEmails(githubUserToken) {
  return new Promise(function(resolve, reject) {
    var github = new GitHub({version: '3.0.0'});
    github.authenticate({type: 'oauth', token: githubUserToken});
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

function fetchVouch(mozilliansApiKey, email) {
  return new Promise(function(resolve, reject) {
    var url = (
      'https://mozillians.org/api/v2/users/?' +
      querystring.stringify({
        'api-key': mozilliansApiKey, 
        'email': email, 
        'is_vouched': 'true'
      })
    );

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