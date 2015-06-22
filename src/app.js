var Actions = require('./actions');
var Jackrabbit = require('jackrabbit');
var Model = require('./model');
var Promise = require('bluebird');
var Redis = require('ioredis');

var mapValues = require('lodash.mapvalues');

const CONNECT_TIMEOUT = 5000;

async function app(config) {
  let registry = {config};
  let redis = new Redis(config.redisUrl);
  let queue = Jackrabbit(config.amqpUrl);

  await new Promise((resolve, reject) => {
    queue.on('connected', () => queue.create('build-queue', {}, resolve));
  }).timeout(CONNECT_TIMEOUT);

  let actions = mapValues(Actions, function(set) {
    return mapValues(set, (action) => action.bind(registry));
  });

  return Object.assign(registry, {
    config: config, 
    redis: redis,
    queue: queue,
    model: new Model(config, redis),
    actions: actions
  });
}

module.exports = app;