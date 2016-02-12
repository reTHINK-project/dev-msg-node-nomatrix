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
  allocateAddresses(handler, type, number, scheme) {
    let count = number ? number : 1;
    let urls = [];
    for (let i=0; i < count; i++){
      urls.push( this._allocateAddress(handler, type, scheme));
    }
    return urls;
  }

  /**
   * Adds an address/handler mapping to the internal housekeeping.
   **/
  addHandlerMapping(address, handler) {
    this._handlers.set(address, handler);
    console.log("*** added handler mapping for address >%s< --> map.size is now %d ", address, this._handlers.size);
  }

  /*
   * delete the handler mapping, if address was de-allocated
   */
  removeHandlerMapping(address) {
    this._handlers.delete(address);
    console.log("*** removed handler mapping for address >%s< --> map.size is now %d ", address, this._handlers.size);
  }

  /*
   * delete the handler mapping, if responsible handler was disconnected
   */
  removeHandlerMappingsForRuntimeURL(runtimeURL) {
    let matches = [];
    for (var [key, value] of this._handlers ) {
      if (runtimeURL === value.runtimeURL)
        matches.push(key);
    }
    // delete all addresses, managed by this handler from the mapping
    matches.forEach((key, i, arr) => {
      this.removeHandlerMapping(key);
    });
  }

  /**
   * looks up the StubHandler that is responsible for the given hyperty address
   * and returns the corresponding Matrix userId
   * @param address {String URI} ... the address to find a matching Matrix UserId for
   * @return userId {String} ... the Matrix UserId that corresponds to the MatrixClient that is responsible for the given address
   **/
  getMatrixIdByAddress(address) {
    let userId = null;
    let handler = this._handlers.get(address);
    if ( handler )
      userId = handler.getMatrixId();
    return userId;
  }

  createUserId(address) {
    return this.USER_PREFIX + this.hashCode(address) + ":" + this._domain;
  }

  createRoomAlias(fromUser, toUser) {
    return this.ROOM_PREFIX + this._extractHash(fromUser) + "_" + this._extractHash(toUser);
  }

  getHandlerByAddress(address) {
    return this._handlers.get(address);
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
  _allocateAddress(handler, type, scheme) {
    // map the given matrixClient to the newly allocated hyperty address
    let newAddress = scheme + "://" + this._domain + "/" + _MATRIX_MAGIC + "/"+ type +"/" + this.generateUUID();
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
