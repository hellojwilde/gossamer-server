var express = require('express');
var passport = require('passport');
var querystring = require('querystring');
var renderWithDefaults = require('../helpers/renderWithDefaults');

var router = express.Router();

/* GET display login page */
router.get('/login', function(req, res) {
  renderWithDefaults(req, res, 'login', {
    url: '/user/oauth?' + querystring.stringify({
      redirect: req.query.redirect
    })
  });
});

/* GET logout */
router.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

/* GET authenticate */
router.get('/oauth', function(req, res) {
  passport.authenticate('github', {
    failureRedirect: '/user/login',
    scope: ['user:email'],
    state: JSON.stringify({redirect: req.query.redirect})
  })(req, res);
});

/* GET resolve final authentication details */
router.get('/oauth/callback', passport.authenticate('github', {
  failureRedirect: '/user/login',
}), function(req, res) {
  var state = JSON.parse(req.query.state);
  res.redirect(state.redirect ? state.redirect : '/');
});

module.exports = router;
