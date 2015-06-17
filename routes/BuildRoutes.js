var express = require('express');
var ensureAuthenticated = require('../helpers/ensureAuthenticated');
var renderWithDefaults = require('../helpers/renderWithDefaults');
var config = require('../config');
var path = require('path');

function BuildRoutes(model) {
  var router = express.Router();

  router.get('/manifest.webapp', this.getManifest.bind(this));
  router.get('/index.html', ensureAuthenticated, this.getIndex.bind(this));
  router.get('/*', ensureAuthenticated, this._ensureExperiment.bind(this), this.getBuildFile.bind(this));

  this.model = model;
  this.router = router;
}

BuildRoutes.prototype = {
  _ensureExperiment: function(req, res, next) {
    this.model.getMyExpBuildId(req.user.username).then(function(buildId) {
      if (buildId) {
        req.buildId = buildId;
        next();
      } else {
        res.end();
      }
    })
  },

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
    if (req.buildId) {
      this.getBuildFile(req, res);
      return;
    }

    res.json({hi: true});
  },

  getBuildFile: function(req, res) {
    express.static(
      path.join(config.buildsPath, req.buildId)
    )(req, res, function(){res.end();});
  }
};

module.exports = BuildRoutes;