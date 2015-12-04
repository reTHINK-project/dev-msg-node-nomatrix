
/**
 * ProtoStub Interface
 */
export default class ProtoStubMatrix {

  /**
   * Initialise the protocol stub including as input parameters its allocated
   * component runtime url, the runtime BUS postMessage function to be invoked
   * on messages received by the protocol stub and required configuration retrieved from protocolStub descriptor.
   * @param  {URL.RuntimeURL}                            runtimeProtoStubURL runtimeProtoSubURL
   * @param  {Message.Message}                           busPostMessage     configuration
   * @param  {ProtoStubDescriptor.ConfigurationDataList} configuration      configuration
   */
  constructor(runtimeProtoStubURL, miniBus, configuration) {
    this._runtimeProtoStubURL = runtimeProtoStubURL;
    this._configuration = configuration;
    this._bus = miniBus;
    this._identity = null;
    this._ws = null;
    this._bus.addListener('*', (msg) => {
        this._sendWSMsg(msg);
    });
  }

  /**
   * Connect the protocol stub to the back-end server.
   * @param  {IDToken} identity identity .. this can be either an idtoken,
   *         or a username/password combination to authenticate against the Matrix HS
   */
  connect(identity) {

    this._identity = identity;


    return new Promise((resolve, reject) => {
      // create socket towards the MN
      this._ws = new WebSocket(this._configuration.messagingnode);
      this._ws.onopen = () => {
        this._onWSOpen()
      };

      // message handler for initial handshake
      this._ws.onmessage = (msg) => {

        let m = JSON.parse(msg.data);
        if (m.response === 200) {
          // install default msg handler and resolve
          this._ws.onmessage = (m) => { this._onWSMessage(m) };
          resolve(m.data.token);
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
    this._ws.close();
  }

  _sendWSMsg(msg) {
    this._ws.send(JSON.stringify(msg));
  }

  _onWSOpen() {
    // console.log("initial WS to Matrix MN opened");
    let msg = null;
    if (this._identity) {
      // msg with credentials for domain internal login
      msg = {
        cmd: "login",
        data: {
          credentials: this._identity,
          runtimeProtoStubURL: this._runtimeProtoStubURL
        }
      }
    } else {
      // msg without credentials for extra-domain login
      msg = {
        cmd: "external-login",
        data: {
          runtimeProtoStubURL: this._runtimeProtoStubURL
        }
      };

    }
    this._sendWSMsg(msg);
  }

  // parse msg and deploy it locally via miniBus
  _onWSMessage(msg) {
    this._bus.postMessage(JSON.parse(msg.data));
  }

  _onWSClose() {
    // console.log("websocket closed");
  }

  _onWSError(err) {
    // console.log("websocket error: " + err);
  }

}
