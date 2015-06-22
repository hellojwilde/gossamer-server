function splitNodeArguments(args) {
  return [
    Array.prototype.slice.call(args, 0, -1),
    args[args.length - 1]
  ];
}

export function nodeifySync(method) {
  return function() {
    let [args, callback] = splitNodeArguments(arguments);
    callback(null, method(...args));
  };
}

export function nodeify(method) {
  return function() {
    let [args, callback] = splitNodeArguments(arguments);
    method(...args).then(
      (result) => callback(null, result),
      (err) => callback(err)
    );
  };
}