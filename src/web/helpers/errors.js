var renderWithDefaults = require('./renderWithDefaults');

export default function errors(dev) {
  return {
    handleNotFound: function(req, res, next) {
      var err = new Error('Not Found');
      err.status = 404;
      next(err);
    },

    handleError: function(err, req, res, next) {
      res.status(err.status || 500);
      renderWithDefaults(req, res, 'error', {
        message: err.message,
        error: dev ? err : {}
      });
    }
  };
}
