let express = require('express');

export default class Routes {
  constructor() {
    this.routes = [];
  }

  getRouterForRegistry(registry) {
    let router = express.Router();

    this.routes.forEach(({method, pattern, callables}) => {
      let boundCallables = callables.map((callable) => callable.bind(registry));
      router[method](pattern, ...boundCallables);
    });

    return router;
  }

  get(pattern, ...callables) {
    this.routes.push({
      method: 'get',
      pattern: pattern,
      callables: callables
    });
  }

  post(pattern, ...callables) {
    this.routes.push({
      method: 'post',
      pattern: pattern,
      callables: callables
    });
  }
}