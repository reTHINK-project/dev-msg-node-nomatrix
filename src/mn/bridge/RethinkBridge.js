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
    this._clients = new Map();
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
  getInitializedClient(userId) {
    console.log("++++ _getClient for userId %s ", userId)

    return new Promise((resolve, reject) => {

      let client = this._clients.get(userId);
      if ( client ) {
        console.log("++++ Client already exists --> returning directly");
        resolve( client );
      }
      else {
        // create client via clientFactory
        console.log("++++ creating new Client for %s", userId);
        let client = this.bridge._clientFactory.getClientAs(userId);
        this._clients.set(userId, client);

        client.on('syncComplete', () => {
          console.log("+++++ client SYNC COMPLETE for %s ", userId);

          // create individual room for this client (same alias)
          let arr = userId.split(":");
          let alias = "#" + arr[0].substr(1);
          console.log("+++++++ creating individual room for user %s with alias %s ...", userId, alias);
          client.createRoom({
            createAsClient: true,
            options: {
              room_alias_name: alias,
              visibility: 'private',
              invite: []
            }
          }).then( (r) => {
            console.log("++++++ room created with id: %s --> injecting to client", r.room_id)
            client.roomId = r.room_id;
            resolve(client);
          }, (err) => {
            console.log("ERROR while creating room %s: %s ", alias, err);
          });

        });

        console.log("+++++ starting Client for user %s", userId);
        client.startClient();

      }
    });
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
          // if (event.type === "m.room.message" && event.content) {
          //   console.log("received matrix message %s", event.content);
          // }
          var event = request.getData();
          console.log(">>> " + JSON.stringify(event));
          if (event.type !== "m.room.message" || !event.content || event.content.sender === "pepas" ) {
            return;
          }

          let m = JSON.parse(event.content.body);
          let to = m.to

          var client = bridge._clientFactory.getClientAs(to);
          var alias = "#" + to.substring(1);
          client.getRoomIdForAlias(alias).then( function(room) {
            console.log("got %s as roomid for alias %s", room.room_id, alias);
            event.content.sender = "pepas";
            client.sendMessage(room.room_id, event.content);
          });

        }
      }
    });
    console.log("Matrix-side AS listening on port %s", port);
    this.bridge.run(port, config);
  }
}
