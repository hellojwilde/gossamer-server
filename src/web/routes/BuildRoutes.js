var express = require('express');
var ensureAuthenticated = require('../helpers/ensureAuthenticated');
var renderWithDefaults = require('../helpers/renderWithDefaults');
var path = require('path');

var Routes = require('../helpers/Routes');

function sendFileForBuildId(buildId, req, res, next) {
  console.log('sfbi', buildId, path.join(this.config.buildsPath, buildId))

  express.static(
    path.join(this.config.buildsPath, buildId)
  )(req, res, next);
}

let routes = new Routes();

routes.get('/manifest.webapp', function(req, res) {
  res.json({
    "name": "Browser.html",
    "version": "0.0.2",
    "description": "Browser.html",
    "launch_path": "./index.html",
    "type": "certified",
    "role": "system",
    "developer": {
      "name": "Mozilla",
      "url": "https://mozilla.org"
    },
    "permissions": {
      "browser": {},
      "embed-apps": {},
      "systemXHR": {},
      "settings": {"access": "readwrite"},
      "geolocation" : {},
      "desktop-notification": {},
      "audio-capture": {},
      "video-capture": {}
    }
  });
});

routes.get('/index.html', async function(req, res, next) {
  if (!req.isAuthenticated()) {
    renderWithDefaults(req, res, 'build/login-index');
    return;
  }

  let buildId = await this.model.getMyExpBuildId(req.user.username);

  if (!buildId) {
    let exps = await this.model.getAllExpsWithBuilds();
    renderWithDefaults(req, res, 'build/index', {exps});
    return;
  }

  sendFileForBuildId.call(this, buildId, req, res, next);
});

routes.post('/index.html', ensureAuthenticated, async function(req, res) {
  if (req.body.expId) {
    await this.model.putMyExp(req.user.username, req.body.expId);
  }

  res.redirect('/my/index.html');
});

routes.get('/*', ensureAuthenticated, async function(req, res, next) {
  let buildId = await this.model.getMyExpBuildId(req.user.username)

  if (!buildId) {
    res.end();
    return;
  }

  sendFileForBuildId.call(this, buildId, req, res, next);
});

module.exports = routes;
