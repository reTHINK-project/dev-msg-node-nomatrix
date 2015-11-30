let _singleton = Symbol();
let _MATRIX_MAGIC = "matrixmn";

let USER_PREFIX = "@_rethink_";



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
   * Allocate hyperty addresses for which the given MatrixClient is responsible.
   * @param matrixClient {MatrixClient} ... the instance of MatrixClient that
   *        maintains the physical connection to stub that connects the hyperties
   *        for which the addresses are allocated
   * @param number (Integer) ...  the number of addresses to allocate
   * @return array of Addresses
   **/
  allocateHypertyAddresses(matrixClient, number) {
    let count = number ? number : 1;
    let urls = [];
    for (let i=0; i < count; i++){
      urls.push( this._allocateHypertyAddress(matrixClient));
    }
    return urls;
  }

  createUserIdFromHash(hash) {
    return USER_PREFIX + hash + ":" + this._domain;
  }

  /**
   * Allocates a single hyperty address for which the given MatrixClient is responsible.
   * Maintains an internal mapping between the new address and the MatrixClient.
   * @param matrixClient {MatrixClient} ... the instance of MatrixClient that
   *        maintains the physical connection to stub that connects the hyperties
   *        for which the addresses are allocated
   * @return a single address
   **/
  _allocateHypertyAddress(matrixClient) {
    // map the given matrixClient to the newly allocated hypertx address
    let newAddress = "hyperty://" + this._domain + "/" + _MATRIX_MAGIC + "/" + this.generateUUID();
    this.addHandlerMapping(newAddress, matrixClient);
    return newAddress;
  }

  /**
   * Adds a address/handler mapping to the internal housekeeping.
   **/
  addHandlerMapping(address, handler) {
    this._handlers.set(address, handler);
    console.log("######## added handler mapping for address >%s< --> map.size is now %d ", address, this._handlers.size);
  }

  /**
   * looks up the StubHandler that is responsible for the given hyperty address
   * and returns the corresponding Matrix userId
   * @param address {String URI} ... the address to find a matchin Matrix UserId for
   * @return userId {String} ... the Matrix UserId that corresponds to the MatrixClient that is responsible for the given address.
   **/
  getMatrixUserIdByAddress(address) {
    let userId = null;
    let handler = this._handlers.get(address);
    if ( handler )
      userId = handler.userId;
    return userId;
  }

  getHandlerByAddress(address) {
    return this._handlers.get(address);
  }

  /**
   * Generate a UUID
   * (credits go to http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript)
   * @return uuid {String} ... the generated unique Identifier
   **/
  generateUUID() {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random()*16)%16 | 0;
      d = Math.floor(d/16);
      return (c=='x' ? r : (r&0x3|0x8)).toString(16);
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

  /*
   * delete the handler mapping, if address was de-allocated
   */
  _deleteHandlerMappingByAddress(address) {
    delete this._handlers.delete(address);
  }

  /*
   * delete the handler mapping, if responsible handler was disconnected
   */
  _deleteHandlerMappingByHandlerID(handlerID) {
    let matches = [];
    for (var [key, value] of this._handlers ) {
      if (handlerID === value.clientID)
        matches.push(key);
    }
    // delete all addresses, managed by this handler from the mapping
    matches.foreach( (el, index, arr) => {
      this._handlers.delete(el);
    });
  }
}
