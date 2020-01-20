const ws = require('../src/index.js');
const pingService = require('./ping.service.js');
const { ServiceBroker } = require("moleculer");
const broker = new ServiceBroker({
  logger: console,
  tracking: {
    enabled: true,
    shutdownTimeout: 10 * 1000
  },
  hotReload: true
});

broker.createService({
  name: 'ws',
  mixins: [ws],
  settings: {
    port: 3005,
    routes: [
      // describe routes (If it is empty, it will redirects all requests to services)
      /*
      {
        action: '*.*', // can be string like 'users.list' or RegExp like /^users.[0-9]+$/
        middlewares: [ // array of functions or name of method
          (ctx, next) => next(),
          'middlewareTest'
        ] 
      },
      */
      {
        action: '$node.actions', // can be string like 'users.list' or RegExp like /^users.[0-9]+$/
        middlewares: [ // array of functions or name of method
          (ctx, next) => next(),
          'middlewareTest'
        ] 
      }
    ]
  },
  events: {
    // subscribe events
		"ws.*"(payload, sender, event) {
      this.ws.clients.forEach(ws => {
        ws.json(payload);
      })
		}
  },
  methods: {
    middlewareTest(ctx, next) {
      // Sent response in middleware
      if (ctx.action === 'cmd.echo') {
        return ctx.ws.json(ctx.params);
      }
      // Handling errors in middlewares
      if (ctx.action === 'cmd.error') {
        let err = new Error('test error');
        return next(err);
      }
      console.log('middleware', ctx.action);
      return next();
    }
  }
});
broker.createService(pingService);
broker.start();

/* 
  Browser example:

  var ws = new WebSocket('ws://localhost:3005'); 
  ws.onmessage = (data) => {console.log(data.data)};

  1. ws.send('{"action":"ping.pong", "params": {}')
  2. ws.send('{"action":"cmd.echo", "params": {"data": "text"}}')
  3. ws.send('{"action":"cmd.error", "params": {}}')

*/