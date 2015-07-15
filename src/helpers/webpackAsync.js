const CachedInputFileSystem = require("enhanced-resolve/lib/CachedInputFileSystem");
const FunctionModulePlugin = require('webpack/lib/FunctionModulePlugin');
const JsonpTemplatePlugin = require("webpack/lib/JsonpTemplatePlugin");
const LoaderTargetPlugin = require('webpack/lib/LoaderTargetPlugin');
const NodeJsInputFileSystem = require("enhanced-resolve/lib/NodeJsInputFileSystem");
const Promise = require('bluebird');
const RelativeNodeSourcePlugin = require("./RelativeNodeSourcePlugin");
const WebpackCompiler = require('webpack/lib/Compiler');
const WebpackOptionsApply = require('webpack/lib/WebpackOptionsApply');
const WebpackOptionsDefaulter = require('webpack/lib/WebpackOptionsDefaulter');
const CompositeFileSystem = require('../models/CompositeFileSystem');

const path = require('path');

async function webpackAsync(inputFileSystem, outputFileSystem, options) {
  const compiler = new WebpackCompiler();

  const combinedInputFileSystem = new CachedInputFileSystem(new CompositeFileSystem([
    {folder: path.dirname(process.cwd()), fs: new NodeJsInputFileSystem()},
    {folder: null, fs: inputFileSystem}
  ]), 60000);

  new WebpackOptionsDefaulter().process(options);

  compiler.options = options;
  compiler.options.output.publicPath = '/my/.build/';
  compiler.options.context = '/';
  compiler.options.resolve.extensions = ['', '.js'];
  compiler.options.recordsPath = '/.build/records.json';
  compiler.options.target = function(compiler) {
    compiler.apply(
      new JsonpTemplatePlugin(options.output),
      new FunctionModulePlugin(options.output),
      new LoaderTargetPlugin("web")
    );
  };

  compiler.options = new WebpackOptionsApply().process(compiler.options, compiler);

  compiler.inputFileSystem = combinedInputFileSystem;

  compiler.resolvers.context.fileSystem = combinedInputFileSystem;
  compiler.resolvers.context.type = 'context';

  compiler.resolvers.normal.fileSystem = combinedInputFileSystem;
  compiler.resolvers.normal.type = 'normal';

  compiler.resolvers.loader.fileSystem = combinedInputFileSystem;
  compiler.resolvers.loader.type = 'loader';
  compiler.resolvers.loader.internalResolve = compiler.resolvers.loader.resolve;
  compiler.resolvers.loader.resolve = function(_, request, callback) {
    this.internalResolve(process.cwd(), request, callback);
  };

  const relativeNodeSourcePlugin = await RelativeNodeSourcePlugin(
    compiler, 
    options.node
  );
  compiler.apply(new relativeNodeSourcePlugin());
  
  compiler.outputFileSystem = outputFileSystem;
  compiler.watchFileSystem = null;

  compiler.applyPlugins('environment');
  compiler.applyPlugins('after-environment');

  return await Promise.promisify(compiler.run, compiler)();
}

module.exports = webpackAsync;