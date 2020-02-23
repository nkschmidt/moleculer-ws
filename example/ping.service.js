module.exports = (broker) => {
  return {
    name: 'ping',
    events: {
      "ping.pong"(ctx) {
        this.broker.emit("ws." + ctx.nodeID, new Error("Oooops"), { meta: ctx.meta, nodeID: this.broker.nodeID });        
      },
      "ping.subscribe"(ctx) {
        ctx.broadcast('events.subscribe', {
          id: ctx.meta.websocketId
        })
      }
    }
  }
};
