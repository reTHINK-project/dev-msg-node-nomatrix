import MNManager from './common/MNManager';
import WSServer from './ws/WSServer';
import RethinkBridge from './bridge/RethinkBridge';
var MN_CONFIG = require('./config');

// initialize the MNManager singleton with domain from global config
MNManager.getInstance(MN_CONFIG.domain, MN_CONFIG.matrixDomain);

// start Matrix Application Service Bridge that acts as Protocol-on-the-fly endpoint
let rethinkBridge = new RethinkBridge(MN_CONFIG);
rethinkBridge.start();

// Start WebSocket server as endpoint for domain internal and external stub connections
let server = new WSServer( MN_CONFIG, rethinkBridge );
server.start();
