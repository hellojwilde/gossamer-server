var express = require('express');
var ensureAuthenticated = require('../helpers/ensureAuthenticated');
var renderWithDefaults = require('../helpers/renderWithDefaults');

function IndexRoutes(model) {
  var router = express.Router();

  router.get('/', this.getHome);
  router.get('/exp', ensureAuthenticated, this.getNewExp.bind(this));
  router.post('/exp', ensureAuthenticated, this.postNewExp.bind(this));
  router.get('/exp/:expId', ensureAuthenticated, this.getExp.bind(this));

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
    req.checkBody('urlField', 'URL is missing').notEmpty();
    req.checkBody('urlField', 'URL must be on GitHub').isURL({
      host_whitelist: ['github.com', 'www.github.com']
    });
    req.checkBody('descField', 'Description is missing').notEmpty();

    var errors = req.validationErrors();

    if (errors) {
      renderWithDefaults(req, res, 'new-exp', {
        errors: errors,
        urlField: req.body.urlField,
        descField: req.body.descField
      });
      return;
    }

    // TODO: Check to make sure that we're not registering over somebody else's 
    // experiment. Over the long term, we need to check that we actually are
    // an owner or collaborator on the repo that we're submitting here.

    this.model.putExp(
      req.user.id, 
      req.body.urlField, 
      req.body.descField
    ).then(function(exp) {
      res.redirect('/exp/' + exp.id);
    });
  },

  getExp: function(req, res) {
    // TODO (jwilde): actually render something here
  }
}

module.exports = IndexRoutes;
