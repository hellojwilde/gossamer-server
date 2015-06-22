var express = require('express');
var ensureAuthenticated = require('../helpers/ensureAuthenticated');
var renderWithDefaults = require('../helpers/renderWithDefaults');
var fetchGitHubArchiveAndDeploy = require('../helpers/fetchGitHubArchiveAndDeploy');

var Promise = require('bluebird');
var GitHub = require('github');

function IndexRoutes(config, model) {
  var router = express.Router();

  router.get('/', this.getIndex.bind(this));
  router.get('/new-exp', ensureAuthenticated, this._ensureVouched.bind(this), this.getNewExp.bind(this));
  router.post('/new-exp', ensureAuthenticated, this._ensureVouched.bind(this), this.postNewExp.bind(this));
  router.get('/exp/:expId', ensureAuthenticated, this._ensureCollaborator.bind(this), this.getExp.bind(this));
  router.post('/exp/:expId/ship', ensureAuthenticated, this._ensureVouched.bind(this), this._ensureCollaborator.bind(this), this.postExpShip.bind(this));

  this.router = router;
  this.config = config;
  this.model = model;
}

IndexRoutes.prototype = {
  _ensureVouched: function(req, res, next) {
    if (req.user.isVouched) {
      next();
    }
  },

  _ensureCollaborator: function(req, res, next) {
    this.model.haveExpByUsernameId(req.user.username, req.params.expId)
      .then(function(haveExp) {
        if (haveExp) next();
      });
  },

  getIndex: function(req, res) {
    if (!req.isAuthenticated()) {
      renderWithDefaults(req, res, 'login-index');
      return;
    }

    Promise.props({
      exps: this.model.getExpsByUsername(req.user.username),
      news: this.model.getAllNewsItems()
    }).then(function(props) {
      renderWithDefaults(req, res, 'index', props);
    });
  },

  getNewExp: function(req, res) {
    var github = new GitHub({version: '3.0.0'});

    if (!req.query.repo && !req.query.branch) {
      github.repos.getFromUser({
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
      github.repos.getBranches({
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

      var github = new GitHub({version: '3.0.0'});
      github.authenticate({type: 'oauth', token: req.user.accessToken});
      github.repos.getCollaborators({
        user: req.user.username,
        repo: req.body.repo
      }, function(err, collaborators) {
        if (err) {
          renderWithError('Something went wrong with GitHub.');
          return;
        }

        Promise.join(
          this.model.putExp(
            req.user.username, 
            req.body.repo, 
            req.body.branch,
            collaborators.map(function(collaborator) {
              return collaborator.login;
            }),
            req.body.title
          ),
          this.model.putNewsItem(
            req.user.profile,
            {
              type: 'newExp',
              title: req.body.title,
              id: id,
              owner: req.body.owner,
              repo: req.body.repo,
              branch: req.body.branch,
            }
          )
        ).then(function() {res.redirect('/exp/' + id)});
      }.bind(this));
    }.bind(this));
  },

  getExp: function(req, res) {
    Promise.props({
      exp: this.model.getExpById(req.params.expId),
      builds: this.model.getAllExpBuilds(req.params.expId),
      eventTypes: this.model.getExpEventTypes(req.params.expId)
    }).then(function(props) {
      renderWithDefaults(req, res, 'exp', props);
    });
  },

  postExpShip: function(req, res) {
    var parsedId = req.params.expId.split(':');
    var github = new GitHub({version: '3.0.0'});

    Promise.all([
      Promise.promisify(github.repos.getArchiveLink)({
        user: parsedId[0],
        repo: parsedId[1],
        ref: parsedId[2],
        archive_format: 'tarball'
      }),
      Promise.promisify(github.repos.getBranch)({
        user: parsedId[0],
        repo: parsedId[1],
        branch: parsedId[2]
      })
    ]).then(function(results) {
      var archiveUrl = results[0].meta.location;
      var commit = results[1].commit;

      Promise.all([
        this.model.putExpBuild(req.user.profile, req.params.expId, commit)
          .then(function(id) {
            return fetchGitHubArchiveAndDeploy(
              this.config,
              req.params.expId, 
              id, 
              archiveUrl
            ).return(id);
          }.bind(this)),
        this.model.getExpById(req.params.expId),
      ]).then(function(results) {
        return this.model.putNewsItem(
          req.user.profile,
          {
            type: 'newExpBuild',
            id: results[0],
            exp: results[1],
            commit: commit
          }
        ).then(function() {
          res.redirect('/exp/' + req.params.expId);
        });
      }.bind(this)); 
    }.bind(this))
  }
}

module.exports = IndexRoutes;
