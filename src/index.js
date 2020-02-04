const { Errors } = require('moleculer');
const uuidv4 = require('uuid/v4');
const WebSocket = require('ws');

module.exports = {
  settings: {
    port: 3000,
    routes: [],
    options: {
      clientTracking: false,
      perMessageDeflate: false
    },
  },
  methods: {
    prepareRoute(route) {
      if (typeof route.action != 'string') {
        route.pattern = route.action;
        return route;
      }
      route.action = route.action.replace(/[$]/g, '\\$&');
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
      let timestamp = new Date().getTime();
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
        var p = this.broker.call(action, params, { 
          meta: { requestStartedAt: timestamp, transaction: data.transaction, websocketId: ws.id, ...ctx.meta }
        });
        if (!route.async) {
          p.then(res => {
            if (!res) return;
            res.transaction = data.transaction;
            ws.json(res);
          })
          .catch(err => {
            let { message, code, type, data } = err;
            ws.json({ message, code, type, data });
          });
        }   
      });
    },
    onOpen(ws) {
      ws.id = uuidv4();
      ws.channels = [];
      ws.json = (data) => { ws.send(JSON.stringify(data)) };
      ws.subscribe = (ch) => {
        let exists = ws.channels.includes(ch);
        if (exists) return;
        ws.channels.push(ch);
        if (!this.ws.channels[ch]) {
          this.ws.channels[ch] = [ws.id];
        } else {
          this.ws.channels[ch].push(ws.id);
        }
      }
      ws.unsubscribe = (ch) => {
        let index = ws.channels.indexOf(ch);
        if (index > -1) {
          ws.channels.splice(index, 1);
        }
        if (this.ws.channels[ch]) {
          index = this.ws.channels[ch].indexOf(ws.id);
          if (index === -1) return; 
          this.ws.channels[ch].splice(index, 1);
          if (this.ws.channels[ch].length === 0) {
            delete this.ws.channels[ch];
          }
        }
      }
      ws.unsubscribeAll = () => {
        ws.channels.forEach(ch => {
          let index = this.ws.channels[ch].indexOf(ws.id);
          if (index > -1) {
            this.ws.channels[ch].splice(index, 1);
          }
          if (this.ws.channels[ch].length === 0) {
            delete this.ws.channels[ch];
          }
        });
      }
      this.clients[ws.id] = ws;
      
      ws.on('message', (msg) => this.onMessage(ws, msg));
      ws.on('close', (code) => {
        ws.unsubscribeAll();
        delete this.clients[ws.id];
      });
    },
    createWSServer() {
      this.ws = new WebSocket.Server({
        ...this.settings.options,
        port: this.settings.port
      });
      this.ws.channels = {};
      this.ws.publish = (ch, data) => {
        if (!this.ws.channels[ch]) return;
        this.ws.channels[ch].forEach(it => { this.clients[it].send(data) });
      };
      this.ws.on('connection', this.onOpen);
    },
  },
  
  created() {
    this.clients = {};
    // Prepare routes array
    let routes = this.settings.routes;
    for (let i=0; i < routes.length; i++) {
      routes[i] = this.prepareRoute(routes[i]);
    }
  },
  started() {
    this.createWSServer();
  },
  stopped() {}
};