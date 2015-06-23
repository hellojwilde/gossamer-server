let fetchGitHubUserIsVouched = require('../helpers/fetchGitHubUserIsVouched');

function passportSerializeUserSync(user) {
  return user.username;
}

function passportDeserializeUser(username) {
  return this.model.getUser(username);
}

async function passportVerifyUser(accessToken, refreshToken, profile) {
  let isVouched = await fetchGitHubUserIsVouched(
    accessToken, 
    this.config.mozilliansApiKey
  );

  return await this.model.putUser(profile, accessToken, isVouched);
}

module.exports = {
  passportSerializeUserSync,
  passportDeserializeUser,
  passportVerifyUser
};