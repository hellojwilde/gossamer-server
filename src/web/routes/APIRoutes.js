var Routes = require('../helpers/Routes');

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

function sendify(promised, res) {
  promised.then(
    function(data) {sendAPISuccess(res, data);},
    function(err) {sendAPIError(res, err);}
  );
}

let routes = new Routes();

routes.get('/my/latest', ensureAPIAuthenticated, function(req, res) {
  sendify(this.model.getMyExpBuildId(
    req.user.username, 
    this.config.publicUrl
  ), res);
});

routes.post('/my', ensureAPIAuthenticated, async function(req, res) {
  let buildId = await this.model.getLatestExpBuildId(req.body.expId);

  if (!buildId) {
    sendAPIError(res, 400, 'That expId does not have builds.');
    return;
  }
  sendify(this.model.putMyExp(req.user.username, res.body.expId), res);
});

routes.post('/my', ensureAPIAuthenticated, function(req, res) {
  let expId = this.model.getMyExp(req.user.username);

  if (!expId) {
    sendAPIError(res, 400, 'User is not enrolled in any experiments.');
    return;
  }
  sendify(this.model.putExpEvents(expId, req.body.events), res);
});

module.exports = routes;
