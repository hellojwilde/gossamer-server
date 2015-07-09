var path = require('path');
var randomstring = require('randomstring');

module.exports = {
  /**
   * process configuration
   */
  id: randomstring.generate(),
  dev: !!process.env.DEV,
  amqpUrl: process.env.CLOUDAMQP_URL || 'amqp://localhost',
  pgUrl: process.env.DATABASE_URL || 'postgres://localhost:5432/postgres',
  redisUrl: process.env.REDISCLOUD_URL || 'redis://localhost:6379',

  /**
   * www configuration
   */
  port: parseInt(process.env.PORT, 10) || 3000,
  publicUrl: process.env.PUBLIC_URL || 'http://localhost:3000',
  sessionSecret: process.env.SESSION_SECRET,

  /**
   * project configuration
   */
  base: process.env.BASE || 'hellojwilde:gossamer:master',
  
  /**
   * api keys for Mozillians and GitHub
   */
  mozilliansApiKey: process.env.MOZILLIANS_API_KEY,
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET
};