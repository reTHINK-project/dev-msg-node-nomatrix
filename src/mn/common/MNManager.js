/**
* Copyright 2016 PT Inovação e Sistemas SA
* Copyright 2016 INESC-ID
* Copyright 2016 QUOBIS NETWORKS SL
* Copyright 2016 FRAUNHOFER-GESELLSCHAFT ZUR FOERDERUNG DER ANGEWANDTEN FORSCHUNG E.V
* Copyright 2016 ORANGE SA
* Copyright 2016 Deutsche Telekom AG
* Copyright 2016 Apizee
* Copyright 2016 TECHNISCHE UNIVERSITAT BERLIN
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
**/

let _singleton = Symbol();

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
  constructor( token, domain, storage) {
    if ( _singleton !== token )
      throw new Error("MNManager can not be instantiated directly, call MNManager.getInstance() instead.");

    this._domain = domain;
    // this map maps a WSHandler instance to a runtimeURL
    this._handlers = new Map();
    // this map maps an address to an array of WSHandler addresses (e.g. for object subscriptions or multiple to-addresses)
    this._mappings = new Map();

    if (storage)
      this._storage = storage;
  }

  /**
   * Obtain the singleton Instance of MNManager. First call expects the domain
   * @param domain {String} ... the Domain that the MNManager is responsible for
   **/
  static getInstance(domain, storage) {
    if ( ! this[_singleton] ) {
      this[_singleton] = new MNManager(_singleton, domain, storage);
    }
    return this[_singleton];
  }

  //************************ STORAGE *******************************************
  // store key value pair (async)
  storage_store(key, value) {
        // console.log("######## storing key:value " + key + ":" + value);
        this._storage.setItem(key, value ).then( () => {
          // console.log("+[MNManager] [storage_store] stored " + key);
        },
        (err) => {
          console.log("+[MNManager] [storage_store] ERROR while storing " + key, err);
        });
  }

  // delete key from persistence (async)
  storage_delete(key) {
      // console.log("######## deleting key " + key);
      this._storage.removeItem(key).then( () => {
        // console.log("+[MNManager] [storage_delete] deleted " + key);
      },
      (err) => {
        console.log("+[MNManager] [storage_delete] ERROR while deleting " + key, err);
      });
  }

  storage_restoreSubscriptions() {
    return new Promise( (resolve, reject) => {
      let num = 0;
      this._storage.forEach( (address, runtimeURLs) => {
        // put them directly to the _mappings
        this._mappings.set(address, runtimeURLs);
        // console.log("%s -->", address, runtimeURLs);
        num ++;
      });
      console.log("########## restored %s mappings from persistent storage", num);
      resolve();
    })
  }

  //************************ STORAGE - END *************************************

  //************************ ADDRESS MAPPING ***********************************
  setMapping( address, runtimeURLs ) {
    this._mappings.set(address, runtimeURLs);
    // make it persistent
    this.storage_store(address, runtimeURLs);
  }

  deleteMapping( address ) {
    this._mappings.delete(address);
    // remove it from persistence
    try {
      this.storage_delete( address );
    } catch (err) {
      console.log("+[MNManager] [storage_delete] ERROR while deleting " + address, err);
    }
  }

  //************************ ADDRESS MAPPING - END *****************************


  //************************ HANDLER MAPPING ***********************************
  // moved this from WSServer to here in order to have only one place that potentially does persistency
  addHandler(runtimeURL, handler) {
    this._handlers.set(runtimeURL, handler);
  }

  getHandler(runtimeURL) {
    return this._handlers.get(runtimeURL);
  }

  deleteHandler(runtimeURL) {
    this._handlers.delete(runtimeURL);
  }
  //************************ HANDLER MAPPING - END******************************


  /**
   * Allocate hyperty addresses for which the given handler is responsible.
   * @param runtimeURL {String} ... the runtimeURL representing a WSHandler that
   *        maintains the physical connection to stub that connects the hyperties
   *        for which the addresses are allocated
   * @param number (Integer) ...  the number of addresses to allocate
   * @return array of addresses
   **/
  allocateAddresses(runtimeURL, number, scheme) {
    let count = number ? number : 1;
    let urls = [];
    for (let i=0; i < count; i++){
      urls.push( this._allocateAddress(runtimeURL, scheme));
    }
    return urls;
  }


  /**
   * Adds an handlers runtimeURL to the mapping for a given address
   * Only maps the runtimeURL of a Handler.
   **/
  addHandlerMapping(address, runtimeURL) {
    // do we have handlers already mapped to this address ?
    let runtimeURLs = this._mappings.get(address);
    if ( ! runtimeURLs ) {
      runtimeURLs = [runtimeURL];
    }
    else {
      // console.log("runtimeURLs for %s ", address, runtimeURLs);
      // add this handler to existing array, if not already present
      if ( runtimeURLs.indexOf( runtimeURL) == -1 )
        runtimeURLs.push(runtimeURL);
    }
    // update mapped handlers for given address
    this.setMapping(address, runtimeURLs);
    console.log("+[MNManager] [addHandlerMapping] added handler mapping for address >%s<, %d handler(s) mapped to this address --> overall map.size is now %d, ", address, runtimeURLs.length, this._mappings.size);
  }

  /*
   * remove handler(s) from the mapped handler array for a given address
   * If a runtimeURL is given as second parameter, only the handler responsible for this runtimeURLs
   * will be removed. All handlers for the given address will be removed otherwise.
   */
  removeHandlerMapping(address, runtimeURL) {
    if ( ! runtimeURL )
      // remove ALL mapped handlers for this address
      this.deleteMapping(address);
    else {
      // delete one given handler from mapped array for given address
      let runtimeURLs = this._mappings.get(address);
      if ( !runtimeURLs ) runtimeURLs = [];
      console.log("runtimeURLs", runtimeURLs);
      let index = runtimeURLs.indexOf(runtimeURL);
      // is this handler part of the mapped array?
      if ( index != -1 )
        runtimeURLs.splice(index, 1);
      // just update the mapping or remove address mapping completely, if this was the last entry
      if ( runtimeURLs.length > 0)
        this.setMapping(address, runtimeURLs);
      else
        this.deleteMapping(address);
    }
    console.log("+[MNManager] [removeHandlerMapping] removed handler mapping for address '%s' --> map.size is now %d", address, this._mappings.size);
  }


  /**
   * Returns handlers for a rethink address (e.g. hyperty address).
   * @param address {String}
   * @return handlers {Array}
   **/
  getHandlersByAddress(address) {
    let handlers = [];
    let runtimeURLs = this._mappings.get(address);
    if (! runtimeURLs ) runtimeURLs = [];
    // console.log("[getHandlersByAddress] address / runtimeURLs :  %s / %s ", address, runtimeURLs);
    for (var i = 0; i < runtimeURLs.length; i++) {
      // console.log("[getHandlersByAddress] runtimeURL is %s ", runtimeURLs[i]);
      // console.log("[getHandlersByAddress] handler is ", this.getHandler(runtimeURLs[i]));
      handlers.push(this.getHandler(runtimeURLs[i]));
    }
    return handlers;
  }

  /**
   * Allocates a single address for which the given handler is responsible.
   * Maintains an internal mapping between the new address and the handler.
   * @param runtimeURL {String} ... the runtimeURL representing the instance of WSHandler that
   *        maintains the physical connection to stub that connects the hyperties
   *        for which the addresses are allocated
   * @return a single address
   **/
  _allocateAddress(runtimeURL, scheme) {
    let newAddress = scheme + "://" + this._domain + "/" + this.generateUUID();
    if ( scheme === "hyperty")
      this.addHandlerMapping(newAddress, runtimeURL);

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

}
