const vm = require('vm');
const mapValues = require('lodash.mapvalues');
const webpack = require('webpack');
const {normalizeFilePath} = require('../models/Paths');

function getWebpackConfigStubPlugin(name) {
  class WebpackConfigStubPlugin {
    constructor(...args) {
      this.plugin = name;
      this.args = args;
    }
  }
  return WebpackConfigStubPlugin;
}

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

function getWebpackConfig(buffer) {
  let ctx = Object.assign({}, WebpackConfigContext);
  vm.runInNewContext(buffer.toString(), ctx);
  return  ctx.module.exports;
}

module.exports = getWebpackConfig;