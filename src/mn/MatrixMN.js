import MNManager from './common/MNManager';
import WSServer from './ws/WSServer';
import RethinkBridge from './bridge/RethinkBridge';

// WS port for domain internal or external connections
let MN_CONFIG = {
  WS_PORT : 8001,
  homeserverUrl: "http://localhost:8008",
  domain: "matrix.docker",
  registration: "rethink-mn-registration.yaml"
};


// initialize the MNManager singleton with domain from global config
MNManager.getInstance(MN_CONFIG.domain);

// start Matrix Application Service Bridge that acts as Protocol-on-the-fly endpoint
let rethinkBridge = new RethinkBridge(MN_CONFIG);
rethinkBridge.start();

// Start WebSocket server as endpoint for domain internal and external stub connections
let server = new WSServer( MN_CONFIG, rethinkBridge );
server.start();
