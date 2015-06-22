let express = require('express');
let passport = require('passport');
let querystring = require('querystring');
let renderWithDefaults = require('../helpers/renderWithDefaults');

let Routes = require('../helpers/Routes');

let routes = new Routes();

routes.get('/login', function(req, res) {
  renderWithDefaults(req, res, 'login', {
    url: '/user/oauth?' + querystring.stringify({
      redirect: req.query.redirect
    })
  });
});

routes.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

routes.get('/oauth', function(req, res, next) {
  passport.authenticate('github', {
    failureRedirect: '/user/login',
    scope: ['user:email', 'public_repo'],
    state: JSON.stringify({redirect: req.query.redirect})
  })(req, res, next);
});

routes.get('/oauth/callback', passport.authenticate('github', {
  failureRedirect: '/user/login'
}), function(req, res) {
  // TODO: Make sure we validate this URL before doing any redirects.
  let state = JSON.parse(req.query.state);
  res.redirect(state.redirect || '/');
});

module.exports = routes;
