var express = require('express');
var assign = require('lodash.assign');
var getBaseUrl = require('../helpers/getBaseUrl');

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
  res.json(assign({}, {error: error, details: optDetails}));
}

function sendify(promised, res) {
  promised.then(
    function(data) {sendAPISuccess(res, data);},
    function(err) {sendAPIError(res, err);}
  );
}

function APIRoutes(model) {
  var router = express.Router();

  router.get('/my/latest', ensureAPIAuthenticated, this.getMyExpLatestBuild.bind(this));
  router.post('/my', ensureAPIAuthenticated, this.postMyExp.bind(this));
  router.post('/my/events', ensureAPIAuthenticated, this.postMyExpEvents.bind(this));

  this.router = router;
  this.model = model;
}

APIRoutes.prototype = {
  getMyExpLatestBuild: function(req, res) {
    sendify(this.model.getMyExpBuildId(req.user.username, getBaseUrl(req)), res);
  },

  postMyExp: function(req, res) {
    this.model.getLatestExpBuildId(req.body.expId).then(function(buildId) {
      if (!buildId) {
        sendAPIError(res, 400, 'That expId does not have builds.');
        return;
      }
      sendify(this.model.putMyExp(req.user.username, res.body.expId), res);
    });
  },

  postMyExpEvents: function(req, res) {
    this.model.getMyExp(req.user.username).then(function(expId) {
      if (!expId) {
        sendAPIError(res, 400, 'User is not enrolled in any experiments.');
        return;
      }
      sendify(this.model.putExpEvents(expId, req.body.events), res);
    });   
  }
};

module.exports = APIRoutes;
