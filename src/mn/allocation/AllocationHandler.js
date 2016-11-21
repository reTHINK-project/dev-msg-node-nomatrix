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

import MNManager from '../common/MNManager';
import {MessageFactory} from 'service-framework/dist/MessageFactory';
let messageFactory = new MessageFactory();

export default class AllocationHandler {

  constructor(domain) {
    this._domain = domain;
    this._mnManager = MNManager.getInstance();
    this._msgPrefix = "domain://msg-node." + this._domain + "/";
    this._allocationKeyMap = new Map();
  }

  isResponsible(m) {
    return (m.to === (this._msgPrefix + "hyperty-address-allocation") ) ||  // to be removed
           (m.to === (this._msgPrefix + "object-address-allocation") ) ||  // to be removed
           (m.to === (this._msgPrefix + "address-allocation") ); // new phase 2 version
  }

  /*
  */
  handleMessage(m, wsHandler) {
    let number;
    let key;
    let scheme;
    let mtype  = m.type ? m.type.toLowerCase() : null;

    // new version
    if ( m.to === (this._msgPrefix + "address-allocation")) {
      scheme = m.body.scheme;
    }
    // old version --> to be removed
    else {
      scheme = "hyperty";
      let type   = m.to.endsWith("hyperty-address-allocation") ? "hyperty" : null;
      if ( ! type )
        type = m.to.endsWith("object-address-allocation") ? "object" : type;

      if ( type === "object" )
        scheme = m.body.scheme;
    }

    if ( m.body.value ) {
      number = m.body.value.number ? m.body.value.number : 1;
      key    = m.body.value.allocationKey ? m.body.value.allocationKey : null;
    }

    switch (mtype) {
      case "create":
        console.log("+[AllocationHandler] [handleAllocationMessage] ADDRESS ALLOCATION request with %d address allocations requested for scheme: %s", number, scheme);
        let addresses = this._mnManager.allocateAddresses(wsHandler.runtimeURL, number, scheme);

        // add the allocated addresses to the allocationKeyMap to allow later block-deletion by key
        if ( key )
          this._allocationKeyMap.set(key, addresses);

        wsHandler.sendWSMsg( this.createResponse(m, 200, addresses) );
        break;

      case "delete":
        let allocationKey = m.body.resource;
        let childrenResources = m.body.childrenResources;

        // BAD REQUEST ?
        if ( ! allocationKey && ! childrenResources ) {
          wsHandler.sendWSMsg( this.createDeleteResponse(m, 400) );
          return;
        }

        // delete Block of allocations by key
        if ( allocationKey ) {
          let addresses = this._allocationKeyMap.get(allocationKey);
          if ( addresses ) {
            addresses.forEach((key, i, arr) => {
              this._mnManager.removeHandlerMapping(key);
            });
          }
        }

        // delete dedicated address(es)
        if ( childrenResources ) {
          childrenResources.forEach((key, i, arr) => {
            // console.log("###### remove childrenResources[%s] = %s", i, key );
            this._mnManager.removeHandlerMapping(key);
          });
        }
        // if the key does not exist, we ignore this and send a 200 response
        wsHandler.sendWSMsg( this.createDeleteResponse(m, 200) );
        break;
      default:

    }
  }

  createResponse(m, code, addresses) {
    return messageFactory.createMessageResponse(m, code, {allocated: addresses});
  }

  createDeleteResponse(m, code) {
    return messageFactory.createMessageResponse(m, code);
  }
}
