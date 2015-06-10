var express = require('express');
var renderWithDefaults = require('../helpers/renderWithDefaults');

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  if (!req.isAuthenticated()) {
    renderWithDefaults(req, res, 'index');
    return;
  }

  // todo: request a list of experiments
  // todo: determine whether or not we need to show the verifications status 
  // thingy
  
  renderWithDefaults(req, res, 'experiments');
});

module.exports = router;
