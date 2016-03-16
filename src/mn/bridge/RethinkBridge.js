import MNManager from '../common/MNManager';
import PDP from '../policy/PDP';
import SubscriptionHandler from '../subscription/SubscriptionHandler';


// let ROOM_PREFIX = "_rethink_";

/**
 * This class wraps the matrix bridge stuff.
 */
export default class RethinkBridge {

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
    this._pdp = new PDP();
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
   * looks for existing intent in local map
   * creates a transient UserId from the given hash,
   * @return Promise with created Intent
   **/
  getInitializedIntent(userId, wsHandler) {
    return new Promise((resolve, reject) => {
      try {
        let intent = this._intents.get(userId);
        if (intent) {
          console.log("+[RethinkBridge] Client already exists --> updating wsHandler reference and returning directly");
          if ( wsHandler )
            intent.wsHandler = wsHandler;
          else // probably not critical
            console.log("+[RethinkBridge] Client already exists --> wsHandler not updated");
          resolve(intent);
        } else {
          var intent = this.bridge.getIntent(userId);

          intent.setDisplayName(userId) // invoke _ensureRegistered function
          .then(() => {
            console.log("+[RethinkBridge] starting Client for user %s", userId);
            this._intents.set(userId, intent);
            intent.client.startClient(100); // ensure that the last 100 events are emitted / syncs the client
          });

          intent.client.on("event", function(event){ // listen for any event
            intent.onEvent(event); // inform the intent so it can do optimizations
          });


          intent.client.on('syncComplete', () => { // sync events / catch up on events
            console.log("+[RethinkBridge] [getInitializedIntent] client SYNC COMPLETE for %s ", userId);
            if (wsHandler) {
              intent.wsHandler = wsHandler;
              this._intents.set(userId, intent); // map userId to MatrixUser
              // before resolve: room could be created as this is blocking the client anyway, so timing issues could be overcome
              resolve(intent);
            } else {
              console.error("+[RethinkBridge] no wsHandler present");
              reject("no wsHandler present");
            }
          });

          // probably replacable with "Room" event
          intent.client.on('Room.timeline', (e, room) => { // timeline in a room is updated
            this._handleMatrixMessage(e, room, intent, wsHandler)
          });

          intent.client.on("RoomMember.membership", (e, member) => { // membership of a roommember changed
            this._handleMembershipEvent(intent, member, userId)
          });


          intent.client.on("Room", function(room){ // room is added (on invitation and join to a room)
            console.log("+[RethinkBridge] room added :", room.roomId);
          });


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

  _handleMembershipEvent(intent, member, myUserId) { // equals "m.room.member" event
    // TODO: only auto-join, if room prefix matches automatically created rooms
    console.log("+[RethinkBridge] [handleMembershipEvent] $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$");
    if (member.membership === "invite" && member.userId === myUserId) {
      console.log("+[RethinkBridge] [handleMembershipEvent] intent received MEMBERSHIP INVITE EVENT %s for member: %s", member.membership, member.userId);
      // console.log("+[RethinkBridge] Intent: ", intent);
      // console.log("+[RethinkBridge] member: ", member);
      // console.log("+[RethinkBridge] myUserId: ", myUserId);
       intent.client.joinRoom(member.roomId)
       .then((room) => {
         console.log("+[RethinkBridge] [_handleMembershipEvent] %s Auto-joined %s", member.userId, member.roomId );
         console.log("+[RethinkBridge] [_handleMembershipEvent] room: ", room.roomId);
       })
       .catch((err) => {
         console.error("+[RethinkBridge] [_handleMembershipEvent]: ",err);
       });
    }
  }

  _handleMatrixMessage(event, room, intent, wsHandler) {
    console.log("+[RethinkBridge] [_handleMatrixMessage] handle matrixmsg event.type: " , event.event.type);
    // console.log("+[RethinkBridge] handle matrixmsg room: "  , room);
    // console.log("+[RethinkBridge] handle matrixmsg intent: ", intent);

    let e = event.event;

    if (e.type == "m.room.message") {
      console.log("+[RethinkBridge] [_handleMatrixMessage] EVENT m.room.message");
    }

    // only interested in events coming from real internal matrix Users
    if ( e.type == "m.room.message" && e.user_id.indexOf(this._mnManager.USER_PREFIX) === 0 ){
      console.log("+[RethinkBridge] [_handleMatrixMessage] Intent received timelineEvent of type m.room.message - userid: ", intent.client.userId);
      let m = e.content.body;
      try       { m = JSON.parse(m); }
      catch (e) { console.error(e); return; }

      // let wsHandler = this._mnManager.getHandlerByAddress(m.to);
      if ( wsHandler ) {
        // TODO: handle roominvites
        console.log("+[RethinkBridge] [_handleMatrixMessage] forwarding this message to the stub via corresponding wsHandler");
        wsHandler.sendWSMsg(m);
      }
      else {
        console.log("+[RethinkBridge] [_handleMatrixMessage] no corresponding wsHandler found for to-address: ", m.to);
      }
    }

    if ( e.type == "m.room.member" ) {
      console.log("+[RethinkBridge] [_handleMatrixMessage] EVENT m.room.member: ", e);
    }

  }

  cleanupClient(userId) {
    console.log("+[RethinkBridge] releasing wsHandler reference in client for id %s", userId );
    let intent = this._intents.get(userId);
    if ( intent ) {
      delete intent.wsHandler;
      if (intent.client) intent.client.stopClient(); // TODO: verify actions
      this._intents.delete(userId); // TODO: verify that this is neccessary due to internal appservice-storage
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
