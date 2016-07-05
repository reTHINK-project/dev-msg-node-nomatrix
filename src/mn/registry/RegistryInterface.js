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

let ServiceFramework = require('service-framework');
let MessageFactory = new ServiceFramework.MessageFactory(false, {});

export default class RegistryInterface {

  constructor(config) {
    let  RegistryConnector = require('./RegistryConnector');
    this.registryConnector = new RegistryConnector(config.registryUrl);
    this.destination = "domain://registry." + config.domain;
  }

  handleRegistryMessage(m, wsHandler) {
    console.log("+[RegistryInterface] [handleRegistryMessage] %s message received on WSHandler", m.type.toUpperCase());

    let callback = (body) => {
      // response message for registry not implemented in the message factory
      // wsHandler.sendWSMsg( this.createResponse(m, 200) );
	console.log("§§§§§§§§§ [RegistryInterface] CALLBACK: got body \n", body);
      let msg = {
        id  : m.id,
        type: "response",
        from: m.to,
        to  : m.from,
        body: body
      };
      msg.body.code = 200;
	console.log("§§§§§§§§§ [RegistryInterface] CALLBACK: sending response back via WebSocket\n", msg);
      wsHandler.sendWSMsg(msg);
    };

    switch (m.type.toUpperCase()) {
      case "CREATE":
      case "READ":
      case "DELETE":
      case "UPDATE":
        this.registryConnector.processMessage(m, callback);
        break;
      default:
        console.error("+[RegistryInterface] [handleStubMessage] ERROR: message type unknown: ", m.type.toUpperCase());
        wsHandler.sendWSMsg( this.createResponse(m, 400, null) );
    }
  }

  isRegistryMessage(m) {
    // console.log("+[RegistryInterface] [isRegistryMessage] m: ", m);
    if (!m.body) return false;
    if (m.to.substring(0, this.destination.length) === this.destination) return true;
    return false;
  }

  createResponse(m, code) {
    return MessageFactory.createMessageResponse(m, code);
  }

}
