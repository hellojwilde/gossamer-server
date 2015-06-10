var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var express = require('express');
var expressValidator = require('express-validator');
var favicon = require('serve-favicon');
var fetch = require('node-fetch');
var logger = require('morgan');
var passport = require('passport');
var path = require('path');
var querystring = require('querystring');
var session = require('express-session');

var GithubStrategy = require('passport-github').Strategy;
var GithubApi = require('github');
var Redis = require('ioredis');
var Promise = require('bluebird');

var config = require('./config');
var routes = require('./routes/index');
var user = require('./routes/user');

var app = express();
var redis = new Redis();
var github = new GithubApi({version: '3.0.0'});

// github+mozillians vouching

function isGitHubUserVouchedOnMozillians(accessToken) {
  return Promise.map(
    getGitHubVerifiedEmails(accessToken),
    isEmailVouchedOnMozillians
  ).then(function(vouches) {
    return vouches.indexOf(true) !== -1;
  });
}

function getGitHubVerifiedEmails(accessToken) {
  return new Promise(function(resolve, reject) {
    github.authenticate({type: 'oauth', token: accessToken});
    github.user.getEmails({}, function(err, result) {
      if (err) {
        reject(err);
      }

      resolve(
        result
          .filter(function(address) {return address.verified === true})
          .map(function(address) {return address.email})
      );
    })
  });
}

function isEmailVouchedOnMozillians(email) {
  var url = (
    'https://mozillians.org/api/v2/users/?' +
    querystring.stringify({
      'api-key': config.mozilliansApiKey, 
      'email': email, 
      'is_vouched': 'true'
    })
  );

  return fetch(url).then(function(res) {
    return res.json().then(function(parsed) {
      return parsed && parsed.count && parsed.count > 0;
    });
  }); 
}

// authentication setup

function getUserKey(id, optSuffix) {
  var path = ['gos', 'user', id];
  optSuffix && path.push(optSuffix);
  return path.join(':');
}

passport.use(new GithubStrategy(
  {
    clientID: config.githubClientId,
    clientSecret: config.githubClientSecret,
    callbackURL: config.githubCallbackUrl
  },
  function(accessToken, _refreshToken, profile, done) {
    isGitHubUserVouchedOnMozillians(accessToken).then(function(isVouched) {
      redis.multi()
        .set(getUserKey(profile.id, 'accessToken'), accessToken)
        .set(getUserKey(profile.id, 'isVouched'), isVouched)
        .set(getUserKey(profile.id), JSON.stringify(profile))
        .exec(function(err, results) {
          done(err, profile);
        });
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  Promise.props({
    profile: redis.get(getUserKey(id)),
    isVouched: redis.get(getUserKey(id, 'isVouched'))
  })
    .then(function(user) {
      var parsed = JSON.parse(user.profile);
      parsed.isVouched = user.isVouched;
      done(null, parsed);
    })
    .catch(function(err) {done(err)});
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
  secret: 'keyboard cat'
}));
app.use(passport.initialize());
app.use(passport.session());

// login setup

app.use('/', routes);
app.use('/user', user);

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
