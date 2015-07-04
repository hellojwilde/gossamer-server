function ensureVouched(req, res, next) {
  if (req.user && req.user.isVouched) {
    next();
  }
}

module.exports = ensureVouched;