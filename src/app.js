let Actions = require('./actions');
let Jackrabbit = require('jackrabbit');
let Models = require('./models');
let Postgres = require('pg-promise')({promiseLib: require('bluebird')});
let Promise = require('bluebird');
let Redis = require('ioredis');

let mapValues = require('lodash.mapvalues');
let path = require('path');

const CONNECT_TIMEOUT = 5000;

async function app(config) {
  let dir = path.dirname(__dirname);
  let redis = new Redis(config.redisUrl);
  let pg = Postgres(config.pgUrl);
  let queue = Jackrabbit(config.amqpUrl);
  let registry = {dir, config, redis, pg, queue};

  await new Promise((resolve, reject) => {
    queue.on('connected', () => queue.create('build-queue', {}, resolve));
    queue.on('disconnected', (err) => err && reject(err));
  }).timeout(CONNECT_TIMEOUT);

  registry.models = mapValues(Models, (model) => new model(registry));
  registry.actions = mapValues(Actions, function(set) {
    return mapValues(set, (action) => action.bind(registry));
  });

  return registry;
}

module.exports = app;