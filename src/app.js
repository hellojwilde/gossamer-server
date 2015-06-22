var Actions = require('./actions');
var AMQP = require('amqp');
var Model = require('./model');
var Promise = require('bluebird');
var Redis = require('ioredis');

var mapValues = require('lodash.mapvalues');

const CONNECT_TIMEOUT = 5000;

async function app(config) {
  let registry = {config};
  let redis = new Redis(config.redisUrl);
  let amqp = new AMQP.createConnection(config.amqpUrl);

  let queue = await new Promise((resolve, reject) => {
    amqp.on('ready', () => {
      amqp.queue('build-queue', {durable: true}, resolve);
    });
  }).timeout(CONNECT_TIMEOUT);

  let actions = mapValues(Actions, function(set) {
    return mapValues(set, (action) => action.bind(registry));
  });

  return Object.assign(registry, {
    config: config, 
    connections: {amqp, redis},
    model: new Model(config, redis),
    queue: queue,
    actions: actions
  });
}

module.exports = app;