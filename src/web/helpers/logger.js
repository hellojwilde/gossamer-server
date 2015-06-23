let morgan = require('morgan');

function logger(dev) {
  return morgan('dev', {
    skip: (req, res) => !dev && res.statusCode < 400
  });
}

module.exports = logger;