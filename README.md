# gossamer-server

A centralized place for easily installable browser experiments.

## Prerequisites

- Node
- Nodemon - installed via `npm install -g nodemon` such that it's accessible from shell by calling `nodemon`
- Redis - running on `127.0.0.1:6379`

## Installation

1. Clone this repository.
2. Run `npm install`.
3. Set up the configuration file:
   a. `cp config.default.js config.js`
   b. Create a [new GitHub application](https://github.com/settings/applications/new) and copy the client id and client secret into the `githubClientId` and `githubClientSecret` fields of the config file. Make sure the `githubCallbackUrl` field is appropriate and matches the "Authorization callback URL" field of the application configuration on GitHub.
4. Run `npm start`.