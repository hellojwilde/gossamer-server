var express = require('express');
var passport = require('passport');

var router = express.Router();

router.get('/login', function(req, res) {
  res.render('login', {user: req.user});
});

/* GET authenticate */
router.get('/oauth', passport.authenticate('github'));

/* GET resolve final authentication details */
router.get('/oauth/callback', passport.authenticate('github', {
  failureRedirect: '/login',
  successRedirect: '/'
}));

module.exports = router;
