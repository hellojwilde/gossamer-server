const Routes = require('../helpers/Routes');
const Promise = require('bluebird');

function ensureAPIAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {return next();}
  sendAPIError(res, 'authentication required', 401);
}

function sendAPISuccess(res, data) {
  res.set('Access-Control-Allow-Origin', '*');
  res.json(data);
}

function sendAPIError(res, error, optErrorCode, optDetails) {
  res.set('Access-Control-Allow-Origin', '*');
  res.status(optErrorCode || 500);
  res.json(Object.assign({}, {error: error, details: optDetails}));
}

function formatAPIBranch({branchId}) {
  return {branchId};
}

let routes = new Routes();

routes.get('/branches', async function(req, res) {
  let [base, recent] = await Promise.all([
    this.models.branch.get(this.config.base),
    this.models.branch.getAllWithBuilds()
  ]);

  sendAPISuccess(res, {
    base: formatAPIBranch(base),
    recent: recent
      .filter((branch) => branch.branchId !== base.branchId)
      .map(formatAPIBranch)
  });
});

routes.get('/my', async function(req, res) {
  const username = req.user && req.user.username;
  const branchId = await this.models.user.getBranch(username);

  sendAPISuccess(res, {
    isAuthenticated: req.isAuthenticated(),
    branchId: branchId
  });
});

routes.post('/my', ensureAPIAuthenticated, async function(req, res) {
  await this.models.user.putBranch(req.user.username, req.params.branchId);

  sendAPISuccess(res, {
    isAuthenticated: req.isAuthenticated(),
    branchId: req.params.branchId,
    baseBranchId: this.config.base
  })
});

routes.get('/my/latest', async function(req, res) {
  const username = req.user && req.user.username;
  const branchId = await this.models.user.getBranch(username);
  const buildId = await this.models.branch.getLatestBuildId(branchId);

  sendAPISuccess(res, [branchId, buildId].join('/'));
});

module.exports = routes;
