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
  constructor(config) {
    this.WebSocketServer = require('websocket').server;
    this.http = require('http');
    this._config = config;
    this._mnManager = MNManager.getInstance();
  }

  /**
   * Start and initialize the Websocket endpoint of the Matrix MessagingNode.
   *
   */
  start() {
    console.log("\n>>> restoring subscriptions from persistence ..." );
    this._mnManager.storage_restoreSubscriptions().then(() => {
      console.log("<<< DONE! Subscriptions recovered \n");
      var httpServer = this.http.createServer(() => {}).listen(
        this._config.WS_PORT, () => {
          console.log("+[WSServer] [start] " + (new Date()) + " MatrixMN is listening on port " + this._config.WS_PORT);
        }
      );
      let wsServer = new this.WebSocketServer({
        httpServer: httpServer
      });
      wsServer.on('request', (request) => {
        this._handleRequest(request);
      });
    })
  }

  _handleRequest(request) {
    let path = request.resourceURL.path;
    let runtimeURL = request.resourceURL.query.runtimeURL;
    if ( runtimeURL )
      runtimeURL = decodeURIComponent(runtimeURL);
    console.log("\n-----------------\n+[WSServer] [_handleRequest] %s: received connection request from: %s origin: %s path: %s", (new Date()), request.remoteAddress, request.origin, path);
    console.log("+[WSServer] [_handleRequest] %s: runtimeURL is: %s", (new Date()), runtimeURL);

    if (! path || !path.startsWith("/stub/connect?runtimeURL=")) {
      console.log("+[WSServer] [_handleRequest] wrong request-path --> rejecting request with 403");
      request.reject(403, "Invalid request path!");
      return;
    }
    if ( ! runtimeURL ) {
      console.log("+[WSServer] [_handleRequest] value for runtimeURL parameter missing --> rejecting request with 403");
      request.reject(403, "runtimeURL Parameter is missing!");
      return;
    }

    // use given runtimeURL as ID and inject it to the con object for later identification
    console.log("+[WSServer] [_handleMessage] external stub connection with runtimeURL %s", runtimeURL);
    let con = request.accept(null, request.origin);
    con.runtimeURL = runtimeURL;

    this._createHandler(con.runtimeURL, con);

    con.on('message', (msg) => {
      this._handleMessage(con, msg);
    });
    con.on('close', () => {
      this._handleClose(con);
    });
  }


  _handleMessage(con, msg) {
    let m;
    // console.log("+[WSServer] [_handleMessage] Connection received msg: %s", msg.utf8Data);

    if (msg.type === "utf8" && (msg.utf8Data.substr(0, 1) === "{"))
      m = JSON.parse(msg.utf8Data);

    if ( !m ) {
      console.log("+[WSServer] received un-parsable message %. --> ignoring", msg.utf8Data);
      return;
    }

    // if its not a fresh connection the connection should have a runtimeURL injected
    if (con.runtimeURL) {
      let handler = this._mnManager.getHandler(con.runtimeURL);
      if (handler) {
        // check for disconnect command from stub with proper runtimeURL
        if ( m.cmd === "disconnect" && m.data.runtimeURL === con.runtimeURL) {
          console.log( "+[WSServer] [_handleMessage] DISCONNECT command from %s ", m.data.runtimeURL );

          // cleanup handler and related resources
          handler.cleanup();
          // remove handler from own housekeeping
          this._mnManager.deleteHandler(con.runtimeURL);
          try {
            con.close();
          }
          catch(e) {}
        }
        else
          handler.handleStubMessage(m, this);
      }
      else
        console.log("+[WSServer] [_handleMessage] no matching StubHandler found for runtimeURL %", con.runtimeURL);

    }
    else {
      console.log("+[WSServer] [_handleMessage] no runtimeURL found in connection --> can't handle message ...");
    }
  }

  /**
   * lazy creation of handlers
   * performs all actions to instantiate, initialize and register a handler, if necessary
   * returns existing instance otherwise
   */
  _createHandler(runtimeURL, con) {
    return new Promise((resolve, reject) => {

      let handler = this._mnManager.getHandler(runtimeURL);
      if (handler) {
        console.log("+[WSServer] [_createHandler] found existing handler --> updating connection %s", con);
        handler.updateCon(con);
        resolve(handler);
      }
      else {
        let handler = new WSHandler(this._config, runtimeURL, con);

        // perform handler initialization (creation and syncing of the intent)
        handler.initialize().then(() => {

          this._mnManager.addHandler(runtimeURL, handler);
          console.log("+[WSServer] [_createHandler] created and initialized WSHandler for runtimeURL %s with connection %s", runtimeURL, con);

          // add mapping of given runtimeURL to this handler
          this._mnManager.addHandlerMapping(runtimeURL, runtimeURL);

          resolve();
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
    console.log("\n-----------------\n+[WSServer] [_handleClose] closing connection to runtimeURL: " + con.runtimeURL);
    var handler = this._mnManager.getHandler(con.runtimeURL);
    if (handler) {
      handler.releaseCon();
    }
  }
}
