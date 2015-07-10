let Routes = require('../helpers/Routes');

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

let routes = new Routes();

routes.get('/my/latest', async function(req, res) {
  const username = req.user && req.user.username;
  const branchId = await this.models.user.getBranch(username);
  const buildId = await this.models.branch.getLatestBuildId(branchId);

  sendAPISuccess(res, [branchId, buildId].join('/'));
});

module.exports = routes;
