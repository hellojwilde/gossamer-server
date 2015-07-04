let bodyParser = require('body-parser');
let express = require('express');
let ensureVouched = require('../helpers/ensureVouched');
let renderWithDefaults = require('../helpers/renderWithDefaults');

let Promise = require('bluebird');
let GitHub = require('github');
let Routes = require('../helpers/Routes');

let routes = new Routes();

routes.get('/', async function(req, res) {
  if (!req.isAuthenticated()) {
    renderWithDefaults(req, res, 'login-index');
    return;
  }

  let props = await Promise.props({
    isVouched: req.user.isVouched,
    base: this.model.getBranch(this.config.base),
    recent: this.model.getAllBranchesWithBuilds()
  });

  renderWithDefaults(req, res, 'index', props);
});

routes.post('/branch/:branchId/ship', ensureVouched, async function(req, res) {
  await this.actions.branch.enqueueShip(req.params.branchId);
  res.redirect('/');
});

routes.post('/branch/:branchId/unlock', ensureVouched, async function(req, res) {
  await this.model.delBranchLock(req.params.branchId);
  res.redirect('/');
});

module.exports = routes;