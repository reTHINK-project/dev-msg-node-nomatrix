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

    if ( ! m.to === this._msgPrefix + "sm" ) {
      console.log("Wrong 'to-address' in Subscription message --> not for the MSG-Node --> ignoring");
      return;
    }

    if ( ! subscribe ) {
      console.log("no 'subscribe' parameter given --> BAD REQUEST");
      wsHandler.sendWSMsg( this.createResponse(m, 400, null) );
      return;
    }

    switch (mtype) {
      case "subscribe":
        console.log("SUBSCRIPTION request for resource %s", subscribe);

        // add mappings of resource to this from-URL
        if (typeof subscribe === 'array' || subscribe instanceof Array) {
          for (var i = 0; i < subscribe.length; i++) {
            this._mnManager.addHandlerMapping(subscribe[i], wsHandler);
          }
        } else {
          this._mnManager.addHandlerMapping(subscribe, wsHandler);
        }

        // 200 OK
        wsHandler.sendWSMsg( this.createResponse(m, 200) );
        break;

      case "unsubscribe": // TODO: adjust to new message format like above
        // remove mapping of resource-URL to WSHandler
        this._mnManager.removeSubscriptionMappings(resource, wsHandler);
        // remove mappings for each resource + childrenResources as well
        if ( childrenResources )
          childrenResources.forEach((child, i, arr) => {
            this._mnManager.removeSubscriptionMappings(resource + "/children/" + child, wsHandler);
          });

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
