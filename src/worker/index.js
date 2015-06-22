function worker(registry) {
  let {queue, actions} = registry;

  queue.subscribe({ack: true}, async function(message) {
    console.log(`Shipping ${message.expId}`);
    await actions.exp.ship(message.expId);
    queue.shift();
  });
}

module.exports = worker;