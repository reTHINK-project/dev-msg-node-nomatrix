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
let ServiceFramework = require('service-framework');
let MessageFactory = new ServiceFramework.MessageFactory(false, {});

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

  isSubscriptionMessage(m) {
    // console.log("+[SubscriptionHandler] [isSubscriptionMessage] SUBSCRIBE check: %s, %s ", m.type, m.to);
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
      console.log("+[SubscriptionHandler] [handleSubscriptionMessage] wrong 'to-address' in subscription message --> not for the MSG-Node --> ignoring");
      return;
    }

    if ( ! (subscribe || unsubscribe) ) {
      console.log("+[SubscriptionHandler] [handleSubscriptionMessage] no 'subscribe' or 'unsubscribe' parameter given --> BAD REQUEST");
      wsHandler.sendWSMsg( this.createResponse(m, 400, null) );
      return;
    }

    switch (mtype) {
      case "subscribe":
        console.log("+[SubscriptionHandler] [handleSubscriptionMessage] SUBSCRIPTION request for resource %s", subscribe);
        if ( ! subscribe ) {
          // handle error situation
          console.log("+[SubscriptionHandler] field body.subscribe is missing --> rejecting this request");
          wsHandler.sendWSMsg( this.createResponse(m, 400) );
          return;
        }

        // add mappings of resource to this from-URL
        if (typeof subscribe === 'array' || subscribe instanceof Array) {
          for (var i = 0; i < subscribe.length; i++) {
            this._mnManager.addHandlerMapping(subscribe[i], subscriber);
          }
        } else {
          this._mnManager.addHandlerMapping(subscribe, subscriber);
        }

        // 200 OK
        wsHandler.sendWSMsg( this.createResponse(m, 200) );
        break;

      case "unsubscribe": // TODO: adjust to new message format like above
        if ( ! unsubscribe ) {
          // handle error situation
          console.log("+[SubscriptionHandler] field body.unsubscribe is missing --> rejecting this request");
          wsHandler.sendWSMsg( this.createResponse(m, 400) );
          return;
        }
        // remove mapping of resource-URL to WSHandler
        if (typeof unsubscribe === 'array' || unsubscribe instanceof Array) {
          for (var i = 0; i < unsubscribe.length; i++) {
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
    return MessageFactory.createMessageResponse(m, code);
  }

}
