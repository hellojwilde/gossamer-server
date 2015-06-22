var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var express = require('express');
var favicon = require('serve-favicon');
var logger = require('morgan');
var moment = require('moment');
var passport = require('passport');
var path = require('path');
var session = require('express-session');

var fetchGitHubUserVouch = require('./helpers/fetchGitHubUserVouch');
var renderWithDefaults = require('./helpers/renderWithDefaults');
var doneify = require('./helpers/doneify');

var APIRoutes = require('./routes/APIRoutes');
var BuildRoutes = require('./routes/BuildRoutes');
var GithubStrategy = require('passport-github').Strategy;
var IndexRoutes = require('./routes/IndexRoutes');
var Model = require('./model');
var Redis = require('ioredis');
var RedisSessionStore = require('connect-redis')(session);
var UserRoutes = require('./routes/UserRoutes');

function web(config) {
  var server = express();
  var redis = new Redis(config.redisUrl);
  var model = new Model(config, redis);

  // authentication setup
  passport.serializeUser(function(user, done) {
    done(null, user.username);
  });

  passport.deserializeUser(function(username, done) {
    doneify(model.getUserByUsername(username), done);
  });

  passport.use(new GithubStrategy(
    {
      clientID: config.githubClientId,
      clientSecret: config.githubClientSecret,
      callbackURL: config.publicUrl + '/user/oauth/callback'
    },
    function(accessToken, _refreshToken, profile, done) {
      doneify(
        fetchGitHubUserVouch(accessToken, config.mozilliansApiKey)
          .then(function(isVouched) {
            return model.putUser(profile, accessToken, isVouched)
          }),
        done
      );
    }
  ));

  // view engine setup
  server.set('views', path.join(__dirname, 'views'));
  server.set('view engine', 'jade');
  server.locals.moment = moment;

  // uncomment after placing your favicon in /public
  //server.use(favicon(__dirname + '/public/favicon.ico'));
  server.use(logger('dev'));
  server.use(bodyParser.json());
  server.use(bodyParser.urlencoded({ extended: false }));
  server.use(cookieParser());
  server.use(express.static(path.join(__dirname, 'public')));
  server.use(session({
    resave: false,
    saveUninitialized: false,
    secret: config.sessionSecret,
    store: new RedisSessionStore({client: redis, prefix: 'gos:sess:'})
  }));
  server.use(passport.initialize());
  server.use(passport.session());

  // routes setup
  server.use('/', new IndexRoutes(config, model).router);
  server.use('/my', new BuildRoutes(config, model).router);
  server.use('/user', new UserRoutes(config).router);
  server.use('/api/v1', new APIRoutes(config, model).router);

  // serverly error handlers

  // catch 404 and forward to error handler
  server.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
  });

  // error handlers

  // development error handler
  // will print stacktrace
  if (server.get('env') === 'development') {
    server.use(function(err, req, res, next) {
      res.status(err.status || 500);
      renderWithDefaults(req, res, 'error', {
        message: err.message,
        error: err
      });
    });
  }

  // production error handler
  // no stacktraces leaked to user
  server.use(function(err, req, res, next) {
    res.status(err.status || 500);
    renderWithDefaults(req, res, 'error', {
      message: err.message,
      error: {}
    });
  });

  return server;
}

module.exports = web;
