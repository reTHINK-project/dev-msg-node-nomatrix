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
    this._handlers = new Map();
    this._mnManager = MNManager.getInstance();
  }

  /**
   * Start and initialize the Websocket endpoint of the Matrix MessagingNode.
   *
   */
  start() {
    var httpServer = this.http.createServer(() => {}).listen(
      this._config.WS_PORT, () => {
        console.log((new Date()) + " MatrixMN is listening on port " + this._config.WS_PORT);
      }
    );

    let wsServer = new this.WebSocketServer({
      httpServer: httpServer
    });
    wsServer.on('request', (request) => {
      this._handleRequest(request);
    });
  }


  _handleRequest(request) {
    let path = request.resourceURL.path;
    console.log("\n %s: received connection request from: %s origin: %s path: %s", (new Date()), request.remoteAddress, request.origin, path);

    if (request.resourceURL.path !== "/stub/connect") {
      request.reject(403, "Invalid request path!");
      return;
    }

    var con = request.accept(null, request.origin);
    con.on('message', (msg) => {
      this._handleMessage(con, msg);
    });
    con.on('close', () => {
      this._handleClose(con);
    });

  }


  _handleMessage(con, msg) {
    let m;
    console.log("Connection received msg: %s", msg.utf8Data);

    if (msg.type === "utf8" && (msg.utf8Data.substr(0, 1) === "{"))
      m = JSON.parse(msg.utf8Data);

    // if its not a fresh connection the connection should have a runtimeURL injected
    if (con.runtimeURL) {

      let handler = this._handlers.get(con.runtimeURL);
      if (handler) {
        // check for disconnect command from stub with proper runtimeURL
        if ( m.cmd === "disconnect" && m.data.runtimeURL === con.runtimeURL) {
          // cleanup handler itself
          handler.cleanup();
          // remove all mappings of addresses to this handler
          this._mnManager.removeHandlerMappingsForRuntimeURL(con.runtimeURL);
          // remove handler from own housekeeping
          this._handlers.delete(con.runtimeURL);
          try {
            con.close();
          }
          catch(e) {}
        }
        else
          handler.handleStubMessage(m, this);
      }
      else
        console.log("??? no matching StubHandler found for runtimeURL %", con.runtimeURL);

    }
    else {
      // handle first message that was received via this websocket.
      if (m.cmd === "connect" && m.data.runtimeURL) {
        // use given runtimeURL as ID and inject it to the con object for later identification
        con.runtimeURL = m.data.runtimeURL;
        console.log("got runtimeURL %s", con.runtimeURL);

        this._createHandler(con.runtimeURL, con).then(() => {
          this._sendResponse(con, 200, "Connection accepted!");
        });
      } else {
        this._sendResponse(con, 403, "Invalid handshake!");
        con.close();
      }
    }
  }

  /**
   * lazy creation of handlers
   * performs all actions to instantiate, initialize and register a handler, if necessary
   * returns existing instance otherwise
   */
  _createHandler(runtimeURL, con) {
    return new Promise((resolve, reject) => {

      let handler = this._handlers.get(runtimeURL);
      if (handler) {
        console.log("found existing handler");
        handler.updateCon(con);
        resolve(handler);
      }
      else {
        let userId = this._mnManager.createUserId(runtimeURL);
        console.log(" userid is %s ", userId);
        let handler = new WSHandler(this._config, con, userId);
        console.log("created new handler");

        // perform handler initialization (creation and syncing of the intent)
        handler.initialize(this._bridge).then(() => {
          this._handlers.set(runtimeURL, handler);
          console.log("---> Created and initialized new StubHandler for runtimeURL %s with userID %s ", con.runtimeURL, userId);

          // add mapping of given runtimeURL to this handler
          this._mnManager.addHandlerMapping(runtimeURL, handler);
          resolve(handler);
        })
      }
    });
  }

  _sendResponse(con, code, msg) {
    con.send(JSON.stringify({
      cmd: "connect",
      response: code,
      data: {
        msg: msg
      }
    }));
  }

  _handleClose(con) {
    console.log("closing connection runtimeURL: " + con.runtimeURL);
    var handler = this._handlers.get(con.runtimeURL);
    if (handler) {
      handler.releaseCon();
    }
  }
}
