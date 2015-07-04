function renderWithDefaults(req, res, template, options) {
  res.render(template, Object.assign({
    title: 'Gossamer',
    isAuthenticated: req.isAuthenticated(),
    isVouched: req.user && req.user.isVouched,
    user: req.user
  }, options || {}));
}

module.exports = renderWithDefaults;