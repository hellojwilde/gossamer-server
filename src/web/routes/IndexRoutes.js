let express = require('express');
let ensureAuthenticated = require('../helpers/ensureAuthenticated');
let ensureCollaborator = require('../helpers/ensureCollaborator');
let ensureVouched = require('../helpers/ensureVouched');
let renderWithDefaults = require('../helpers/renderWithDefaults');

let Promise = require('bluebird');
let GitHub = require('github');
let Routes = require('../helpers/Routes');

let routes = new Routes();

routes.get('/', async function (req, res) {
  if (!req.isAuthenticated()) {
    renderWithDefaults(req, res, 'login-index');
    return;
  }

  let exps = await this.model.getExpsByUsername(req.user.username);
  renderWithDefaults(req, res, 'index', {exps});
});

routes.get('/exp/new', ensureAuthenticated, ensureVouched, function (req, res) {
  let github = new GitHub({version: '3.0.0'});

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
    return;
  }

  if (!req.query.branch) {
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
    });
    return;
  }

  renderWithDefaults(req, res, 'new-exp/3-meta', {
    repo: req.query.repo,
    branch: req.query.branch,
    step: 3,
    steps: 3
  });
});

routes.post('/exp/new', ensureAuthenticated, ensureVouched, async function (req, res) {
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

  let {username, profile, accessToken} = req.user;
  let {repo, branch, title} = req.body;

  if (!title || title.length === 0) {
    renderWithError('Title is blank. We need a title.');
    return;
  }
  
  let expId = this.model.getExpId(username, repo, branch);
  let expIdExists = await this.model.haveExpById(expId);
  if (expIdExists) {
    renderWithError('There is already an experiment for this branch.')
    return;
  }

  let github = new GitHub({version: '3.0.0'});
  github.authenticate({type: 'oauth', token: accessToken});

  let collaborators = await Promise.map(
    Promise.promisify(github.repos.getCollaborators)({
      user: username, 
      repo: repo
    }),
    (collaborator) => collaborator.login
  );

  await this.model.putExp(username, repo, branch, collaborators, title);

  res.redirect('/exp/' + expId);
});

routes.get('/exp/:expId', ensureAuthenticated, ensureCollaborator, async function(req, res) {
  let {expId} = req.params;
  let props = await Promise.props({
    exp: this.model.getExpById(expId),
    builds: this.model.getAllExpBuilds(expId),
    buildLock: this.model.getExpBuildLock(expId),
    buildLockMeta: this.model.getExpBuildLockMeta(expId)
  });

  renderWithDefaults(req, res, 'exp', props);
});

routes.post('/exp/:expId/ship', ensureAuthenticated, ensureCollaborator, async function(req, res) {
  await this.actions.branch.enqueueShip(req.params.expId, req.user.profile);
  res.redirect('/exp/' + req.params.expId);
});

routes.post('/exp/:expId/ship/unlock', ensureAuthenticated, ensureCollaborator, async function(req, res) {
  await this.model.delExpBuildLock(req.params.expId);
  res.redirect('/exp/' + req.params.expId);
});

module.exports = routes;