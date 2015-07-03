let Routes = require('../helpers/Routes');

let routes = new Routes();

routes.post('/handler', async function(req, res) {
  let event = req.get('X-Github-Event');
  let signature = req.get('X-Hub-Signature');

  let {repository, sender, ref} = req.body;
  let branch = ref.split('/')[2];
  let branchId = [repository.owner.name, repository.name, branch].join(':');

  console.log('HOOK called for ' + branchId);

  // TODO: Validate signature for repoId.

  switch(event) {
    case 'push':
      await this.actions.branch.enqueueShip(branchId, req.body.sender);
      break;
  }

  res.status(200).end();
});

module.exports = routes;