import MNManager from '../common/MNManager';
import SubscriptionHandler from '../subscription/SubscriptionHandler';


/**
 * This class wraps the matrix bridge stuff.
 */
export default class RethinkBridge {

  /**
   * Constructor of RethinkBridge. Initializes and instantiates everything necessary.
   * @param config {Object} configuration of the Matrix Messaging Node
   **/
  constructor(config) {
    this._Cli = require("matrix-appservice-bridge").Cli;
    this._Bridge = require("matrix-appservice-bridge").Bridge;
    this._AppServiceRegistration = require("matrix-appservice-bridge").AppServiceRegistration;
    this._cli = null;
    this._config = config;
    this.bridge = null;
    this._mnManager = MNManager.getInstance();
    this._subscriptionHandler = SubscriptionHandler.getInstance(this._config.domain);
    this._clients = null; // TODO: remove when all errors are found
    this._intents = new Map();
  }

  start() {
    this._cli = new this._Cli({
      registrationPath: this._config.registration,
      generateRegistration: (reg, callback) => {
        this._generateRegistration(reg, callback)
      },
      run: (port) => {
        this._runCli(port, this._config)
      }
    }).run();
  }

  /**
   * The function looks for an existing intent in the local map.
   * It will create a transient MatrixUser from the userId of the wsHandler.
   * @param wsHandler {WSHandler} the runtime's wsHandler instance
   * @return {Promise} created Intent for the MatrixUser
   **/
  getInitializedIntent(wsHandler) {
    return new Promise((resolve, reject) => {
      try {
        let intent = this._intents.get(wsHandler.getMatrixId());
        if (intent) {
          console.log("+[RethinkBridge] [getInitializedIntent] Client already exists --> updating wsHandler reference and returning directly");
          if ( wsHandler )
            intent.wsHandler = wsHandler;
          // else // probably not critical
          //   console.log("+[RethinkBridge] [getInitializedIntent] Client already exists --> wsHandler not updated");
          resolve(intent);
        } else {
          var intent = this.bridge.getIntent(wsHandler.getMatrixId()); // TODO: check if the bridge is already doing something like this._intents.get(wsHandler.getMatrixId());

          intent.setDisplayName(wsHandler.getMatrixId()) // invoke _ensureRegistered function
          .then(() => {
            console.log("+[RethinkBridge] [getInitializedIntent] starting Client for MatrixUserId '%s'", wsHandler.getMatrixId());
            intent.client.startClient( {"initialSyncLimit" : 100 }); // ensure that the last 100 events are emitted / syncs the client
          });

          intent.client.on("event", function(event){ // listen for any event
            intent.onEvent(event); // inform the intent so it can do optimizations
          });

          intent.client.on('syncComplete', () => { // sync events / catch up on events
            console.log("+[RethinkBridge] [getInitializedIntent] client sync completed for MatrixID '%s' ", wsHandler.getMatrixId());
            if (wsHandler) {
              intent.wsHandler = wsHandler;
              this._intents.set(wsHandler.getMatrixId(), intent); // map MatrixUserId to MatrixUserIntent
              resolve(intent);
            } else {
              console.error("+[RethinkBridge] [getInitializedIntent] ERROR: no wsHandler present");
              reject("no wsHandler present");
            }
          });

          // probably replacable with "Room" event
          intent.client.on('Room.timeline', (e, room) => { // timeline in a room is updated
            // SDR: handling should be done in the WSHandler
            if (intent.wsHandler)
              intent.wsHandler.handleMatrixMessage(e, room);
          });

          intent.client.on("RoomMember.membership", (e, member) => { // membership of a roommember changed
            if (intent.wsHandler)
              intent.wsHandler.handleMembershipEvent(e, member)
          });

          // intent.client.on("Room", function(room){ // room is added (on invitation and join to a room)
          //   console.log("+[RethinkBridge] room added :", room.roomId);
          // });

          //"RoomState.newMember" // member is added to the members dictionary

          // client.sendEvent(roomId, type, content) // http://matrix-org.github.io/matrix-appservice-bridge/0.1.3/components_intent.js.html
          // client.getRoom(roomId) → {Room}
          // client.getRoomIdForAlias(alias, callback)
          // client.joinRoom(roomIdOrAlias, opts, callback)
          // client.leave(roomId, callback)
          // client.sendMessage(roomId, content, txnId, callback)
          // client.scrollback(room, limit, callback) // retrieve older messages from room, put them in the timeline
          // see m.room.history_visibility "shared" -> http://matrix.org/docs/spec/r0.0.0/client_server.html#room-history-visibility
          // client.getRoomIdForAlias(alias, callback) //????


          //client.once(event, listener) adds a one time listener for a event
        }
      }
      catch (e) {
        console.log("+[RethinkBridge] ERROR: " + e);
        reject(e);
      }
    });
  }

  cleanupClient(userId) {
    console.log("+[RethinkBridge] releasing wsHandler reference in client for id %s", userId );
    let intent = this._intents.get(userId);
    if ( intent ) {
      delete intent.wsHandler;
      // SDR:
      // if (intent.client) intent.client.stopClient(); // TODO: verify actions
      // this._intents.delete(userId); // TODO: verify that this is neccessary due to internal appservice-storage
    }
  }


  getHomeServerURL() {
    return this._config.homeserverUrl;
  }


  /**
   * Generates an ApplicationService configuration file that has to be referenced in the homeserver.yaml.
   */
  _generateRegistration(reg, callback) {
    reg.setHomeserverToken(AppServiceRegistration.generateToken());
    reg.setAppServiceToken(AppServiceRegistration.generateToken());
    reg.setSenderLocalpart("rethinkMN");
    reg.addRegexPattern("aliases", this._mnManager.ROOM_PREFIX , true);
    reg.addRegexPattern("users", this._mnManager.USER_PREFIX , true);
    callback(reg);
  }

  _runCli(port, config) {
    let _this = this;
    this._config = config;
    this.bridge = new this._Bridge({
      homeserverUrl: config.homeserverUrl,
      domain: config.domain,
      registration: config.registration,

      controller: {
        onUserQuery: (queriedUser) => {
          console.log("onUserQuery called for userid: %s", queriedUser);
          return {};
        },

        onEvent: (request, context) => {
          // console.log("+[RethinkBridge] runCli onEvent ");
          // console.log("+[RethinkBridge] runCli onEvent request: ", request);
          // console.log("+[RethinkBridge] runCli onEvent context: ", context);
          // var event = request.getData();
          // if (event.type !== "m.room.message" || !event.content || event.content.sender === this._mnManager.AS_NAME)
          //   return;
          // console.log("+[RethinkBridge] BRIDGE EVENT on runCli --> ignoring");
          // return;
        }
      }
    });
    console.log("Matrix-side AS listening on port %s", port);
    this.bridge.run(port, config);
  }

}
