const vm = require('vm');
const webpack = require('webpack');
const {normalizeFilePath} = require('../models/Paths');

const WebpackConfigRequire = (name) => ({
  webpack: webpack,
  path: {
    join: (...pieces) => normalizeFilePath(pieces.join('/'))
  }
})[name];

WebpackConfigRequire.resolve = (name) => null;

const WebpackConfigContext = {
  RegExp: RegExp,
  __dirname: '/',
  require: WebpackConfigRequire,
  module: {}
};

function getWebpackConfig(buffer, host, buildId) {
  let ctx = Object.assign({}, WebpackConfigContext, {
    process: {env: {
      GOSSAMER_HOST: host,
      GOSSAMER_BUILD_ID: buildId
    }}
  });

  vm.runInNewContext(buffer.toString(), ctx);
  return ctx.module.exports;
}

module.exports = getWebpackConfig;