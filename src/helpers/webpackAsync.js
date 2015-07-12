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
const BucketFileSystemWithPrefix = require('../models/BucketFileSystemWithPrefix');

async function webpackAsync(inputFileSystem, outputFileSystem, options) {
  const compiler = new WebpackCompiler();

  const nodeFileSystem = new NodeJsInputFileSystem();
  const cachedNodeFileSystem = new CachedInputFileSystem(nodeFileSystem, 60000);
  const cachedInputFileSystem = new CachedInputFileSystem(inputFileSystem, 60000);

  new WebpackOptionsDefaulter().process(options);

  compiler.options = options;
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

  const relativeNodeSourcePlugin = await RelativeNodeSourcePlugin(
    compiler, 
    options.node
  );
  compiler.apply(new relativeNodeSourcePlugin());
  
  compiler.outputFileSystem =  new BucketFileSystemWithPrefix(outputFileSystem, '.build');
  compiler.watchFileSystem = null;

  compiler.applyPlugins('environment');
  compiler.applyPlugins('after-environment');

  return await Promise.promisify(compiler.run, compiler)();
}

module.exports = webpackAsync;