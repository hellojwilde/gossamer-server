var express = require('express');
var assign = require('lodash.assign');

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

  router.get('/exp/:expId/builds/latest', this.getExpLatestBuild.bind(this));
  router.post('/exp/:expId/events', this.postEvents.bind(this));

  this.router = router;
  this.model = model;
}

APIRoutes.prototype = {
  getExpLatestBuild: function(req, res) {
    sendify(
      this.model.getLatestExpBuild(
        req.params.expId, 
        req.protocol + '://' + req.get('host')
      ),
      res
    );
  },

  postEvents: function(req, res) {
    this.model.haveExpById(req.params.expId).then(function(haveExp) {
      if (!haveExp) {
        sendAPIError(res, 400, 'The experiment does not exist.');
        return;
      }

      sendify(
        this.model.putExpEvents(req.params.expId, req.body.events),
        res
      );
    });   
  }
};

module.exports = APIRoutes;
