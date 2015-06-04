var express = require('express');
var passport = require('passport');
var renderWithDefaults = require('../helpers/renderWithDefaults');

var router = express.Router();

/* GET display login page */
router.get('/login', function(req, res) {
  renderWithDefaults(req, res, 'login');
});

/* GET logout */
router.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

/* GET authenticate */
router.get('/oauth', passport.authenticate('github'));

/* GET resolve final authentication details */
router.get('/oauth/callback', passport.authenticate('github', {
  failureRedirect: '/user/login',
  successRedirect: '/'
}));

module.exports = router;
