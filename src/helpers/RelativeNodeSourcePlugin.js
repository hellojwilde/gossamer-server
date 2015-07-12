const ModuleAliasPlugin = require("enhanced-resolve/lib/ModuleAliasPlugin");
const ModuleParserHelpers = require("webpack/lib/ModuleParserHelpers");
const NodeLibsBrowser = require("node-libs-browser");
const Promise = require('bluebird');

async function getPlugin(compiler, options) {
  async function getPathToModule(module, type) {
    const context = compiler.options.context;
    const normalResolver = compiler.resolvers.normal;
    const normalResolve = Promise.promisify(normalResolver.resolve, normalResolver);

    if(type === true || (type === undefined && NodeLibsBrowser[module])) {
      if(!NodeLibsBrowser[module]) throw new Error("No browser version for node.js core module '" + module + "' available");
      const libsContext = await normalResolve(context, 'node-libs-browser/');
      return await normalResolve(libsContext, NodeLibsBrowser[module]);
    } else if(type === "mock") {
      return await normalResolve(context, "node-libs-browser/mock/" + module);
    } else if(type === "empty") {
      return await normalResolve(context, "node-libs-browser/mock/empty");
    } else return module;
  }

  const alias = {};
  await Promise.each(Object.keys(NodeLibsBrowser), async function(lib) {
    if(options[lib] !== false) {
      alias[lib + "$"] = await getPathToModule(lib, options[lib]);
    }
  });

  class RelativeNodeSourcePlugin {
    constructor() {
      this.options = options;
    }

    apply(compiler) {
      if (this.options.process) {
        var processType = this.options.process;
        compiler.parser.plugin("expression process", function() {
          return ModuleParserHelpers.addParsedVariable(this, "process", "require(" + JSON.stringify(getPathToModule("process", processType)) + ")");
        });
      }

      if(this.options.global) {
        compiler.parser.plugin("expression global", function() {
          this.state.module.addVariable("global", "(function() { return this; }())");
          return true;
        });
      }

      if(this.options.console) {
        var consoleType = this.options.console;
        compiler.parser.plugin("expression console", function() {
          return ModuleParserHelpers.addParsedVariable(this, "console", "require(" + JSON.stringify(getPathToModule("console", consoleType)) + ")");
        });
      }

      var bufferType = this.options.Buffer;
      if(bufferType) {
        compiler.parser.plugin("expression Buffer", function() {
          return ModuleParserHelpers.addParsedVariable(this, "Buffer", "require(" + JSON.stringify(getPathToModule("buffer", bufferType)) + ").Buffer");
        });
      }

      if(this.options.setImmediate) {
        var setImmediateType = this.options.setImmediate;
        compiler.parser.plugin("expression setImmediate", function() {
          return ModuleParserHelpers.addParsedVariable(this, "setImmediate", "require(" + JSON.stringify(getPathToModule("timers", setImmediateType)) + ").setImmediate");
        });
        compiler.parser.plugin("expression clearImmediate", function() {
          return ModuleParserHelpers.addParsedVariable(this, "clearImmediate", "require(" + JSON.stringify(getPathToModule("timers", setImmediateType)) + ").clearImmediate");
        });
      }

      if(Object.keys(alias).length > 0) {
        compiler.resolvers.normal.apply(
          new ModuleAliasPlugin(alias)
        );
      }
    }
  }

  return RelativeNodeSourcePlugin;
}

module.exports = getPlugin;