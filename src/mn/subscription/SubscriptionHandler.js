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

import MNManager from '../common/MNManager';
import {MessageFactory} from 'service-framework/dist/MessageFactory';
let messageFactory = new MessageFactory();

export default class SubscriptionHandler {

  constructor( token, domain ) {
    if ( _singleton !== token )
      throw new Error("SubscriptionHandler can not be instantiated directly, call MNManager.getInstance() instead.");

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

  isResponsible(m) {
    // console.log("+[SubscriptionHandler] [isSubscriptionMessage] SUBSCRIBE check: %s, %s ", m.type, m.to);
    let mtype  = m.type ? m.type.toLowerCase() : null;
    return ( (m.type === "subscribe" || m.type === "unsubscribe") && m.to === this._msgPrefix + "sm");
  }

  /*
  */
  handleMessage(m, wsHandler) {
    let mtype  = m.type ? m.type.toLowerCase() : null;
    //let mtype = m.type;
    let resources = m.body.resources; // resource
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
      console.log("+[SubscriptionHandler] [handleSubscriptionMessage] wrong 'to-address' in subscription message --> not for the MSG-Node --> ignoring");
      return;
    }

    if ( ! (resources) ) {
      console.log("+[SubscriptionHandler] [handleSubscriptionMessage] no resources parameter given --> BAD REQUEST");
      wsHandler.sendWSMsg( this.createResponse(m, 400, null) );
      return;
    }

    switch (mtype) {
      case "subscribe":
        console.log("+[SubscriptionHandler] [handleSubscriptionMessage] SUBSCRIPTION request for resource %s", resources);
        // add mappings of resource to this from-URL
        if (typeof resources === 'array' || resources instanceof Array) {
          for (var i = 0; i < resources.length; i++) {
            this._mnManager.addHandlerMapping(resources[i], subscriber.runtimeURL);
          }
        } else {
          this._mnManager.addHandlerMapping(resources, subscriber.runtimeURL);
        }

        // 200 OK
        wsHandler.sendWSMsg( this.createResponse(m, 200) );
        break;

      case "unsubscribe":
        // remove mapping of resource-URL to WSHandler
        if (typeof resources === 'array' || resources instanceof Array) {
          for (var i = 0; i < resources.length; i++) {
            this._mnManager.removeHandlerMapping(resources[i], subscriber.runtimeURL);
          }
        } else {
          this._mnManager.removeHandlerMapping(resources, subscriber.runtimeURL);
        }

        // 200 OK
        wsHandler.sendWSMsg( this.createResponse(m, 200) );
        break;
      default:

    }
  }

  createResponse(m, code) {
    return messageFactory.createMessageResponse(m, code);
  }

}
