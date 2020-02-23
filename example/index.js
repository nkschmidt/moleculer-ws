const ws = require('../src/index.js');
const pingService = require('./ping.service.js');
const { ServiceBroker } = require("moleculer");
const cfg = {
  transporter: "TCP",
  logger: console,
  logLevel: "debug",
  tracking: {
    enabled: true,
    shutdownTimeout: 10 * 1000
  },
  hotReload: true
}
const broker = new ServiceBroker({ nodeID: "node-1", ...cfg });
const broker2 = new ServiceBroker({ nodeID: "node-2", ...cfg });

broker.createService({
  name: 'ws',
  mixins: [ws],
  settings: {
    port: 3005,
    middlewares: ['middlewareTest'],
    routes: [
      // describe routes (If it is empty, it will redirects all requests to services)
      
      {
        action: '*.*', // can be string like 'users.list' or RegExp like /^users.[0-9]+$/
        //middlewares: [ // array of functions or name of method
        //  (ctx, next) => next(),
        //  'middlewareTest'
        //] 
      },
      /*
      {
        action: '$node.actions', // can be string like 'users.list' or RegExp like /^users.[0-9]+$/
        middlewares: [ // array of functions or name of method
          (ctx, next) => next(),
          'middlewareTest'
        ] 
      }
      */
    ]
  },
  events: {    
    ["ws." + broker.nodeID](ctx){
      console.log("event", this.broker.nodeID, ctx);
    },
    // subscribe events
		"events.test"(payload) {
      this.ws.publish('event', JSON.stringify(payload));
    },
    "events.subscribe"(payload) {
      this.clients[payload.id].subscribe('event')
    }
  },
  methods: {
    middlewareTest(ctx, next) {
      // Sent response in middleware
      //if (ctx.action === 'cmd.echo') {
      //  return ctx.ws.json(ctx.params);
      //}
      // Handling errors in middlewares
      //if (ctx.action === 'cmd.error') {
      //  let err = new Error('test error');
      //  return next(err);
      //}
      
      console.log('middleware', ctx.action);
      return next();
    }
  }
});
broker2.createService(pingService(broker2));
broker.start();
broker2.start();