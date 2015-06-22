export default function ensureCollaborator(req, res, next) {
  this.model.haveExpByUsernameId(req.user.username, req.params.expId)
    .then(function(haveExp) {
      if (haveExp) next();
    });
}