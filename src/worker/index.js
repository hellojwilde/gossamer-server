function worker(registry) {
  let {queue, actions} = registry;

  queue.handle('build-queue', async function(message, ack) {
    console.log(`Shipping ${message.branchId}`);
    await actions.branch.ship(message.branchId);
    ack();
  });
}

module.exports = worker;