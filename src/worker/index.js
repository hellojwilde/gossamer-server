function worker(registry) {
  let {queue, actions} = registry;

  queue.handle('build-queue', async function(message, ack) {
    console.log(`Shipping ${message.expId}`);
    await actions.exp.ship(message.expId);
    ack();
  });
}

module.exports = worker;