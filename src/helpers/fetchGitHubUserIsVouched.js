let querystring = require('querystring');
let request = require('request');

let Promise = require('bluebird');
let GitHub = require('github');

// github+mozillians vouching

async function fetchGitHubUserIsVouched(githubUserToken, mozilliansApiKey) {
  let vouches = await Promise.map(
    fetchGitHubVerifiedEmails(githubUserToken),
    (email) => fetchIsVouched(mozilliansApiKey, email)
  );

  return vouches.indexOf(true) !== -1;
}

function fetchGitHubVerifiedEmails(githubUserToken) {
  return new Promise(function(resolve, reject) {
    let github = new GitHub({version: '3.0.0'});
    github.authenticate({type: 'oauth', token: githubUserToken});
    github.user.getEmails({}, function(err, result) {
      if (err) {
        reject(err);
        return;
      }

      resolve(result.reduce((emails, address) => {
        return address.verified ? emails.concat(address.email) : emails;
      }, []));
    })
  });
}

function fetchIsVouched(mozilliansApiKey, email) {
  let url = (
    'https://mozillians.org/api/v2/users/?' +
    querystring.stringify({
      'api-key': mozilliansApiKey, 
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

      let parsed = JSON.parse(body);
      resolve(parsed && parsed.count && parsed.count > 0);
    })
  });
}

module.exports = fetchGitHubUserIsVouched;