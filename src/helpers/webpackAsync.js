const CachedInputFileSystem = require("enhanced-resolve/lib/CachedInputFileSystem");
const FunctionModulePlugin = require('webpack/lib/FunctionModulePlugin');
const JsonpTemplatePlugin = require("webpack/lib/JsonpTemplatePlugin");
const LoaderTargetPlugin = require('webpack/lib/LoaderTargetPlugin');
const NodeJsInputFileSystem = require("enhanced-resolve/lib/NodeJsInputFileSystem");
const Promise = require('bluebird');
const ResolvedNodeSourcePlugin = require("./ResolvedNodeSourcePlugin");
const WebpackCompiler = require('webpack/lib/Compiler');
const WebpackOptionsApply = require('webpack/lib/WebpackOptionsApply');
const WebpackOptionsDefaulter = require('webpack/lib/WebpackOptionsDefaulter');
const FallbackFileSystem = require('../models/FallbackFileSystem');

const path = require('path');
const getNodeSourceResolutions = require('./getNodeSourceResolutions');

async function webpackAsync(dir, inputFileSystem, outputFileSystem, options) {
  const compiler = new WebpackCompiler();

  new WebpackOptionsDefaulter().process(options);

  compiler.options = options;
  compiler.options.output.publicPath = '/my/.build/';
  compiler.options.resolve.extensions = ['', '.js'];

  // XXX The base directory of BucketFileSystem is '/'.

  compiler.options.context = '/';
  compiler.options.recordsPath = '/.build/records.json';

  compiler.options.target = function(compiler) {
    compiler.apply(
      new JsonpTemplatePlugin(options.output),
      new FunctionModulePlugin(options.output),
      new LoaderTargetPlugin("web")
    );
  };

  compiler.options = new WebpackOptionsApply().process(compiler.options, compiler);

  // XXX We use the loaders that get installed with gossamer-server, not the 
  // ones specified in the gossamer branch we're fetching and building, because 
  // loaders are loaded via require(). (And that doesn't work with buckets.)
  // 
  // In theory Webpack will use the loader resolver for all of the loaders. 
  // However, after the loader is initially resolved with the loader resolver:
  // 
  // - The resolved loader location is added to the dependency map for normal 
  //   modules--the normal modules being the files that we want to apply the 
  //   loader to.
  // - The dependency manager then tries to resolve the dependency map 
  //   (INCLUDING THE RESOLVED LOADERS) using the normal resolver, not the 
  //   loader resolver.
  // - Since our loaders are in an orthogonal filesystem (the Node local 
  //   filesystem) with different paths from the normal module fileystem
  //   (BucketFileSystem or a CompositeBucketFileSystem)...the lookup fails.
  //   
  // The hack to work around this for now, is to have a filesystem layer that 
  // implements a minimum of methods that first checks the bucket for the file,
  // and falls back to the Node file system if that fails.
  // 
  // However, why not just use CompositeFileSystem for this?
  // 
  // On Heroku, `dir` is '/' always. So, can't separate by a folder.
  // On your development machine, the difference between paths will be more
  // than just a filePath segment.
  
  const combinedInputFileSystem = new CachedInputFileSystem(
    new FallbackFileSystem([inputFileSystem, new NodeJsInputFileSystem()]), 
    60000
  );

  compiler.inputFileSystem = combinedInputFileSystem;
  ['context', 'normal', 'loader'].forEach((type) => {
    compiler.resolvers[type].fileSystem = combinedInputFileSystem;
  });

  // XXX However, because process.cwd() will probably not be '/' on a developer
  // machine where we test this...we need the loader resolver to explicitly
  // look up paths for loaders in the directory where the process
  
  compiler.resolvers.loader.internalResolve = compiler.resolvers.loader.resolve;
  compiler.resolvers.loader.resolve = function(_, request, callback) {
    this.internalResolve(dir, request, callback);
  };

  // XXX We apply this here, rather than in compiler.options.target like with
  // NodeSourcePlugin in normal webpack because we need the resolvers to be
  // configured to be able to fetch the relative node source resolutions.
  // 
  // The resolvers are configured when we run WebpackOptionsApply.process().

  const aliases = await getNodeSourceResolutions(
    compiler.resolvers.normal, 
    compiler.options.context,
    options.node
  );

  compiler.apply(new ResolvedNodeSourcePlugin(aliases, options.node));

  compiler.outputFileSystem = outputFileSystem;
  compiler.watchFileSystem = null;

  compiler.applyPlugins('environment');
  compiler.applyPlugins('after-environment');

  return await Promise.promisify(compiler.run, compiler)();
}

module.exports = webpackAsync;