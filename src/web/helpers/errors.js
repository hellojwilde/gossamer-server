let renderWithDefaults = require('./renderWithDefaults');

function errors(dev) {
  return {
    handleNotFound: function(req, res, next) {
      let err = new Error('Not Found');
      err.status = 404;
      next(err);
    },

    handleError: function(err, req, res, next) {
      res.status(err.status || 500);
      renderWithDefaults(req, res, 'ErrorPage', {
        message: err.message,
        error: dev ? err : {}
      });
    }
  };
}

module.exports = errors;