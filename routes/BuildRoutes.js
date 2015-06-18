var express = require('express');
var ensureAuthenticated = require('../helpers/ensureAuthenticated');
var renderWithDefaults = require('../helpers/renderWithDefaults');
var config = require('../config');
var path = require('path');

function BuildRoutes(model) {
  var router = express.Router();

  router.get('/manifest.webapp', this.getManifest.bind(this));
  router.get('/index.html', this.getIndex.bind(this));
  router.post('/index.html', ensureAuthenticated, this.postIndex.bind(this));
  router.get('/*', ensureAuthenticated, this.getBuildFile.bind(this));

  this.model = model;
  this.router = router;
}

BuildRoutes.prototype = {
  getManifest: function(req, res) {
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
  },

  getIndex: function(req, res) {
    if (!req.isAuthenticated()) {
      renderWithDefaults(req, res, 'build/login-index');
      return;
    }

    this.model.getMyExpBuildId(req.user.username)
      .then(function(buildId) {
        if (!buildId) {
          this.model.getAllExpsWithBuilds()
            .then(function(exps){
              renderWithDefaults(req, res, 'build/index', {exps: exps});
            });
          return;
        }

        this.getBuildFile(req, res);
      }.bind(this));
  },

  postIndex: function(req, res) {
    if (!req.body.expId) {
      this.getIndex(req, res);
      return;
    }

    this.model.putMyExp(req.user.username, req.body.expId)
      .then(function() {
        res.redirect('/my/index.html');
      }.bind(this));
  },

  getBuildFile: function(req, res) {
    this.model.getMyExpBuildId(req.user.username)
      .then(function(buildId) {
        if (!buildId) {
          res.end();
          return;
        }

        express.static(
          path.join(config.buildsPath, buildId)
        )(req, res, function(){res.end();});
      });
  }
};

module.exports = BuildRoutes;