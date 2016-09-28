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

// console.dir(process.argv);
var MN_CONFIG = require('./config');

// minimal arguments handling, avoid that present but empty args are interpreted as "true"
var p = require('yargs').string('d').string('domain').string('r').string('registry').string('p').string('port').argv;
MN_CONFIG.domain      = p.domain  ? p.domain  : p.d ? p.d : MN_CONFIG.domain;
MN_CONFIG.WS_PORT     = p.port    ? p.port    : p.p ? p.p : MN_CONFIG.WS_PORT;
MN_CONFIG.registryUrl = p.registry? p.registry: p.r ? p.r : MN_CONFIG.registryUrl;
console.log("The MN is using the following configuration: ");
console.log(" domain        : " + MN_CONFIG.domain);
console.log(" websocket port: " + MN_CONFIG.WS_PORT);
console.log(" registryUrl   : " + MN_CONFIG.registryUrl);

import MNManager from './common/MNManager';
import WSServer from './ws/WSServer';

// initialize the MNManager singleton with domain from global config
MNManager.getInstance(MN_CONFIG.domain);

// Start WebSocket server as endpoint for domain internal and external stub connections
let server = new WSServer( MN_CONFIG);
server.start();
