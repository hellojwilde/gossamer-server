var express = require('express');
var assign = require('lodash.assign');

function ensureAPIAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {return next();}
  sendAPIError(res, 'authentication required', 401);
}

function sendAPISuccess(res, data) {
  res.json({data: data});
}

function sendAPIError(res, error, optErrorCode, optDetails) {
  res.status(optErrorCode || 400);
  res.json(assign({}, {error: error, details: optDetails}));
}

function APIRoutes(model) {
  var router = express.Router();

  router.post('/exp/:expId/events', ensureAPIAuthenticated, this.postEvents.bind(this));

  this.router = router;
  this.model = model;
}

APIRoutes.prototype = {
  postEvents: function(req, res) {
    // TODO: validate expId to make sure that it's a real experiment that's 
    // been registered before we do anything else.

    this.model.putExpEvents(
      req.params.expId, 
      req.user.id, 
      req.body.events
    )
      .then(function(numPut) {sendAPISuccess(res, numPut)})
      .catch(function(err) {sendAPIError(res, 500, err)});
  }
};

module.exports = APIRoutes;
