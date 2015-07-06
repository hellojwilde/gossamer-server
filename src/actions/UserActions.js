let fetchGitHubUserIsVouched = require('../helpers/fetchGitHubUserIsVouched');

function passportSerializeUserSync(user) {
  return user.username;
}

function passportDeserializeUser(username) {
  return this.models.user.get(username);
}

async function passportVerifyUser(accessToken, refreshToken, profile) {
  let isVouched = await fetchGitHubUserIsVouched(
    accessToken,
    this.config.mozilliansApiKey
  );

  return await this.models.user.put(profile, accessToken, isVouched);
}

module.exports = {
  passportSerializeUserSync,
  passportDeserializeUser,
  passportVerifyUser
};