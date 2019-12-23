const http = require('http');
const WebSocket = require('ws');
const { Errors } = require('moleculer');
const uuidv4 = require('uuid/v4');

module.exports = {
  settings: {
    port: 3000,
    routes: []
  },
  methods: {
    prepareRoute(route) {
      if (typeof route.action != 'string') {
        route.pattern = route.action;
        return route;
      }
      let pattern = '';
      if (route.action[0] !== '^') {
        pattern += '^' + route.action.replace(/\*/g, '\\w+', 'g');
      } 
      if (pattern[pattern.length - 1] !== '$') {
        pattern += '$';
      }
      route.pattern = new RegExp(pattern);
      return route;
    },
    addRoute(route) {
      this.settings.routes.push(this.prepareRoute(route));
    },
    resolveRouter(action) {
      for(var i=0; i < this.settings.routes.length; i++) {
        let route = action.match(this.settings.routes[i].pattern);
        if (route) return this.settings.routes[i];
      }
      return null;
    },
    runMiddlewares(middlewares = [], ctx, fn) {
      let iterator = 0;
      let middleware = middlewares[iterator];
      if (typeof middleware === 'string') {
        middleware = this[middleware];
      }
      if (!middleware) return fn();
      let next = (err) => {
        if (err) {
          return ctx.ws.json(new Errors.MoleculerError(err.message, 500, err.type));
        }
        iterator++;
        if (iterator < middlewares.length) {
          middleware = middlewares[iterator];
          if (typeof middleware === 'string') {
            middleware = this[middleware];
          }
          middleware(ctx, next);
        } else {
          fn();
        }
      }
      middleware(ctx, next);
    },
    onMessage(ws, msg) {
      let data = {};
      try {
        data = JSON.parse(msg);
      } catch (err) {
        return ws.json(new Errors.MoleculerError("Invalid request body", 400, "INVALID_REQUEST_BODY", {
          body: msg,
          err
        }));
      }
      let { action, params = {} } = data;
      if (!action) return;
      const route = this.resolveRouter(action);
      if (!route && this.settings.routes.length) return;
      let ctx = { meta: {}, route, action, params, ws };
      this.runMiddlewares(route.middlewares, ctx, () => {
        this.broker.call(action, params, {
          meta: { websocketId: ws.id, ...ctx.meta }
        })
          .then(res => {
            if (!res) return;
            res.transaction = data.transaction;
            ws.json(res);
          })
          .catch(err => {
            let { message, code, type, data } = err;
            ws.json({ message, code, type, data });
          });
      });
    }
  },
  created() {
    this.server = http.createServer();
    this.ws = new WebSocket.Server({ server: this.server });
    // Prepare routes array
    let routes = this.settings.routes;
    for (let i=0; i < routes.length; i++) {
      routes[i] = this.prepareRoute(routes[i]);
    }
  },
  started() {
    this.server.listen(this.settings.port);
    this.ws.on('connection', (ws) => {
      ws.id = uuidv4();
      ws.json = (data) => { ws.send(JSON.stringify(data)) };
      ws.on('message', (msg) => this.onMessage(ws, msg));
    });
  },
  stopped() {
    this.server.close();
  }
};