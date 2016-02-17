
/**
 * ProtoStub Interface
 */
class MatrixProtoStub {

  /**
   * Initialise the protocol stub including as input parameters its allocated
   * component runtime url, the runtime BUS postMessage function to be invoked
   * on messages received by the protocol stub and required configuration retrieved from protocolStub descriptor.
   * @param  {URL.runtimeProtoStubURL}                            runtimeProtoStubURL runtimeProtoSubURL
   * @param  {Message.Message}                           busPostMessage     configuration
   * @param  {ProtoStubDescriptor.ConfigurationDataList} configuration      configuration
   */
  constructor(runtimeProtoStubURL, miniBus, configuration) {
    this._runtimeProtoStubURL = runtimeProtoStubURL;
    this._runtimeURL = configuration.runtimeURL;
    this._configuration = configuration;
    this._bus = miniBus;
    this._identity = null;
    this._ws = null;
    this._bus.addListener('*', (msg) => {
        this._assumeOpen = true;
        this._sendWSMsg(msg);
    });
    this._assumeOpen = false;
  }

  /**
   * Connect the protocol stub to the back-end server.
   * @param  {IDToken} identity identity .. this can be either an idtoken,
   *         or a username/password combination to authenticate against the Matrix HS
   */
  connect(identity) {

    this._identity = identity;
    this._assumeOpen = true;

    return new Promise((resolve, reject) => {

      if ( this._ws && this._ws.readyState === 1) {
        resolve(this._ws);
        return;
      }

      // create socket to the MN
      this._ws = new WebSocket(this._configuration.messagingnode);
      this._ws.onopen = () => {
        this._onWSOpen()
      };

      // message handler for initial handshake only
      this._ws.onmessage = (msg) => {

        let m = JSON.parse(msg.data);
        if (m.response === 200) {
          // install default msg handler, send status and resolve
          this._ws.onmessage = (m) => { this._onWSMessage(m) };
          this._sendStatus("connected");
          resolve(this._ws);
        } else {
          reject();
        }
      };

      this._ws.onclose = () => {
        this._onWSClose()
      };
      this._ws.onerror = () => {
        this._onWSError()
      };
    });
  }

  /**
   * To disconnect the protocol stub.
   */
  disconnect() {
    // send disconnect command to MN to indicate that resources for this runtimeURL can be cleaned up
    // the close of the websocket will be initiated from server side
    this._sendWSMsg({
      cmd: "disconnect",
      data: {
        runtimeURL: this._runtimeURL
      }
    });
    this._assumeOpen = false;
  }

  _sendWSMsg(msg) {
    if ( this._assumeOpen )
      this.connect().then( () => {
        this._ws.send(JSON.stringify(msg));
      });
  }

  _sendStatus(value, reason) {
    let msg = {
      type: 'update',
      from: this._runtimeProtoStubURL,
      to: this._runtimeProtoStubURL + '/status',
      body: {
        value: value
      }
    };
    if (reason) {
      msg.body.desc = reason;
    }

    this._bus.postMessage(msg);
  }


  _onWSOpen() {
    this._sendWSMsg({
      cmd: "connect",
      data: {
        runtimeURL: this._runtimeURL
      }
    });
  }

  // parse msg and forward it locally to miniBus
  _onWSMessage(msg) {
    this._bus.postMessage(JSON.parse(msg.data));
  }

  _onWSClose() {
    //console.log("websocket closed");
    this._sendStatus("disconnected");
  }

  _onWSError(err) {
    // console.log("websocket error: " + err);
  }
}

export default function activate(url, bus, config) {
  return {
    name: 'MatrixProtoStub',
    instance: new MatrixProtoStub(url, bus, config)
  };
}
