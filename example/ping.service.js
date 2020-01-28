module.exports = {
  name: 'ping',
  actions: {
    pong(ctx) {
      //this.ws[].subscribe('event');
      this.broker.broadcast('events.test', {test: 123});
      return 'pong';
    },
    subscribe(ctx) {
      ctx.broadcast('events.subscribe', {
        id: ctx.meta.websocketId
      })
    }
  }
};
