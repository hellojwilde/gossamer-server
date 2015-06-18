var path = require('path');

module.exports = {
  buildsPath: path.join(__dirname, 'builds'),
  sessionSecret: '<put something with entropy here>',
  mozilliansApiKey: '<your Mozillians API key>',
  githubClientId: '<your GitHub client id>',
  githubClientSecret: '<your GitHub client secret>',
  githubCallbackUrl: '<your server>/user/oauth/callback'
};