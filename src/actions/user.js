var fetchGitHubUserIsVouched = require('../helpers/fetchGitHubUserIsVouched');

export function passportSerializeUserSync(user) {
  return user.username;
}

export function passportDeserializeUser(username) {
  return this.model.getUser(username);
}

export async function passportVerifyUser(accessToken, refreshToken, profile) {
  let isVouched = await fetchGitHubUserIsVouched(
    accessToken, 
    this.config.mozilliansApiKey
  );

  return await this.model.putUser(profile, accessToken, isVouched);
}
