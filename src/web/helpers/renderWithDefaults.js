export default function renderWithDefaults(req, res, template, options) {
  res.render(template, Object.assign({
    title: 'Gossamer',
    isAuthenticated: req.isAuthenticated(),
    user: req.user
  }, options || {}));
}