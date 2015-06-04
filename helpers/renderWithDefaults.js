var assign = require('lodash.assign');

function renderWithDefaults(req, res, template, options) {
  res.render(template, assign({
    title: 'Gossamer',
    isAuthenticated: req.isAuthenticated(),
    user: req.user
  }, options || {}));
}

module.exports = renderWithDefaults;