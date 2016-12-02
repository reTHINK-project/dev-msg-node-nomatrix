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

//import MatrixClient from "../client/MatrixClient";
import MNManager from '../common/MNManager';
import AllocationHandler from '../allocation/AllocationHandler';
import SubscriptionHandler from '../subscription/SubscriptionHandler';
import RegistryInterface from '../registry/RegistryInterface';
import GlobalRegistryInterface from '../registry/GlobalRegistryInterface';
let URL = require('url');
let Promise = require('promise');


/**
 * This class implements a handler for a single WebSocket connection from a stub.
 * This connection can either be a domain-internal or -external connection.
 * In case of an internal stub-connection we attempt a Login to the Matrix HS with
 * the given credentials.
 * In case of an external stub-connection, we handover the handling to the RethinkBridge,
 * which is able to act on behalf of non-matrix users.
 **/
export default class WSHandler {

  /**
   * Constructs a new WSHandler for one dedicated Websocket connection.
   * @param config {Object} the configurations of the MatrixMN
   * @param wsCon {WebSocketConnection} the websocket connection to handle
   **/
  constructor(config, runtimeURL, wsCon, pdp) {
    this.runtimeURL = runtimeURL;
    this._config = config;
    this._wsCon = wsCon;
    this._pdp = pdp;
    this._mnManager = MNManager.getInstance();
    this._allocationHandler = new AllocationHandler(this._config.domain);
    this._subscriptionHandler = SubscriptionHandler.getInstance(this._config.domain);
    this._registryInterface = new RegistryInterface(this._config);
    this._globalRegistryInterface = new GlobalRegistryInterface(this._config);
    this._starttime;
  }

  /**
   * Initialize the WSHandler.
   * @return {Promise}
   **/
  initialize() {
    return new Promise((resolve, reject) => {
      resolve();
    });
  }

  /**
   * Performs all necessary actions to clean up this WSHandler instance before it can be destroyed.
   **/
  cleanup() {
  }

  /**
   * Sends a message to the handled WebSocket / to the runtime.
   * The message is stringyfied before it is sent out.
   * @param msg {Object} ... The message to be sent.
   **/
  sendWSMsg(msg) {
    if (this._wsCon) {
      // console.log("+[WSHandler] [sendWSMsg] send message to id=%s via websocket: ", this.runtimeURL, msg);
      this._wsCon.send(JSON.stringify(msg));
    } else {
      console.log("+[WSHandler] [sendWSMsg] connection is inactive --> not sending msg");
    }
  }

  /**
   * Handles a message coming in from an external stub.
   * @param msg {reThink message}
   **/
  handleStubMessage(m) {
    console.log("+[WSHandler] [handleStubMessage]:\n", m);

    // TODO: utility to validate retHINK message
    if (!m || !m.to || !m.from) {
      console.log("+[WSHandler] [handleStubMessage] this is not a reTHINK message --> ignoring ...");
      return;
    }

    // The following code will filter out message node specific rethink messages from normal msg flow.
    if ( this._allocationHandler.isResponsible(m) ) {
      this._allocationHandler.handleMessage(m, this);

    } else  if ( this._subscriptionHandler.isResponsible(m) ) {
      console.log("+[WSHandler] [handleStubMessage] subscribe/unsubscribe message detected --> handling subscription");
      this._mnManager.addHandlerMapping(m.from, this.runtimeURL);
      this._subscriptionHandler.handleMessage(m, this);

    } else if (this._registryInterface.isResponsible(m)) {
      // console.log("+[WSHandler] [handleStubMessage] registry message detected");
      this._registryInterface.handleMessage(m, this);

    } else if (this._globalRegistryInterface.isResponsible(m)) {
      console.log("+[WSHandler] [handleStubMessage] global registry message detected");
      this._globalRegistryInterface.handleMessage(m, this);
    }
    else {
      // SDR: send only, if PDP permits it
      if ( this._pdp.permits(m) ) {
        // map the route to the from address for later use
        this._mnManager.addHandlerMapping(m.from, this.runtimeURL);
        this._route(m); // route through Matrix
      }
      else {ok
        console.log("+[WSHandler] [handleStubMessage] Message was blocked by policies !!!!")
      }
    };
  }

  _route(m) {
    console.log("+[WSHandler] [_route] routing message ");
    // if more than one m.to are present the message must be handled for every to
    let msg = m;
    if (m.to instanceof Array) {
      for (let i = 0; i < m.to.length; i++) {
        msg.to = m.to[i];
        this._singleRoute(msg);
      }
    } else {
      this._singleRoute(msg);
    }
  }

  _singleRoute(m) {

    console.log()

    // SDR: If we have no mapped handler(s) for the to-address, then we have no connected stub for the toUser
    // in this case it makes no sense to send a Matrix msg to a non-existing/-connected client
    var handlers = this._mnManager.getHandlersByAddress(m.to);
    if ( handlers && handlers.length > 0) {
      this._doRoute(m, handlers);
    }
    else {
      console.log("+[WSHandler] [_singleRoute] no full match found for %s --> trying fallback via pure runtimeURL!", m.to);
      let runtimeBase = "runtime://" + this._config.domain + "/";
      if ( m.to.startsWith(runtimeBase) ) {
        // construct the target runtime URL by parsing to and adding the runtime-ID to the base
        var arr = m.to.split("/");
        if ( arr.length > 3 ) {
          let lookupUrl = runtimeBase + arr[3];
          console.log("+[WSHandler] [_singleRoute] FALLBACK looking up runtimeURL of to-field " + lookupUrl);
          handlers = this._mnManager.getHandlersByAddress(lookupUrl);
          if ( handlers ) {
            this._doRoute(m, handlers);
          }
        }
      }
    }

    if (! handlers) {
      console.error("+[WSHandler] [_singleRoute] no matching handlers found for to-address and client side Protocol-on-the-fly not implemented yet!")
    }
  }

  _doRoute(m, handlers) {
    console.log("+[WSHandler] [_doRoute] handlers.length %s for to-address %s", handlers.length, m.to);
    for (let i=0; i<handlers.length; i++) {
      handlers[i].sendWSMsg(m); // send the msg to the target runtime
      continue;
    }
  }

  releaseCon() {
    this._wsCon = null;
  }

  updateCon(con) {
    this._wsCon = con;
  }

  equals(obj) {
    return (obj instanceof WSHandler) && (obj.runtimeURL === this.runtimeURL);
  }
}
