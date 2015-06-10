var express = require('express');
var ensureAuthenticated = require('../helpers/ensureAuthenticated');
var renderWithDefaults = require('../helpers/renderWithDefaults');

function IndexRoutes(model) {
  var router = express.Router();

  router.get('/', this.getHome);
  router.get('/exp', ensureAuthenticated, this.getNewExp);
  router.post('/exp', ensureAuthenticated, this.postNewExp);
  router.get('/exp/:expHash', ensureAuthenticated, this.getExp);

  this.router = router;
  this.model = model;
}

IndexRoutes.prototype = {
  getHome: function(req, res) {
    if (!req.isAuthenticated()) {
      renderWithDefaults(req, res, 'index');
      return;
    }

    // TODO (jwilde): request a list of experiments for the current user
    
    renderWithDefaults(req, res, 'exps');
  },

  getNewExp: function(req, res) {
    renderWithDefaults(req, res, 'new-exp');
  },

  postNewExp: function(req, res) {
    req.checkBody('titleField', 'Title is missing').notEmpty();
    req.checkBody('urlField', 'URL is missing').notEmpty();
    req.checkBody('urlField', 'URL must be on GitHub').isURL({
      host_whitelist: ['github.com', 'www.github.com']
    });

    var errors = req.validationErrors();
    if (errors) {
      renderWithDefaults(req, res, 'new-exp', {
        errors: errors, 
        titleField: req.body.titleField,
        urlField: req.body.urlField
      });
      return;
    }

    // TODO (jwilde): write to DB and redirect to the experiment page
  },

  getExp: function(req, res) {
    // TODO (jwilde): actually render something here
  }
}

module.exports = IndexRoutes;
