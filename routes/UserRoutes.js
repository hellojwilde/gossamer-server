var express = require('express');
var passport = require('passport');
var querystring = require('querystring');
var renderWithDefaults = require('../helpers/renderWithDefaults');

function UserRoutes() {
  var router = express.Router();

  router.get('/login', this.getLogin);
  router.get('/logout', this.getLogout);
  router.get('/oauth', this.getOAuth);
  router.get('/oauth/callback', this.getOAuthComplete);

  this.router = router;
}

UserRoutes.prototype = {
  getLogin: function(req, res) {
    renderWithDefaults(req, res, 'login', {
      url: '/user/oauth?' + querystring.stringify({
        redirect: req.query.redirect
      })
    });
  },

  getLogout: function(req, res) {
    req.logout();
    res.redirect('/');
  },

  getOAuth: function(req, res) {
    passport.authenticate('github', {
      failureRedirect: '/user/login',
      scope: ['user:email'],
      state: JSON.stringify({redirect: req.query.redirect})
    })(req, res);
  },

  getOAuthComplete: function(req, res) {
    passport.authenticate('github', {
      failureRedirect: '/user/login',
    })(req, res, function(req, res) {
      var state = JSON.parse(req.query.state);
      res.redirect(state.redirect ? state.redirect : '/');
    }.bind(null, req, res));
  }
}

module.exports = UserRoutes;
