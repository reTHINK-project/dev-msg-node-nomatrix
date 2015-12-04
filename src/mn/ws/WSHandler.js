import MatrixClient from "../client/MatrixClient";

var Promise = require('promise');

/**
 * This class implements a handler for a single WebSocket connection from a stub.
 * This connection can either be a domain-internal or -external connection.
 * In case of an internal stub-connection we attempt a Login to the Matrix HS with
 * the given credentials.
 * In case of an external stub-connection, we handover the handling to the RethinkBridge,
 * which is able to act on behalf of non-matrix users.
 **/
export default class WSHandler {

  /**
   * Constructs a new WSHandler for one dedicated Websocket connection.
   * @param wsCon {WebSocketConnection} .. the websocket connection to handle
   * @param bridge {RethinkBridge} .. reference to the RethinkBridge as potential handler for external stub
   **/
  constructor(config, wsCon, bridge) {
    this.id = wsCon.clientID;
    this._config = config;
    this._wsCon = wsCon;
    this._bridge = bridge;
    this._runtimeStubUrl = null;
    this._matrixClient = null;
    // install message handler inside this Client instance
    this._wsCon.on('message', (msg) => {
      this._handleWSMsg(msg)
    });
    this._firstMsg = true;
  }

  /**
   * Performs all necessary actions to clean up this WSHandler instance before it can be destroyed.
   **/
  cleanup() {
    console.log("cleaning up WSHandler with id: " + this._wsCon.clientID);
    // TODO: cleanup address--> handler Mapping in MNMAnager
    if (this._matrixClient)
      this._matrixClient.cleanup();
  }

  /**
   * Sends a message to the handled WebSocket.
   * The message is stringified before it is sent out.
   * @param msg {Object} ... The message to be sent.
   **/
  sendWSMsg(msg) {
    let s = JSON.stringify(msg);
    console.log("WSHandler for id %s sends via websocket %s", this.id, s);
    this._wsCon.send(s);
  }


  /**
   * Callback that is invoked on messages arriving via the Websocket.
   * @param msg (Message) .. Message object that arrived via the websocket
   **/
  _handleWSMsg(msg) {
    let jsonMsg;
    console.log("WSHandler for id %s received msg: %s", this.id, msg.utf8Data);

    if (msg.type === "utf8" && (msg.utf8Data.substr(0, 1) === "{"))
      jsonMsg = JSON.parse(msg.utf8Data);

    if (!this._firstMsg) {

      if (this._matrixClient)
        // if we have a matrixClient let this one handle this msg
        this._matrixClient.handleWSMsg(jsonMsg);

      else
        //  let the bridge do it otherwise
        this._bridge.handleStubMessage(jsonMsg, this);

    } else {
      // Handle first message that was received via this websocket.
      // This can either be a "login" msg from an internal domain client
      // or a msg coming from an externally connected stub.
      // In case of a successful login, the instance of the MatrixClient is returned for further msg handling
      this._handleFirstMessage(jsonMsg).then( (matrixClient) => {
        if ( matrixClient ) {
          // "install" MatrixClient instance for further message processing
          this._matrixClient = matrixClient;
          console.log("####### assigned matrixClient: " + this._matrixClient);
        }
      });
    }

    this._firstMsg = false;
  }

  /**
   * The first arriving message is used to separate between a domain-internal or -external connection.
   * Internal messages must contain valid login credentials for the Matrix HomeServer that is maintained by this MN.
   * A matrixClient will be instantiated and a login will be attempted in this case. If successful, this matrixClient
   * will be used to handle all subsequent messages coming in via this socket. The socket will be closed immediately,
   * if the login attempt was not successful.
   *
   * External messages are forwarded directly to the rethinkBridge and handled there.
   * @param msg (Message) .. first Message object that arrived via the websocket
   * @return a MatrixClient instance, if credentials where given and login was successful, or null otherwise
   **/
  _handleFirstMessage(msg) {
    // check cmd of first command, "login" means internal (intra-domain) connection --> trying to login with given credentials
    return new Promise( (resolve, reject) => {

      if (msg.cmd === "login" && msg.data.credentials) {

        this._matrixLogin(msg.data.credentials).then( (matrixClient) => {
          resolve(matrixClient);
        });
      }
      else if (msg.cmd == "external-login") {

        // connection from external domain --> let the AS bridge handle this msg
        // TODO: implement a type of authentication for external stub connects
        this._bridge.handleStubMessage(msg);
        console.log("+++++ bridge handling over");
        this.sendWSMsg({
          cmd: "external-login",
          response: 200,
          data: {
            msg: "external connect successful"
          }
        });
        resolve();
      }
    });
  }


  /**
   * Attempts to perform a login to the Matrix Homeserver with the given credentials.
   * @param credentials {Object} .. matrix credentials, can be either a pure access_token or a username/password combination
   * @return a MatrixClient instance, login with given credentials was successful, or null otherwise
   **/
  _matrixLogin(credentials) {
    console.log("received login command as first message --> creating MatrixClient and attempting matrix login");

    return new Promise( (resolve, reject) => {

      // create an instance of the MatrixClient to handle this connection further on.
      let matrixClient = new MatrixClient(this, this._config);
      matrixClient.login(credentials).then((access_token) => {

        console.log("logged in with validated token: " + access_token);
        // send back the validated access_token with a 200 response
        this.sendWSMsg({
          cmd: "login",
          response: 200,
          data: {
            token: access_token
          }
        });
        // login was successful --> return matrixClient for further message handling
        resolve(matrixClient);
      }, (err) => {
        console.log("error during login: " + err)
          // send back a 403 response if login failed
        this.sendWSMsg({
          cmd: "login",
          response: 403,
          data: {}
        });
        reject();
      });
    });
  }
}
