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
    renderWithDefaults(req, res, 'IndexLoginPage');
    return;
  }

  let props = await Promise.props({
    isVouched: req.user.isVouched,
    base: this.models.branch.get(this.config.base),
    recent: this.models.branch.getAllWithBuilds()
  });

  renderWithDefaults(req, res, 'IndexPage', props);
});

routes.get('/branch/:branchId/json', async function(req, res) {
  let latest = await this.models.branch.getLatestBuild(req.params.branchId);

  if (latest && latest.webpackJson) {
    res.json(latest.webpackJson);
  } else {
    res.status(404).end();
  }
});

routes.post('/branch/:branchId/ship', ensureVouched, async function(req, res) {
  await this.actions.branch.enqueueShip(req.params.branchId);
  res.redirect('/');
});

routes.post('/branch/:branchId/unlock', ensureVouched, async function(req, res) {
  await this.models.branch.delLock(req.params.branchId);
  res.redirect('/');
});

module.exports = routes;