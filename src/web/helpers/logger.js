var morgan = require('morgan');

export default function logger(dev) {
  return morgan('dev', {
    skip: (req, res) => !dev && res.statusCode < 400
  });
}