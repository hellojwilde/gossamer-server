var path = require('path');

module.exports = {
  buildsPath: path.join(__dirname, 'builds'),
  sessionSecret: process.env.SESSION_SECRET,
  mozilliansApiKey: process.env.MOZILLIANS_API_KEY,
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
  githubCallbackUrl: process.env.PUBLIC_URL + '/user/oauth/callback'
};