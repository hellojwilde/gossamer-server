const Promise = require('bluebird');
const WebpackCompiler = require('webpack/lib/Compiler');
const WebpackOptionsApply = require('webpack/lib/WebpackOptionsApply');
const WebpackOptionsDefaulter = require('webpack/lib/WebpackOptionsDefaulter');
const NodeJsInputFileSystem = require("enhanced-resolve/lib/NodeJsInputFileSystem");
const CachedInputFileSystem = require("enhanced-resolve/lib/CachedInputFileSystem");

function webpackAsync(inputFileSystem, outputFileSystem, options) {
  const compiler = new WebpackCompiler();

  const nodeFileSystem = new NodeJsInputFileSystem();
  const cachedNodeFileSystem = new CachedInputFileSystem(nodeFileSystem, 60000);
  const cachedInputFileSystem = new CachedInputFileSystem(inputFileSystem, 60000);

  new WebpackOptionsDefaulter().process(options);
  compiler.options = options;
  compiler.options.context = '/';
  compiler.options = new WebpackOptionsApply().process(options, compiler);

  compiler.inputFileSystem = cachedInputFileSystem;

  compiler.resolvers.context.fileSystem = cachedInputFileSystem;
  compiler.resolvers.context.type = 'context';

  compiler.resolvers.normal.fileSystem = cachedInputFileSystem;
  compiler.resolvers.normal.type = 'normal';

  compiler.resolvers.loader.fileSystem = cachedNodeFileSystem;
  compiler.resolvers.loader.type = 'loader';
  compiler.resolvers.loader.internalResolve = compiler.resolvers.loader.resolve;
  compiler.resolvers.loader.resolve = function(_, request, callback) {
    this.internalResolve(process.cwd(), request, callback);
  };

  compiler.outputFileSystem = outputFileSystem;
  compiler.watchFileSystem = null;

  compiler.readRecords = function(callback) {
    console.log('READ RECORDS')
    this.records = {};
    callback();
  }.bind(compiler);

  compiler.emitRecords = function(callback) {
    console.log('EMIT RECORDS')
    console.log(JSON.stringify(this.records));
    callback();
  }.bind(compiler);

  compiler.applyPlugins('environment');
  compiler.applyPlugins('after-environment');

  return Promise.promisify(compiler.run, compiler)();
}

module.exports = webpackAsync;