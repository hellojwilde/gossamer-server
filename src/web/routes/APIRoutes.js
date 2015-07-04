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
  let build = await this.model.getMyBranchBuild(req.user && req.user.username);
  sendAPISuccess(res, build.join('/'));
});

module.exports = routes;
