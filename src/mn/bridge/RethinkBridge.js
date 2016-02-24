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
          console.log("++++ Client already exists --> updating wsHandler reference and returning directly");
          if ( wsHandler )
            client.wsHandler = wsHandler;
          resolve(client);
        } else {
          // create client via clientFactory
          console.log("++++ creating new Client for %s", userId);
          let client = this.bridge._clientFactory.getClientAs(userId);
          // update wsHandler reference in the client, if given
          if ( wsHandler )
            client.wsHandler = wsHandler;
          this._clients.set(userId, client);

          client.on('syncComplete', () => {
            console.log("+++++ client SYNC COMPLETE for %s ", userId);

            this._setupIndividualRoom(client, userId).then((roomId) => {
              console.log("got individual room with id %s ---> installing timeline event handler ", roomId );
              client.on('Room.timeline', ((e, room) => {
                if ( client.wsHandler ) {
                  console.log("invoking delegated timeline handler on this clients wsHandler ...")
                  client.wsHandler.handleMatrixMessage(e, room);
                }
              }));

              client.roomId = roomId;
              resolve(client);
            });
          });

          console.log("+++++ starting Client for user %s", userId);
          client.startClient(0);
        }
      }
      catch (x) {
        console.log("ERROR: " + x);
      }
    });
  }

  cleanupClient(userId) {
    console.log("releasing wsHandler reference in client for id %s", userId );
    let client = this._clients.get(userId);
    if ( client )
      delete client.wsHandler;
  }


  _setupIndividualRoom(client, userId) {
    return new Promise( (resolve, reject) => {

      // does this client have a room with only itself as member?
      let rooms = client.getRooms();
      // console.log("found %d rooms for client", rooms.length);
      for( let i=0; i < rooms.length; i++ ) {
        // console.log("room %d has %d members", i, rooms[i].getJoinedMembers().length);
        if ( rooms[i].getJoinedMembers().length === 1 ) {
          console.log("+++++++ found existing individual room");
          resolve(rooms[i].roomId);
          return;
        }
      }
      // otherwise create such a room
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
      }).then((room) => {
        console.log("++++++ room created with id: %s --> injecting to client", room.room_id)
        resolve(room.room_id);
      }, (err) => {
        console.log("ERROR while creating room %s: %s ", alias, err);
      });
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
          // console.log("onUserQuery called for userid: %s", queriedUser);
          return {};
        },

        onEvent: (request, context) => {
          var event = request.getData();
          if (event.type !== "m.room.message" || !event.content || event.content.sender === this._mnManager.AS_NAME) {
            return;
          }
          console.log("*************** BRIDGE EVENT ********** ");
          console.log(">>> " + JSON.stringify(event));

          let m = JSON.parse(event.content.body);

          // apply potential policies
          // TODO: should this be done later in the "forEach" loop ?
          if ( this._pdp.permits(m)) {

            // if it is an UPDATE method, then we need to forward this message to all previously subscribed addresses
            // if ( this._subscriptionHandler.isObjectUpdateMessage(m) ) {
            let targets = this._subscriptionHandler.isMessageForSubscribedObject(m);
            if ( targets.length > 0 ) {
              console.log("Object message detected --> routing message to subscribers");

              if ( ! targets ) {
                console.log(" No subscribers found for dataObjectURL %s", m.from);
                targets = [];
              }
              console.log("subscription targets: " + JSON.stringify(targets));
            }
            else {
              // use the real to-address as target
              targets.push( m.to );
            }

            // send a Matrix message to each target
            targets.forEach((target, i, arr) => {
              // get corresponding matrix userid for the to-address
              let toUser = _this._mnManager.getMatrixIdByAddress(target);

              console.log("sending msg to MatrixID: %s", toUser);
              // send a message to this clients individual room
              _this.getInitializedClient(toUser).then( (client) => {
                event.content.sender = this._mnManager.AS_NAME;
                client.sendMessage(client.roomId, event.content);
              }),
              (error) => {
                console.log("ERROR while getting initialized client for uid: %s", toUser);
              };
            });
          }
        }
      }
    });
    console.log("Matrix-side AS listening on port %s", port);
    this.bridge.run(port, config);
  }
}
