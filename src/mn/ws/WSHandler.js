//import MatrixClient from "../client/MatrixClient";
import MNManager from '../common/MNManager';
let URL = require('url');
let Promise = require('promise');


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
   **/
  constructor(config, wsCon, userId) {
    this.runtimeURL = wsCon.runtimeURL;
    this._config = config;
    this._wsCon = wsCon;
    this._userId = userId;
    this._intent;
    this._userId;
    this._mnManager = MNManager.getInstance();
  }

  initialize(bridge) {
    return new Promise( (resolve, reject) => {
      bridge.getSyncedIntent(this._userId).then((intent) => {
        console.log("+++ got intent for userId %s", this._userId);
        this._intent = intent;
        resolve();
      });
    });
  }

  releaseCon() {
    this._wsCon = null;
  }

  updateCon(con) {
    this._wsCon = con;
  }

  /**
   * Performs all necessary actions to clean up this WSHandler instance before it can be destroyed.
   **/
  cleanup() {
    console.log("cleaning up WSHandler for: " + this.runtimeURL);
    // stop the internal Matrix Client and release the intent
    try {
      if ( this._intent && this._intent.client )
        this._intent.client.stopClient();
      this._intent = null;
    }
    catch (e) {
      console.log("ERROR while stopping MatrixClient and releasing Intent!")
    }
  }

  /**
   * Sends a message to the handled WebSocket.
   * The message is stringified before it is sent out.
   * @param msg {Object} ... The message to be sent.
   **/
  sendWSMsg(msg) {
    if ( this._wsCon ) {
      let s = JSON.stringify(msg);
      console.log("WSHandler for id %s sends via websocket %s", this.runtimeURL, s);
      this._wsCon.send(s);
    }
    else {
      console.log("WSHandler: connection is inactive --> not sending msg");
    }
  }

  getMatrixId() {
    return this._userId;
  }


  /**
   * Handles a message coming in from an external stub.
   * These messages must be routed to the correct room that establishes the connection between the messages "from" and "to".
   * If such room does not exist, it will be created on behalf of "from", "to" will be invited and the message will be sent.
   * @param msg {reThink message}
   **/
  handleStubMessage(m) {
    // TODO: utility to validate retHINK message

    console.log("++++++++++ WSHandler: handling stub msg: %s", JSON.stringify(m));

    if (! m || !m.to || !m.from || !m.type) {
      console.log("+++++++ this is no reTHINK message --> ignoring ...");
      return;
    }

    switch (m.type) {

      // filter out address allocation requests from normal msg flow
      // these messages must be handled by the MN directly and will not be forwarded
      case "CREATE" :
        console.log("CREATE MESSAGE for m.to = %s, expected domain %s", m.to, this._config.domain);
        // allocate message ?
        if ( "domain://msg-node." + this._config.domain + "/hyperty-address-allocation" === m.to) {
          let number = m.body.number ? m.body.number : 1;
          console.log("received ADDRESS ALLOCATION request with %d address allocations requested", number);
          let addresses = this._mnManager.allocateHypertyAddresses(this, number);

          this.sendWSMsg({
            id    : m.id,
            type  : "RESPONSE",
            from  : "domain://msg-node." + this._config.domain + "/hyperty-address-allocation",
            to    : m.from,
            body  : {code : 200, allocated : addresses}
          });
        }
        break;

      default:
        this._routeMessage(m);
    }
  }


  _routeMessage(m) {
    let from = m.from;
    let to = m.to;

    // is to-address in our domain?
    // does this message address a peer in the own domain?
    let toDomain = URL.parse(to).hostname;
    let fromDomain = URL.parse(from).hostname;

    // if session was initiated from external domain, then we must add a handler mapping for the external address
    // otherwise we can't route the response later on
    if ( this._config.domain !== fromDomain ) {
      this._mnManager.addHandlerMapping(from, this);
    }

    console.log("+++++ comparing localDomain %s with toDomain %s ", this._config.domain, toDomain);
    // route onyl messages to own domain, or message flows that have been initiated from remote (i.e. we have a mapping)
    //TODO: should be enough to check for existing Mapping
    if ( this._config.domain === toDomain || this._mnManager.getHandlerByAddress(to) !== null ) {

      // get matrix user id from to-address
      var toUser = this._mnManager.getMatrixIdByAddress(to);
      console.log("+++ got toUser as %s ", toUser);
      // TODO: what happens, if toUser == null ?

      // does the intents client share a room with targetUserId ?
      let sharedRoom = this._getRoomWith(this._intent.client.getRooms(), toUser );
      console.log("+++ sharedRoom %s ", sharedRoom);
      if ( sharedRoom ) {
        console.log("+++ found shared Room with %s, roomId is %s --> sending message ...", toUser, sharedRoom.roomId);
        this._intent.sendText(sharedRoom.roomId, JSON.stringify(m));
      }
      else {
        console.log("++++ thisUser %s ", this._userId);
        let alias = this._mnManager.createRoomAlias(this._userId, toUser);
        console.log("+++++++ alias: %s ", alias);
        console.log("+++++++ NO shared room with targetUserId %s exists already --> creating such a room with alias %s...", toUser, alias);

        this._intent.createRoom({
          createAsClient: true,
          options: {
            room_alias_name: alias,
            visibility: 'private',
            invite: [toUser]
          }
        }).then((r) => {
          console.log("++++++++ new room created with id %s and alias %s", r.room_id, r.room_alias);

          // send Message, if targetUser has joined the room
          new Promise((resolve, reject) => {
            this._intent.onEvent = (e) => {
              // console.log("++++ WAITING for user %s to join: Intent EVENT: type=%s, userid=%s, membership=%s, roomid=%s", toUser, e.type, e.user_id, e.content.membership, e.room_id);
              // wait for the notification that the targetUserId has (auto-)joined the new room
              if (e.type === "m.room.member" && e.user_id === toUser && e.content.membership === "join" && e.room_id === r.room_id) {
                resolve(e.room_id);
              }
            }
          }).then((room_id) => {
            console.log("+++++++ %s has joined room %s --> sending message ...", toUser, room_id);
            this._intent.sendText(r.room_id, JSON.stringify(m));
          });
        }, (err) => {
          console.log("+++++++ error while creating new room for alias %s --> not sending message now", alias);
        });
      }
    }
    else {
      console.log("+++++++ client side Protocol-on-the-fly NOT implemented yet!")
    }
  }


  // try to find a room that is shared with the given userId, i.e. both are joined members
  _getRoomWith(rooms, userId) {
    console.log("+++ got %d rooms to check", rooms.length);
    if ( ! rooms || rooms.length === 0)
      return null;
    for( let i=0; i < rooms.length; i++ ) {
      let r = rooms[i];
      let isMember = r.hasMembershipState(userId, "join");
      let num = r.getJoinedMembers().length;
      console.log("checking room %s, userId, %s isMember %s, num=%s ", r.room_id, userId, isMember, num );
      if ( isMember && num == 2 )
        return r;
    }
    return null;
  }

}
