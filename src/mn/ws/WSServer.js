import MNManager from '../common/MNManager';
import WSHandler from './WSHandler';

/**
 * The MatrixMN implements the connection endpoint for a matrix protocol stub.
 * It will receive requests via a Websocket and create Matrix clients on request.
 * This allows to add the missing policy features to the messaging path.
 */
 export default class WSServer {

  /**
   * construction of the WSServer
   * @param  {Object} config      configuration object
   * @param  {...}
   */
  constructor(config, bridge) {
    this.WebSocketServer = require('websocket').server;
    this.http = require('http');
    this._bridge = bridge;
    this._config = config;
    this._wsHandlers = {};
  }

  /**
   * Start and initialize the Websocket endpoint of the Matrix MessagingNode.
   *
   */
  start() {
    var httpServer = this.http.createServer( () => {} ).listen(
      this._config.WS_PORT, () => {
        console.log((new Date()) + " MatrixMN is listening on port " + this._config.WS_PORT);
      }
    );

    let wsServer = new this.WebSocketServer( { httpServer: httpServer });
    wsServer.on('request', (request) => {
      this._handleRequest(request);
    });
  }


  _handleRequest(request) {
    let path = request.resourceURL.path;
    console.log("\n %s: received connection request from: %s origin: %s path: %s", (new Date()), request.remoteAddress, request.origin, path );

    if ( request.resourceURL.path !== "/stub/connect" ) {
      request.reject(403, "Invalid handshake!");
      return;
    }

    var con = request.accept(null, request.origin);
    con.on('close', () => {
      this._handleClose(con);
    });

    // inject an id into the con object for later identification
    con.clientID = MNManager.getInstance().generateUUID();
    console.log("---> injected clientID " + con.clientID);

    // let a new instance of wsHandler handle the connection traffic
    this._wsHandlers[ con.clientID ] = new WSHandler( this._config, con, this._bridge );
  }


  _handleClose( con ) {
    console.log("closing connection with clientID: " + con.clientID);
    var wsHandler = this._wsHandlers[ con.clientID ];
    if ( wsHandler ) {
      // cleanup and remove wsHandler that was responsible for this connection
      wsHandler.cleanup();
      delete this._wsHandlers[ con.clientID ];
    }
  }

}
