// Based on https://github.com/webpack/webpack/blob/webpack-2/lib/node/NodeSourcePlugin.js
// MIT License

const ModuleAliasPlugin = require("enhanced-resolve/lib/ModuleAliasPlugin");
const ModuleParserHelpers = require("webpack/lib/ModuleParserHelpers");

class ResolvedNodeSourcePlugin {
  constructor(aliases, options) {
    this.aliases = aliases;
    this.options = options || {};
  }

  apply(compiler) {
    const aliases = this.aliases;

    if (this.options.process) {
      const processType = this.options.process;
      compiler.parser.plugin("expression process", function() {
        return ModuleParserHelpers.addParsedVariable(this, "process", "require(" + JSON.stringify(aliases['process$']) + ")");
      });
    }

    if (this.options.global) {
      compiler.parser.plugin("expression global", function() {
        this.state.module.addVariable("global", "(function() { return this; }())");
        return true;
      });
    }

    if (this.options.console) {
      const consoleType = this.options.console;
      compiler.parser.plugin("expression console", function() {
        return ModuleParserHelpers.addParsedVariable(this, "console", "require(" + JSON.stringify(aliases["console$"]) + ")");
      });
    }

    const bufferType = this.options.Buffer;
    if (bufferType) {
      compiler.parser.plugin("expression Buffer", function() {
        return ModuleParserHelpers.addParsedVariable(this, "Buffer", "require(" + JSON.stringify(aliases["buffer$"]) + ").Buffer");
      });
    }

    if (this.options.setImmediate) {
      const setImmediateType = this.options.setImmediate;
      compiler.parser.plugin("expression setImmediate", function() {
        return ModuleParserHelpers.addParsedVariable(this, "setImmediate", "require(" + JSON.stringify(aliases["timers$"]) + ").setImmediate");
      });
      compiler.parser.plugin("expression clearImmediate", function() {
        return ModuleParserHelpers.addParsedVariable(this, "clearImmediate", "require(" + JSON.stringify(aliases["timers$"]) + ").clearImmediate");
      });
    }

    if (Object.keys(this.aliases).length > 0) {
      compiler.resolvers.normal.apply(
        new ModuleAliasPlugin(this.aliases)
      );
    }
  }
}

module.exports = ResolvedNodeSourcePlugin;