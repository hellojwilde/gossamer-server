let bodyParser = require('body-parser');
let cookieParser = require('cookie-parser');
let express = require('express');
let favicon = require('serve-favicon');
let moment = require('moment');
let passport = require('passport');
let path = require('path');
let session = require('express-session');

let errors = require('./helpers/errors');
let logger = require('./helpers/logger');
let renderWithDefaults = require('./helpers/renderWithDefaults');
let {nodeify, nodeifySync} = require('./helpers/methods');

let APIRoutes = require('./routes/APIRoutes');
let BuildRoutes = require('./routes/BuildRoutes');
let GitHubStrategy = require('passport-github').Strategy;
let IndexRoutes = require('./routes/IndexRoutes');
let RedisSessionStore = require('connect-redis')(session);
let UserRoutes = require('./routes/UserRoutes');

function web(registry) {
  let {model, config, redis, actions} = registry;
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
  server.set('view engine', 'jade');
  server.locals.moment = moment;

  // uncomment after placing your favicon in /public
  //server.use(favicon(__dirname + '/public/favicon.ico'));
  server.use(logger(config.dev));
  server.use(bodyParser.json());
  server.use(bodyParser.urlencoded({extended: false}));
  server.use(cookieParser());
  server.use(express.static(path.join(__dirname, 'public')));
  server.use(session({
    resave: false,
    saveUninitialized: false,
    secret: config.sessionSecret,
    store: new RedisSessionStore({
      client: redis, 
      prefix: model.getKeyPrefix('sess')
    })
  }));
  server.use(passport.initialize());
  server.use(passport.session());

  // routes setup
  server.use('/', IndexRoutes.getRouterForRegistry(registry));
  server.use('/my', BuildRoutes.getRouterForRegistry(registry));
  server.use('/user', UserRoutes.getRouterForRegistry(registry));
  server.use('/api/v1', APIRoutes.getRouterForRegistry(registry));

  // error handlers setup
  let {handleNotFound, handleError} = errors(config.dev);
  server.use(handleNotFound);
  server.use(handleError)

  return server;
}

module.exports = web;
