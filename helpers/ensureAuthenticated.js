var querystring = require('querystring');

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {return next();}

  res.redirect(
    '/user/login?' + 
    querystring.stringify({redirect: req.path})
  );
}

module.exports = ensureAuthenticated;