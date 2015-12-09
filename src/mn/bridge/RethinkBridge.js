import MNManager from '../common/MNManager';

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
   * looks for existing intent in local map
   * creates a transient UserId from the given hash,
   * creates an Intent for the created UserId, starts the intents client and waits for the syncComplete event.
   * @return Promise with created Intent
   **/
  getSyncedIntent(userId) {
    console.log("++++ _getSyncedIntent for userId %s ", userId)

    return new Promise((resolve, reject) => {

      // do we have an Intent already for this transient UserId ?
      let intent = this._intents.get(userId);
      if (intent) {
        console.log("+++ found matching Intend in local map");
        resolve(intent);
        return;
      } else {
        console.log("+++++++ no matching Intent found in map for userId %s", userId);

        // if not, create one and put it to the local map
        intent = this.bridge.getIntent(userId);

        this._intents.set(userId, intent);
        console.log("+++++++ created new Intent for %s", userId);

        intent.client.on('syncComplete', () => {
          console.log("+++++ Intent SYNC COMPLETE for %s ", userId);
          intent.client.on('Room.timeline', (e, room) => { this._handleMatrixMessage(e, room, intent)});
          intent.client.on("RoomMember.membership", (e, member) => { this._handleMembershipEvent(intent, member, userId) });
          resolve(intent);
        });

        console.log("+++++ Intent starting Client");
        intent.client.startClient();
      }
    });
  }

  _handleMembershipEvent(intent, member, myUserId) {
    // TODO: only auto-join, if room prefix matches automatically created rooms
    if (member.membership === "invite" && member.userId === myUserId) {
      console.log("+++++++ Intent received MEMBERSHIP-INVITE - EVENT %s for member: %s, current user is %s", member.membership, member.userId, myUserId);
       intent.client.joinRoom(member.roomId).then((room) => {
         console.log("=========== %s Auto-joined %s", member.userId, member.roomId );
       });
    }
  }

  _handleMatrixMessage(event, room, intent) {
    let e = event.event;
    // only interested in events coming from real internal matrix Users
    if ( e.type == "m.room.message" && e.user_id.indexOf(this._mnManager.USER_PREFIX) === 0 ){
      //console.log("+++++++ Intent received timelineEvent of type m.room.message: %s", intent.client.userId, JSON.stringify(e));
      let m = e.content.body;
      try {
        // try to parse
        m = JSON.parse(e.content.body);
      }
      catch (e) { }
      let wsHandler = this._mnManager.getHandlerByAddress(m.to);
      if ( wsHandler ) {
        console.log("+++++++ forwarding this message to the stub via corresponding wsHandler");
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
    reg.addRegexPattern("aliases", this._mnManager.ROOM_PREFIX + ".*", true);
    reg.addRegexPattern("users", this._mnManager.USER_PREFIX + ".*", true);
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
