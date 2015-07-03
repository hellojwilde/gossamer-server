let express = require('express');
let ensureAuthenticated = require('../helpers/ensureAuthenticated');
let renderWithDefaults = require('../helpers/renderWithDefaults');
let path = require('path');
let mime = require('mime');

let Routes = require('../helpers/Routes');

let routes = new Routes();

async function sendBuildFile([expId, buildId], req, res, next) {
  let filePath = req.path.slice(1);
  let file = await this.model.getExpBuildFile(expId, buildId, filePath);

  if (file === null) {
    next();
    return;
  }

  let fileContent = file.buffer;

  if (filePath === 'main.js') {
    fileContent = file.buffer.toString().replace(
      '{/* INJECTED_UPDATER_INFO */}',
      JSON.stringify({
        latestBuildIdUrl: this.config.publicUrl + '/api/v1/my/latest',
        buildId: [expId, buildId].join('/')
      })
    );
  }

  res.set('ETag', file.digest);
  res.set('Content-Type', mime.lookup(filePath));
  res.send(fileContent);
}

routes.get('/index.html', async function(req, res, next) {
  if (!req.isAuthenticated()) {
    renderWithDefaults(req, res, 'build/login-index');
    return;
  }

  let build = await this.model.getMyExpBuild(req.user.username);
  if (build === null) {
    let exps = await this.model.getAllExpsWithBuilds();
    renderWithDefaults(req, res, 'build/index', {exps});
    return;
  }

  sendBuildFile.call(this, build, req, res, next);
});

routes.post('/index.html', ensureAuthenticated, async function(req, res) {
  if (req.body.expId) {
    await this.model.putMyExp(req.user.username, req.body.expId);
  }

  res.redirect('/my/index.html');
});

routes.get('/*', ensureAuthenticated, async function(req, res, next) {
  let build = await this.model.getMyExpBuild(req.user.username);

  if (build === null) {
    res.end();
    return;
  }

  sendBuildFile.call(this, build, req, res, next);
});

module.exports = routes;
