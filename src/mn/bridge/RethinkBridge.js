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
    this._clients = new Map();
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
  getInitializedClient(userId, wsHandler) {
    // console.log("++++ _getClient for userId %s ", userId)

    return new Promise((resolve, reject) => {
      try {
        let client = this._clients.get(userId);
        if (client) {
          console.log("+[RethinkBridge] Client already exists --> updating wsHandler reference and returning directly");
          if ( wsHandler )
            client.wsHandler = wsHandler;
          resolve(client);
        } else {
          var intent = this.bridge.getIntent(userId);

          intent.onEvent("m.room.member", ()=>{
            console.log("event on intent");
          });


          intent.join("!room123:matrix1.rethink");
          console.log("intent................. ", intent);


          // create client via clientFactory
          console.log("+[RethinkBridge] creating new Client for %s", userId);
          let client = this.bridge._clientFactory.getClientAs(userId);

          // update wsHandler reference in the client, if given
          if ( wsHandler )
            client.wsHandler = wsHandler;
          this._clients.set(userId, client); // map userId to MatrixUser
          console.log("+[RethinkBridge] Client: ", client);

          client.on('syncComplete', () => {
            console.log("+[RethinkBridge] client SYNC COMPLETE for %s ", userId);
            resolve(client);
          });

          client.on("RoomMember.membership", function(event, member) {
            if (member.membership === "invite" && member.userId === myUserId) {
               matrixClient.joinRoom(member.roomId).done(function() {
                   console.log("+[RethinkBridge] Auto-joined %s", member.roomId);
               });
            }
          });

          client.on("event", function(event) {
            console.log("+[RethinkBridge] ", event.getType());
          });

          console.log("+[RethinkBridge] starting Client for user %s", userId);
          client.startClient();
        }
      }
      catch (x) {
        console.log("+[RethinkBridge] ERROR: " + x);
      }
    });
  }

  cleanupClient(userId) {
    console.log("releasing wsHandler reference in client for id %s", userId );
    let client = this._clients.get(userId);
    if ( client )
      delete client.wsHandler;
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
          var event = request.getData();
          if (event.type !== "m.room.message" || !event.content || event.content.sender === this._mnManager.AS_NAME) {
            return;
          }
          console.log("*************** BRIDGE EVENT ********** --> ignoring");
          // console.log(">>> " + JSON.stringify(event));
          return;
        }
      }
    });
    console.log("Matrix-side AS listening on port %s", port);
    this.bridge.run(port, config);
  }
}
