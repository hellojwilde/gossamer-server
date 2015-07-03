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

function sendify(promised, res) {
  promised.then(
    function(data) {sendAPISuccess(res, data);},
    function(err) {sendAPIError(res, err);}
  );
}

let routes = new Routes();

routes.get('/my/latest', ensureAPIAuthenticated, function(req, res) {
  sendify(
    this.model.getMyExpBuild(req.user.username)
     .then((build) => build.join('/')),
    res
  );
});

routes.post('/my', ensureAPIAuthenticated, async function(req, res) {
  let build = await this.model.getLatestExpBuild(req.body.expId);
  if (build) {
    sendify(this.model.putMyExp(req.user.username, res.body.expId), res);
  } else {
    sendAPIError(res, 400, 'That expId does not have builds.');
  }
});

module.exports = routes;
