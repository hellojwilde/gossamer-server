let bodyParser = require('body-parser');
let crypto = require('crypto')

let Routes = require('../helpers/Routes');

let routes = new Routes();
let parser = bodyParser.json({
  verify: (req, res, buf, encoding) => req.rawBody = buf
});


routes.post('/handler', parser, async function(req, res) {
  let {repository, sender, ref} = req.body;
  let branch = ref.split('/')[2];
  let repoId = [repository.owner.name, repository.name].join(':')
  let branchId = [repoId, branch].join(':');

  let secret = await this.model.getRepoSecret(repoId);

  if (secret !== null) {
    let signature = req.get('X-Hub-Signature');
    let hmac = crypto.createHmac('sha1', secret);
    hmac.update(req.rawBody);

    if ('sha1=' + hmac.digest('hex') !== signature) {
      res.status(401).end();
      return;
    }
  }

  switch(req.get('X-Github-Event')) {
    case 'push':
      await this.actions.branch.enqueueShip(branchId, req.body.sender);
      break;
  }

  res.status(200).end();
});

module.exports = routes;