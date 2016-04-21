let _singleton = Symbol();

import MNManager from '../common/MNManager';

export default class SubscriptionHandler {

  constructor( token, domain ) {
    if ( _singleton !== token )
      throw new Error("SubscriptionHandler can not be instantiated directly, call MNManager.getInstance() instead.");

    this.OBJECT_SCHEMES = ["connection", "comm", "ctxt"];
    this._domain = domain;
    this._mnManager = MNManager.getInstance();
    this._msgPrefix = "domain://msg-node." + this._domain + "/";
    // mapping of resourceURL to array of MatrixID's
    this._subscriberMap = new Map();
  }

  /**
   * Obtain the singleton Instance of MNManager. First call expects the domain
   * @param domain {String} ... the Domain that the MNManager is responsible for
   **/
  static getInstance(domain) {
    if ( ! this[_singleton] )
      this[_singleton] = new SubscriptionHandler(_singleton, domain);
    return this[_singleton];
  }

  isSubscriptionMessage(m) {
    // console.log("SUBSCRIBE check: %s, %s ", m.type, m.to);
    let mtype  = m.type ? m.type.toLowerCase() : null;
    return ( (m.type === "subscribe" || m.type === "unsubscribe") && m.to === this._msgPrefix + "sm");
  }

  /*
  */
  handleSubscriptionMessage(m, wsHandler) {
    let mtype  = m.type ? m.type.toLowerCase() : null;
    //let mtype = m.type;
    let subscribe = m.body.subscribe; // resource
    let unsubscribe = m.body.unsubscribe; // resource

    let source = m.body.source; // subscriber URL (might potentially differ from "from")
    // default subscriber is the wsHandler that received this request
    let subscriber = wsHandler;
    // if source is given, we have to find a matching wsHandler for it and use this one as subscriber
    if ( source ) {
      let sourceHandlers = this._mnManager.getHandlersByAddress(source);
      if ( sourceHandlers && sourceHandlers instanceof Array && sourceHandlers.length == 1)
        subscriber = sourceHandlers[0];
    }

    if ( ! m.to === this._msgPrefix + "sm" ) {
      console.log("Wrong 'to-address' in Subscription message --> not for the MSG-Node --> ignoring");
      return;
    }

    if ( ! subscribe ) {
      console.log("no 'subscribe' parameter given --> BAD REQUEST");
      wsHandler.sendWSMsg( this.createResponse(m, 400, null) );
      return;
    }

    let changes = "/changes";

    switch (mtype) {
      case "subscribe":
        console.log("SUBSCRIPTION request for resource %s", subscribe);

        // add mappings of resource to this from-URL
        if (typeof subscribe === 'array' || subscribe instanceof Array) {
          for (var i = 0; i < subscribe.length; i++) {
            this._mnManager.addHandlerMapping(subscribe[i], subscriber);
            // SD: temporary hack to make things work for now --> subscribe also for url/subscription
            let s = subscribe[i];
            if ( s.indexOf(changes, s.length - changes.length) !== -1) {
              this._mnManager.addHandlerMapping(subscribe[i].replace(changes, "/subscription"), subscriber);
              console.log("SD-Hack: explicitely adding subscription for <URL>/subscription");
            }
          }
        } else {
          this._mnManager.addHandlerMapping(subscribe, subscriber);
          // SD: temporary hack to make things work for now --> subscribe also for url/subscription
          let s = subscribe;
          if ( s.indexOf(changes, s.length - changes.length) !== -1) {
            this._mnManager.addHandlerMapping(subscribe.replace(changes, "/subscription"), subscriber);
            console.log("SD-Hack: explicitely adding subscription for <URL>/subscription");
          }
        }

        // 200 OK
        wsHandler.sendWSMsg( this.createResponse(m, 200) );
        break;

      case "unsubscribe": // TODO: adjust to new message format like above
        // remove mapping of resource-URL to WSHandler
        if (typeof unsubscribe === 'array' || unsubscribe instanceof Array) {
          for (var i = 0; i < subscribe.length; i++) {
            this._mnManager.removeHandlerMapping(unsubscribe[i], subscriber);
          }
        } else {
          this._mnManager.removeHandlerMapping(unsubscribe, subscriber);
        }

        // 200 OK
        wsHandler.sendWSMsg( this.createResponse(m, 200) );
        break;
      default:

    }
  }

  createResponse(m, code) {
    return {
      id:   m.id,
      type: "response",
      from: m.to,
      to:   m.from,
      body: { "code": code }
    };
  }

}
