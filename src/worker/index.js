function worker(registry) {
  let {queue, actions} = registry;

  queue.handle('build-queue', async function(message, ack) {
    console.log(`Shipping ${message.expId}`);
    await actions.branch.ship(message.expId);
    ack();
  });
}

module.exports = worker;