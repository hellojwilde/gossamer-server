var express = require('express');
var ensureAuthenticated = require('../helpers/ensureAuthenticated');
var renderWithDefaults = require('../helpers/renderWithDefaults');

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  if (!req.isAuthenticated()) {
    renderWithDefaults(req, res, 'index');
    return;
  }

  // TODO (jwilde): request a list of experiments for the current user
  
  renderWithDefaults(req, res, 'exps');
});

/* GET experiment creator page. */
router.get('/exp', ensureAuthenticated, function(req, res) {
  renderWithDefaults(req, res, 'new-exp');
});

/* POST experiment creator save page. */
router.post('/exp', ensureAuthenticated, function(req, res) {
  req.checkBody('title', 'Title is missing').notEmpty();
  req.checkBody('url', 'URL is missing').notEmpty();
  req.checkBody('url', 'URL must be on GitHub').isURL({
    host_whitelist: ['github.com', 'www.github.com']
  });

  var errors = req.validationErrors();
  if (errors) {
    console.log(errors)
    renderWithDefaults(req, res, 'new-exp', {
      errors: errors, 
      title: req.body.title,
      url: req.body.url
    });
    return;
  }

  // TODO (jwilde): write to DB and redirect to the experiment page
});

/* GET experiment detail page. */
router.get('/exp/:experiment', ensureAuthenticated, function(req, res) {
  // TODO (jwilde): actually render something here
});

module.exports = router;
