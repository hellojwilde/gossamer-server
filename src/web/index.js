let cookieParser = require('cookie-parser');
let express = require('express');
let favicon = require('serve-favicon');
let forceSecure = require('express-force-ssl');
let passport = require('passport');
let path = require('path');
let session = require('express-session');

let errors = require('./helpers/errors');
let logger = require('./helpers/logger');
let renderWithDefaults = require('./helpers/renderWithDefaults');
let serveBuild = require('./helpers/serveBuild');
let {nodeify, nodeifySync} = require('./helpers/methods');
let {getKeyPrefix} = require('../models/Keys');

let APIRoutes = require('./routes/APIRoutes');
let GitHubStrategy = require('passport-github').Strategy;
let IndexRoutes = require('./routes/IndexRoutes');
let RedisSessionStore = require('connect-redis')(session);
let UserRoutes = require('./routes/UserRoutes');
let WebhookRoutes = require('./routes/WebhookRoutes');

function web(registry) {
  let {config, redis, actions} = registry;
  let server = express();

  // authentication setup
  passport.serializeUser(nodeifySync(actions.user.passportSerializeUserSync));
  passport.deserializeUser(nodeify(actions.user.passportDeserializeUser));
  passport.use(new GitHubStrategy({
    clientID: config.githubClientId,
    clientSecret: config.githubClientSecret,
    callbackURL: config.publicUrl + '/user/oauth/callback'
  }, nodeify(actions.user.passportVerifyUser)));

  // view engine setup
  server.set('views', path.join(__dirname, 'views'));
  server.set('view engine', 'jsx');
  server.engine('jsx', require('express-react-views').createEngine());

  // uncomment after placing your favicon in /public
  //server.use(favicon(__dirname + '/public/favicon.ico'));
  server.use(logger(config.dev));
  server.use(cookieParser());
  server.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: function(res, path) {
      let fileName = path.split('/').slice(-1)[0];
      if (fileName === 'manifest.webapp') {
        res.setHeader('Content-Type', 'application/x-web-app-manifest+json');
      }
    }
  }));
  server.use(session({
    resave: false,
    saveUninitialized: false,
    secret: config.sessionSecret,
    store: new RedisSessionStore({client: redis, prefix: getKeyPrefix('sess')})
  }));
  server.use(passport.initialize());
  server.use(passport.session());

  if (!config.dev) {
    server.use(forceSecure);
  }

  // routes setup
  server.use('/', IndexRoutes.getRouterForRegistry(registry));
  server.use('/my', serveBuild(registry));
  server.use('/user', UserRoutes.getRouterForRegistry(registry));
  server.use('/webhook', WebhookRoutes.getRouterForRegistry(registry));
  server.use('/api/v1', APIRoutes.getRouterForRegistry(registry));

  // error handlers setup
  let {handleNotFound, handleError} = errors(config.dev);
  server.use(handleNotFound);
  server.use(handleError)

  return server;
}

module.exports = web;
