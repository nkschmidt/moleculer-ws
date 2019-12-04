const ws = require('../src/index.js');
module.exports = {
  name: 'ws',
  mixins: [ws],
  settings: {
    port: 3004,
    routes: [
      // describe routes (If it is empty, it will redirects all requests to services)
      {
        action: '*.*', // can be string like 'users.list' or RegExp like /^users.[0-9]+$/
        middlewares: [this.middlewareTest] // array of middlewares
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
      if (ctx.action === 'echo') {
        return ctx.ws.json(ctx.params);
      }
      // Handling errors in middlewares
      if (ctx.action === 'error') {
        let err = new Error('test error');
        return next(err);
      }
      return next();
    }
  }
};