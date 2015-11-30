import MNManager from '../common/MNManager';

// let ROOM_PREFIX = "_rethink_";
let ROOM_PREFIX = "rethinkExternal_";

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
   * Handles a message coming in from an external stub.
   * These messages must be routed to the correct room that establishes the connection between the messages "from" and "to".
   * If such room does not exist, it will be created on behalf of "from", "to" will be invited and the message will be sent.
   * @param msg {reThink message}
   **/
  handleStubMessage(msg, wsHandler) {
    // TODO: utility to validate retHINK message

    console.log("++++++++++ AS-bridge: handling stub msg: %s", JSON.stringify(msg));
    let type = msg.type;
    let from = msg.from;
    let to = msg.to;

    if (!to || !from || !type) {
      console.log("+++++++ this is no reTHINK message --> ignoring ...");
      return;
    }

    // map given WSHandler to "from"-address of this request
    this._mnManager.addHandlerMapping(from, wsHandler);

    // to-address should be managed by this MN, therefore we should have a mapping in the Manager
    let targetUserId = this._mnManager.getMatrixUserIdByAddress(to);
    if (targetUserId) {
      console.log("+++++++++++ found matching userId %s for target address %s", targetUserId, to);

      // get an Intent for the external user. Key is the Hash. The intent will either be taken from the map or
      // created new. In both cases the returned intent is already synced, so that we have access to its rooms.
      this._getSyncedIntent(from).then((intent) => {

        // does the intents client share a room with targetUserId ?
        let sharedRoom = this._getRoomWith(intent.client.getRooms(), targetUserId );
        if ( sharedRoom ) {
          console.log("+++++++ found shared Room with %s, roomId is %s --> sending message ...", targetUserId, sharedRoom.roomId);
          intent.sendText(sharedRoom.roomId, JSON.stringify(msg));
        }
        else {
          // merging hash of from-user and to-user for the room-alias, so that we can re-use existing rooms
          let internalHash = this._mnManager.hashCode(targetUserId);
          let alias = ROOM_PREFIX + internalHash + "_" + externalUserHash;

          console.log("+++++++ NO shared room with targetUserId %s exists already --> creating such a room with alias %s...", targetUserId, alias);
          intent.createRoom({
            createAsClient: true,
            options: {
              room_alias_name: alias,
              visibility: 'private',
              invite: [targetUserId]
            }
          }).then((r) => {
            console.log("++++++++ new room created with id %s and alias %s", r.room_id, r.room_alias);

            // send Message, if targetUser has joined the room
            new Promise((resolve, reject) => {
              intent.onEvent = (e) => {
                // wait for the notification that the targetUserId has (auto-)joined the new room
                if (e.type === "m.room.member" && e.user_id === targetUserId && e.content.membership === "join" && e.room_id === r.room_id) {
                  resolve(e.room_id);
                }
              }
            }).then((room_id) => {
              console.log("+++++++ %s has joined room %s --> sending message ...", targetUserId, room_id);
              intent.sendText(r.room_id, JSON.stringify(msg));
            });
          }, (err) => {
            console.log("+++++++ error while creating new room for alias %s --> not sending message now", alias);
          });
        }
      });
    } else {
      // no matching targetUserId found
      console.log("+++ Unable to match target Hyperty address to a Matrix-User ID --> seems that this user is unknown to this Matrix-HS, can't forward this message")
    }
  }

  // try to find a room that is shared with the given userId, i.e. both are joined members
  // TODO: add check for number of members to ensure that only the intended peer gets the message
  _getRoomWith(rooms, userId) {
    console.log("+++ got %d rooms to check", rooms.length);
    for( let i=0; i < rooms.length; i++ ) {
      let r = rooms[i];
      if ( r.hasMembershipState(userId, "join") )
        return r;
    }
  }

  /**
   * looks for existing intent in local map
   * creates a transient UserId from the given hash,
   * creates an Intent for the created UserId, starts the intents client and waits for the syncComplete event.
   * @return Promise with created Intent
   **/
  _getSyncedIntent(address) {

    return new Promise((resolve, reject) => {
      let externalUserHash = this._mnManager.hashCode(address);
      // console.log("+++++++++++ created hash %s from sender address %s", externalUserHash, address);

      // do we have an Intent already for this transient UserId ?
      let intent = this._intents.get(externalUserHash);
      if (intent) {
        console.log("+++ found matching Intend in local map");
        resolve(intent);
        return;
      } else {
        console.log("+++++++ no matching Intent found in map for hash %s", externalUserHash);

        let remoteUserId = this._mnManager.createUserIdFromHash(externalUserHash);

        // if not, create one and put it to the local map
        intent = this.bridge.getIntent(remoteUserId);

        this._intents.set(externalUserHash, intent);
        console.log("+++++++ created new Intent for %s", remoteUserId);

        intent.client.on('syncComplete', () => {
          console.log("+++++ Intent SYNC COMPLETE for hash %s ", externalUserHash);
          intent.client.on('Room.timeline', (e, room) => { this._handleMatrixMessage(e, room, intent)});
          resolve(intent);
        });
        console.log("+++++ Intent starting Client");
        intent.client.startClient();
      }
    });

  }

  _handleMatrixMessage(event, room, intent) {
    let e = event.event;
    // only interested in events coming from real internal matrix Users
    if ( e.type == "m.room.message" && e.user_id.indexOf("@_rethink_") !== 0 ){
      // console.log("+++++++ Intent received timelineEvent of type m.room.message: %s", intent.client.userId, JSON.stringify(e));
      let m = e.content.body;
      try {
        // try to parse
        m = JSON.parse(e.content.body);
      }
      catch (e) { }
      let wsHandler = this._mnManager.getHandlerByAddress(m.to);
      if ( wsHandler ) {
        console.log("+++++++ forwarding this message to the external stub via corresponding wsHandler");
        wsHandler.sendWSMsg(m);
      }
      else {
        console.log("+++++++ no corresponding wsHandler found for to-address %s ", m.to);
      }
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
    reg.addRegexPattern("aliases", "#_rethink_.*", true);
    reg.addRegexPattern("users", "@_rethink_.*", true);
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
          var event = request.getData();
          if (event.type === "m.room.message" && event.content) {
            console.log("received matrix message %s", event.content);
          }
        }
      }
    });
    console.log("Matrix-side AS listening on port %s", port);
    this.bridge.run(port, config);
  }
}
