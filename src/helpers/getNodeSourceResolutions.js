const NodeLibsBrowser = require("node-libs-browser");
const Promise = require('bluebird');
const ResolvedNodeSourcePlugin = require('./ResolvedNodeSourcePlugin');
const Resolver = require("enhanced-resolve/lib/Resolver");

async function getResolvedNodeSource(resolve, context, module, type) {
  if (type === true || (type === undefined && NodeLibsBrowser[module])) {
    if(!NodeLibsBrowser[module]) throw new Error("No browser version for node.js core module '" + module + "' available");
    const libsContext = await resolve(context, 'node-libs-browser/');
    return await resolve(libsContext, NodeLibsBrowser[module]);
  } else if(type === "mock") {
    return await resolve(context, "node-libs-browser/mock/" + module);
  } else if(type === "empty") {
    return await resolve(context, "node-libs-browser/mock/empty");
  } else return module;
}

async function getNodeSourceResolutions(resolver, context, options) {
  const resolve = Promise.promisify(resolver.resolve, resolver);
  const aliases = {};

  await Promise.each(Object.keys(NodeLibsBrowser), async function(lib) {
    if (options[lib] !== false) {
      aliases[lib + "$"] = await getResolvedNodeSource(resolve, context, lib, options[lib]);
    }
  });

  return aliases;
}

module.exports = getNodeSourceResolutions;