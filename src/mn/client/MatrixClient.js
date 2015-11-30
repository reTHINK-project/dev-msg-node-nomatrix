import MNManager from '../common/MNManager';
var Promise = require('promise');
var URL = require('url');

var INTERNAL_ROOM_PREFIX = "rethinkInternal_";

/**
  * This class implements a MatrixClient.
  * Each Stub that is connected from intra-domain with valid credentials will have one
  * corresponding MatrixClient assigned.
 **/
export default class MatrixClient {

  constructor( wsHandler, config ) {
    this._sdk = require("matrix-js-sdk");
    this._wsHandler = wsHandler;
    this._config = config;
    this._credentials = null;
    this._matrixClient = null;
    this.userId = null;
    this._rooms = null;
    this._pendingMsg = null;
  }

  cleanup() {
    console.log("cleaning up MatrixClient with id: " + this._wsHandler.id);
    this._matrixClient.stopClient();
    // TODO: perform more cleanup
    // TODO: cleanup address--> handler Mapping in MNMAnager
  }

  /**
   *
   * perform a Matrix Login with the given credendials.
   * The credentials must contain a "homeserverUrl" and either a "token" or a
   * "user" and "password" combination
   * The returned Promise resolves on a successful login against the Homeserver
   * and rejects, if the login was not successful or the credentials are insufficient.
   *
   **/
  login(credentials) {
    console.log("login-credentials: " + JSON.stringify(credentials));
    console.log("homeeserverUrl: %s", this._config.homeserverUrl);
    this.userId = credentials.user;

    return new Promise( (resolve, reject) => {
      if ( ! credentials ||
           ! ((credentials.user && credentials.pwd) || credentials.token))
           reject("insufficient credentials");

      this._credentials = credentials;
      // create an SDK client
      this._matrixClient = this._sdk.createClient(this._config.homeserverUrl);

      // either perform login via "user/password" or a provided accessToken
      if ( ! this._credentials.token ) {
        let user = this._credentials.user.substr(1);

        user = user.split(":")[0];
        console.log("attempting password login for: " + user);

        this._matrixClient.loginWithPassword(user, this._credentials.pwd).then(
          (result) => { this._tokenLogin(result.access_token, resolve, reject) },
          (err)    => { reject(err) }
        );
      }
      else
        this._tokenLogin(this._credentials.token, resolve, reject);
    });
  }

  /**
   * perform a login by accessToken
   * also invokes "startClient" on the sdk-client and installs the "syncComplete" callback
   **/
  _tokenLogin(access_token, resolve, reject) {
    if ( access_token )
      this._credentials.token = access_token;

    console.log("attempting token login with token: " + this._credentials.token);

    this._matrixClient = this._sdk.createClient( {
      baseUrl     : this._config.homeserverUrl,
      accessToken : this._credentials.token,
      userId      : this._credentials.user
    });

    // using arrow syntax to preserve scope of "this" in the callback
    this._matrixClient.on('syncComplete',  () => { this._syncComplete() } );

    // we are not interested in historical events (seems not to work properly)
    this._matrixClient.startClient({initialSyncLimit : 0});

    // resolve the login Promise with the validated token
    resolve(this._credentials.token);
  }



  /**
   * Handle reTHINK Messages coming from an intra domain connected stub.
   **/
  handleWSMsg(msg) {

    // msg is already a parsed JSON object
    switch (msg.type) {

      // filter out address allocation requests from normal msg flow
      // these messages must be handled by the MN directly and will not be forwarded
      case "CREATE" :
        // check for allocate message
        if ( "domain://msg-node." + this._config.domain + "/hyperty-address-allocation" === msg.to) {
          this._handleAllocateMessage(msg);
        }
        break;

      default:
        // does this message address a peer in the own domain?
        let targetDomain = URL.parse(msg.to).hostname;
        if ( this._config.domain === targetDomain ) {
          this._handleIntraDomainMessage(msg);
        }
        else {
          this._handleInterDomainMessage(msg, targetDomain);
        }

    }
  }

  // send a message via the WebsocketHandler
  sendWSMsg(msg) {
    // don't stringify here
    this._wsHandler.sendWSMsg(msg);
  }

  /*
   * handling of Adress allocation requests.
   */
  _handleAllocateMessage(msg) {
    let number = msg.body.number ? msg.body.number : 1;

    console.log("received ADDRESS ALLOCATION request with %d address allocations requested", number);

    let newAddresses = MNManager.getInstance().allocateHypertyAddresses(this, number);
    let response = {
      id    : msg.id,
      type  : "RESPONSE",
      from  : "domain://msg-node." + this._config.domain + "/hyperty-address-allocation",
      to    : msg.from,
      body  : {code : 200, allocated : newAddresses}
    }
    this.sendWSMsg(response);
  }

  /*
   * Handle and forward intra-domain messages.
   * Checks for existing room-relationship between peers and creates one, if necessary.
   * Puts message on hold in latter case, until peer has auto-joined the room.
   */
  _handleIntraDomainMessage(msg) {
    // do we have a Matrix UserId mapped to the "to" address?
    let targetUserId = MNManager.getInstance().getMatrixUserIdByAddress(msg.to);
    console.log("found matching matrix userid %s for address %s ", targetUserId, msg.to);

    // do we have a room relationship between "ME" and the "to" user ?
    // TAKE CARE: this only provides proper results after "syncComplete" event.
    let r = this._getRoomWith(targetUserId);
    if ( r ) {
      // if such a room is found, we send the Message to this room
      // TODO: perform check that room has only 2 members
      // TODO: Future: create own message type for rethink --> don't send it as text message anymore
      this._matrixClient.sendTextMessage(r.roomId, JSON.stringify(msg));
      console.log("### found existing room with user: %s --> roomId is %s --> sent msg to this room", targetUserId, r.roomId);
    }
    else {
      // TODO: put this code to the _getRoomWith() method and resolve with either existing or new room
      // (but may not work well with pending messages)
      let alias = "#tmpRoom-" + MNManager.getInstance().generateUUID();

      // create room for "from" and "to" and invite "to"
      console.log("\n============ no room relationship existing currently with %s --> creating new room with alias %s", targetUserId, alias);
      this._matrixClient.createRoom( {
        room_alias_name : alias,
        visibility : 'private',
        invite : [targetUserId]
      }).then( (r) => {
        // we have to put the message on-hold until peer has joined, otherwise it is not forwarded
        // real sending happens in the "RoomMember.membership" callback then
        // TODO: implement a queue for pending messages
        console.log("======= new room created with id %s and alias %s --> put message on hold until peer has joined", r.room_id, r.room_alias);
        this._pendingMsg = {
          msg : msg,
          to : targetUserId,
          roomId : r.room_id
        }
      });
    }
  }

  /*
   * handles the case that a message from matrix is not targeted to the own domain
   * (where the HS is responsible for)
   * TODO: this code only works for sessions that have been initiated from extern --> need Protocol-on-the-fly stuff here otherwise
   */
  _handleInterDomainMessage(msg, domain) {

    let type = msg.type;
    let from = msg.from;
    let to = msg.to;

    if (!to || !from || !type) {
      console.log("======== this is no reTHINK message --> ignoring ...");
      return;
    }

    // create hash from "to"-address
    let externalUserHash = MNManager.getInstance().hashCode(to);
    let externalUserId = MNManager.getInstance().createUserIdFromHash(externalUserHash);
    console.log("======== derived externalUserId %s from target address %s", externalUserId, to);


    // find a matching room with the targetUser
    let sharedRoom = this._getRoomWith(externalUserId);
    if ( sharedRoom ) {
      console.log("====== found shared Room with %s, roomId is %s --> sending message ...", externalUserId, sharedRoom.roomId);
      this._matrixClient.sendTextMessage(sharedRoom.roomId, JSON.stringify(msg));
    }
    else {
      console.log("====== NO shared room with externalUserId %s exists yet and client-side Protocol-on-the-fly stuff is not implemented yet --> can't send this msg yet", externalUserId);
    }

  }


  // try to find a room that is shared with the given userId, i.e. both are joined members
  // TODO: add check for number of members to ensure that only the intended peer gets the message
  _getRoomWith(userId) {
    let rooms = this._matrixClient.getRooms();
    // for( let i=0; i < this._getRooms().length; i++ ) {
    for( let i=0; i < rooms.length; i++ ) {
      if ( rooms[i].hasMembershipState(userId, "join") )
        return rooms[i];
    }
  }

  /*
   * Sync is complete, so we install the other intersting event handlers and send back a
   * SYNC COMPLETE message to the stubs.
   */
  _syncComplete() {
    this._matrixClient.on("Room.timeline", (e, room)  => { this._timelineEvent(e, room) } );
    this._matrixClient.on("RoomMember.membership", (e, member) => { this._roomMembershipEvent(e, member)} );

    // TODO: fix this for tokenLogin (how to get the userid for a tokenLogin)
    // if (! this.userId)
    //   this.userId = Object.getOwnPropertyNames(this._matrixClient.store.users)[0];

    // TODO: Should we wait to resolve the login Promise until SYNC COMPLETE ?
    this.sendWSMsg("SYNC COMPLETE");
  }

  /*
   * lazy getter for the users Rooms.
   * TODO: implement updates of this room cache, when room membership events arrive
   */
  _getRooms() {
    if ( ! this._rooms || this._rooms.length === 0) {
      this._rooms = this._matrixClient.getRooms();
    }
    return this._rooms;
  }

  /*
   * callback for anything that goes on in a joined room.
   * so far, only the "m.room.message" type events are checked
   */
  _timelineEvent(event, room, toStartOfTimeline) {
    let e = event.event;
    if ( e.type == "m.room.message" && e.user_id !== this.userId ){
      // console.log("******* MatrixClient %s received timelineEvent of type m.room.message: %s", this.userId, JSON.stringify(e));
      let m = e.content.body;
      try {
        // try to parse
        m = JSON.parse(e.content.body);
      }
      catch (e) {}
      this.sendWSMsg(m);
    }
  }

  /*
   * handler for structural changes of rooms.
   * Currently only implements "auto-join" behavior on invites
   */
  _roomMembershipEvent(event, member) {
    // TODO: only auto-join, if room prefix matches automatically created rooms
    if (member.membership === "invite" && member.userId === this.userId) {
       this._matrixClient.joinRoom(member.roomId).done(() => {
         console.log("=========== %s Auto-joined %s", member.userId, member.roomId );
       });
    }
    else
    if ( this._pendingMsg ) {
      // if targetUser of a pending message has joined the targetRoom --> send the pending Message
      if (member.membership === "join" && member.userId === this._pendingMsg.to &&
          member.roomId === this._pendingMsg.roomId) {
          console.log("=========== targetUser %s has (auto-)joined room %s --> sending pending message...", member.userId, member.roomId );
          this._matrixClient.sendTextMessage(this._pendingMsg.roomId, JSON.stringify(this._pendingMsg.msg));
          this._pendingMsg = null;
      }
    }
  }
}
