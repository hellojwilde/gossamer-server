var express = require('express');
var ensureAuthenticated = require('../helpers/ensureAuthenticated');
var renderWithDefaults = require('../helpers/renderWithDefaults');

function IndexRoutes(model, github) {
  var router = express.Router();

  router.get('/', this.getIndex.bind(this));
  router.get('/new-exp', ensureAuthenticated, this.getNewExp.bind(this));
  router.post('/new-exp', ensureAuthenticated, this.postNewExp.bind(this));
  router.get('/exp/:expId', ensureAuthenticated, this.getExp.bind(this));

  this.router = router;
  this.model = model;
  this.github = github;
}

IndexRoutes.prototype = {
  getIndex: function(req, res) {
    if (!req.isAuthenticated()) {
      renderWithDefaults(req, res, 'placeholder');
      return;
    }

    this.model.getExpsByUsername(req.user.username).then(function(exps) {
      renderWithDefaults(req, res, 'index', {exps: exps});
    });
  },

  getNewExp: function(req, res) {
    if (!req.query.repo && !req.query.branch) {
      this.github.repos.getFromUser({
        user: req.user.username,
        sort: 'pushed',
        type: 'owner'
      }, function(err, repos) {
        renderWithDefaults(req, res, 'new-exp/1-repo', {
          repos: repos,
          step: 1,
          steps: 3
        });
      });
    } else if (!req.query.branch) {
      this.github.repos.getBranches({
        user: req.user.username,
        repo: req.query.repo,
      }, function(err, branches) {
        renderWithDefaults(req, res, 'new-exp/2-branch', {
          repo: req.query.repo,
          branches: branches,
          step: 2,
          steps: 3
        });
      })
    } else {
      renderWithDefaults(req, res, 'new-exp/3-meta', {
        repo: req.query.repo,
        branch: req.query.branch,
        step: 3,
        steps: 3
      });
    }
  },

  postNewExp: function(req, res) {
    function renderWithError(error) {
      renderWithDefaults(req, res, 'new-exp/3-meta', {
        error: error,
        expTitle: req.body.title,
        repo: req.body.repo,
        branch: req.body.branch,
        step: 3,
        steps: 3
      });
    }

    if (!req.body.title || req.body.title.length === 0) {
      renderWithError('Title is blank. We need a title.');
      return;
    }

    var id = this.model.getExpId(
      req.user.username, 
      req.body.repo, 
      req.body.branch
    );

    this.model.haveExpById(id).then(function(exists) {
      if (exists) {
        renderWithError('There is already an experiment for this branch.')
        return;
      }

      console.log(req.user.accessToken, req.body.repo, req.user.username);

      this.github.authenticate({type: 'oauth', token: req.user.accessToken});
      this.github.repos.getCollaborators({
        user: req.user.username,
        repo: req.body.repo
      }, function(err, collaborators) {
        if (err) {
          console.log(err);
          renderWithError('Something went wrong with GitHub.');
          return;
        }

        console.log(collaborators);

        this.model.putExp(
          req.user.username, 
          req.body.repo, 
          req.body.branch,
          collaborators.map(function(collaborator) {
            return collaborator.login;
          }),
          req.body.title
        ).then(function() {
          res.redirect('/exp/' + id);
        })
      }.bind(this));
    }.bind(this));
  },

  getExp: function(req, res) {
    // TODO (jwilde): actually render something here
  }
}

module.exports = IndexRoutes;
