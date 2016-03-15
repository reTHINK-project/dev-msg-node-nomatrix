let _singleton = Symbol();
let _MATRIX_MAGIC = "matrixmn";


/**
 * The MNManager maintains the mapping of MatrixClients to allocated Hyperty Addresses.
 * The MNManager is a singleton class. The instance can be retrieved via MNManager.getInstance().
 **/
export default class MNManager {

  /**
   * "Private" constructor for the MNManager.
   * @param token {Symbol} ... the hidden secret to create the singleton instance (credits go to https://gist.github.com/CGavrila/3499529123b8bec955f8).
   * @param domain {String} ... the Domain that the MNManager is responsible for
   **/
  constructor( token, domain ) {
    if ( _singleton !== token )
      throw new Error("MNManager can not be instantiated directly, call MNManager.getInstance() instead.");

    this.AS_NAME = "rethinkMN";
    this.USER_PREFIX = "@_rethink_";
    this.ROOM_PREFIX = "#_rethink_";
    this._domain = domain;
    this._count = 0;
    // this map maps an address to an array of WSHandlers (e.g. for object subscriptions or multiple to-addresses)
    this._handlers = new Map();
  }

  /**
   * Obtain the singleton Instance of MNManager. First call expects the domain
   * @param domain {String} ... the Domain that the MNManager is responsible for
   **/
  static getInstance(domain) {
    if ( ! this[_singleton] )
      this[_singleton] = new MNManager(_singleton, domain);
    return this[_singleton];
  }

  /**
   * Allocate hyperty addresses for which the given handler is responsible.
   * @param handler {WSHandler} ... the instance of WSHandler that
   *        maintains the physical connection to stub that connects the hyperties
   *        for which the addresses are allocated
   * @param number (Integer) ...  the number of addresses to allocate
   * @return array of addresses
   **/
  allocateAddresses(handler, number, scheme) {
    let count = number ? number : 1;
    let urls = [];
    for (let i=0; i < count; i++){
      urls.push( this._allocateAddress(handler, scheme));
    }
    return urls;
  }

  _indexOfHandler(handlers, handler) {
    if ( handlers && handler && (handlers instanceof Array) ) {
      for (var i = 0; i < handlers.length; i++) {
        if (handler.equals(handlers[i]))
          return i;
      }
    }
    return -1;
  }

  /**
   * Adds an handler to the mapping for a given address
   **/
  addHandlerMapping(address, handler) {
    // do we have handlers already mapped to this address ?
    let handlers = this._handlers.get(address);
    if ( ! handlers ) {
      handlers = [handler];
    }
    else {
      // add this handler to existing array, if not already present
      if ( this._indexOfHandler(handlers, handler) == -1 )
        handlers.push(handler);
    }
    // update mapped handlers for given address
    this._handlers.set(address, handlers);
    console.log("*** added handler mapping for address >%s<, %d handler(s) mapped to this address --> overall map.size is now %d, ", address, handlers.length, this._handlers.size);
  }

  /*
   * remove handler(s) from the mapped handler array for a given address
   * If a handler is given as second parameter, only this handler will be removed. All handlers for the given address will be removed otherwise.
   */
  removeHandlerMapping(address, handler) {
    if ( ! handler )
      // remove ALL mapped handlers for this address
      this._handlers.delete(address);
    else {
      // delete one given handler from mapped array for given address
      let handlers = this._handlers.get(address);
      let index = this._indexOfHandler(handlers, handler);
      // is this handler part of the mapped array?
      if ( index != -1 )
        handlers.splice(index, 1);
        // just update the mapping or remove address mapping completely, if this was the last entry
        if ( handlers.length > 0)
          this._handlers.set(address, handlers);
        else
          this._handlers.delete(address);
    }
    console.log("*** removed handler mapping for address >%s< --> map.size is now %d ", address, this._handlers.size);
  }


  /*
   * delete the handler mapping, if responsible handler was disconnected
   */
  removeHandlerMappingsForRuntimeURL(runtimeURL) {
    // first remove mapping for the runtimeURL directly
    this.removeHandlerMapping(runtimeURL);

    // check the remainings and remove every mapping of a wsHandler that matches the runtimeURL
    let matches = new Map();
    for (var [address, handlers] of this._handlers ) {
      handlers.forEach((handler, i, arr) => {
        if (runtimeURL === handler.runtimeURL)
          matches.set(address, handler);
      });
    }
    // delete all addresses, managed by this handler from the mapping
    for( var [address, handler] of matches ) {
      this.removeHandlerMapping(address, handler);
    }
  }

  addSubscriptionMappings(resource, handler, childrenResources) {
    this.addHandlerMapping(resource, handler);
    this.addHandlerMapping(resource + "/changes", handler);
    if ( childrenResources ) {
      childrenResources.forEach((child, i, arr) => {
        this.addHandlerMapping(resource + "/children/" + child, handler);
        // this.addHandlerMapping(resource + "/children/" + child + "/changes", handler);
      });
    }
  }

  removeSubscriptionMappings(resource, handler, childrenResources) {
    this.removeHandlerMapping(resource, handler);
    this.removeHandlerMapping(resource + "/changes", handler);
    if ( childrenResources ) {
      childrenResources.forEach((child, i, arr) => {
        this.removeHandlerMapping(resource + "/children/" + child, handler);
        // this.removeHandlerMapping(resource + "/children/" + child + "/changes", handler);
      });
    }
  }


  getHandlersByAddress(address) {
    return this._handlers.get(address);
  }

  createUserId(address) {
    return this.USER_PREFIX + this.hashCode(address) + ":" + this._domain;
  }

  createRoomAlias(fromUser, toUser) {
    return this.ROOM_PREFIX + this._extractHash(fromUser) + "_" + this._extractHash(toUser);
  }

  _extractHash(userId) {
    let s = userId.split(':')[0];
    return s.substr(this.USER_PREFIX.length);
  }

  /**
   * Allocates a single address for which the given handler is responsible.
   * Maintains an internal mapping between the new address and the handler.
   * @param handler {WSHandler} ... the instance of WSHandler that
   *        maintains the physical connection to stub that connects the hyperties
   *        for which the addresses are allocated
   * @return a single address
   **/
  _allocateAddress(handler, scheme) {
    // map the given matrixClient to the newly allocated hyperty address
    let newAddress = scheme + "://" + this._domain + "/" + _MATRIX_MAGIC + "/" + this.generateUUID();
    if ( scheme === "hyperty")
      this.addHandlerMapping(newAddress, handler);

    return newAddress;
  }

  /**
   * Generate a UUID
   * (credits go to http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript)
   * @return uuid {String} ... the generated unique identifier
   **/
  generateUUID() {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random()*16)%16 | 0;
      d = Math.floor(d/16);
      return (c=='x' ? r : (r&0x3|0x8)).toString(16); //
    });
    return uuid;
  }

  /**
   * Generate a hash for a given String
   * (credits go to: http://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery)
   **/
  hashCode(s){
    let h = "" + s.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0);
    if ( "-" === h.charAt(0))
      h = h.substr(1);
    return h;
  }
}
