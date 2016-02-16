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
    return ( (m.type === "SUBSCRIBE" || m.type === "UNSUBSCRIBE") && m.to === this._msgPrefix + "sm");
  }

  isObjectUpdateMessage(m) {
    console.log("UPDATE check: %s, %s, %s, %s", m.type, m.from, m.to, m.body.value);
    return ((m.type === "UPDATE") && ((m.from + "/changes") === m.to) && m.body.value);
  }

  //
  addSubscription(resource, address) {
    console.log("add SUBSCRIPTION ");
    let addresses = this._subscriberMap.get(resource);
    if ( ! addresses )
      addresses = [];
    addresses.push(address);
    console.log("SUBSCRIPTION added for object %s to addresses %s", resource, JSON.stringify(addresses));
    this._subscriberMap.set(resource, addresses);
  }

  removeSubscription(resource, address) {
    let addresses = this._subscriberMap.get(resource);
    if ( addresses ) {
      let i = addresses.indexOf(address);
      if ( i >=0 )
          addresses.splice(i, 1);
      if ( addresses.length > 0)
        this._subscriberMap.set(resource, addresses);
      else
        this._subscriberMap.delete(resource);
    }
  }

  getSubscriptions(resource) {
    return this._subscriberMap.get(resource);
  }

  /*
  */
  handleSubscriptionMessage(m, wsHandler) {
    let mtype = m.type;
    let resource = m.body.resource;
    let childrenResources = m.body.childrenResources;

    if ( ! resource ) {
      console.log("no 'resource' parameter given --> BAD REQUEST");
      wsHandler.sendWSMsg( this.createResponse(m, 400, null) );
      return;
    }

    switch (mtype) {
      case "SUBSCRIBE":
        console.log("SUBSCRIPTION request for resource %s", resource);

        // remember the association of the from address to the wsHandler
        // this._mnManager.addHandlerMapping(m.from, wsHandler);

        // add mapping of resource to this from-URL
        this.addSubscription(resource, m.from);
        // this._mnManager.addHandlerMapping(resource+ "/changes", wsHandler);

        // add mappings for each resource + childrenResources as well
        if ( childrenResources )
          childrenResources.forEach((child, i, arr) => {
            this._mnManager.addSubscription(resource + "/" + child, m.from);
            // this._mnManager.addHandlerMapping(resource+ "/" + child + "/changes", wsHandler);
          });

        // 200 OK
        wsHandler.sendWSMsg( this.createResponse(m, 200) );
        break;

      case "UNSUBSCRIBE":
        // remove mapping of resource-URL to WSHandler
        this._mnManager.removeSubscription(resource);
        // add mappings for each resource + childrenResources as well
        if ( childrenResources )
          childrenResources.forEach((child, i, arr) => {
            this._mnManager.removeSubscription(resource + "/" + child);
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
      type: "RESPONSE",
      from: m.to,
      to:   m.from,
      body: { "code": code }
    };
  }

}
