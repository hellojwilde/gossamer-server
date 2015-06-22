export default function ensureVouched(req, res, next) {
  if (req.user.isVouched) {
    next();
  }
}