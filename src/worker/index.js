function worker(registry) {
  let {queue, actions} = registry;

  queue.handle('build-queue', async function(message, ack) {
    console.log(`Shipping ${message.branchId}`);

    try {
      await actions.branch.ship(message.branchId);
      console.log(`Success shipping ${message.branchId}`);
    } catch(e) {
      console.log(`Failure shipping ${message.branchId}`);
    }

    ack();
  });
}

module.exports = worker;