var express = require('express');
var renderWithDefaults = require('../helpers/renderWithDefaults');

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  if (!req.isAuthenticated()) {
    renderWithDefaults(req, res, 'index');
    return;
  }

  renderWithDefaults(req, res, 'experiments');
});

module.exports = router;
