var assign = require('lodash.assign');
var bodyParser = require('body-parser');
var config = require('./config');
var cookieParser = require('cookie-parser');
var express = require('express');
var expressValidator = require('express-validator');
var favicon = require('serve-favicon');
var isGitHubUserVouched = require('./helpers/isGitHubUserVouched');
var logger = require('morgan');
var passport = require('passport');
var path = require('path');
var session = require('express-session');

var GithubStrategy = require('passport-github').Strategy;
var GithubApi = require('github');
var Redis = require('ioredis');
var Promise = require('bluebird');
var Model = require('./model');
var APIRoutes = require('./routes/APIRoutes');
var IndexRoutes = require('./routes/IndexRoutes');
var UserRoutes = require('./routes/UserRoutes');

var app = express();
var redis = new Redis();
var github = new GithubApi({version: '3.0.0'});
var model = new Model(redis);

function doneify(promised, done) {
  promised.then(
    function(returnValue) {done(null, returnValue)},
    function(err) {done(err)}
  ) 
}

// authentication setup
passport.use(new GithubStrategy(
  {
    clientID: config.githubClientId,
    clientSecret: config.githubClientSecret,
    callbackURL: config.githubCallbackUrl
  },
  function(accessToken, _refreshToken, profile, done) {
    doneify(
      isGitHubUserVouched(github, accessToken)
        .then(function(isVouched) { 
          return model.putUser(profile, accessToken, isVouched)
        }),
      done
    );
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  doneify(model.getUserById(id), done);
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(expressValidator());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  resave: false,
  saveUninitialized: false,
  secret: config.sessionSecret
}));
app.use(passport.initialize());
app.use(passport.session());

// routes setup
app.use('/', new IndexRoutes(model).router);
app.use('/user', new UserRoutes(model).router);
app.use('/api/v1', new APIRoutes(model).router);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
