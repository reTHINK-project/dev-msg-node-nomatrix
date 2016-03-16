//import MatrixClient from "../client/MatrixClient";
import MNManager from '../common/MNManager';
import AllocationHandler from '../allocation/AllocationHandler';
import SubscriptionHandler from '../subscription/SubscriptionHandler';
import PDP from '../policy/PDP';
var RegistryConnector = require('../registry/RegistryConnector');

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
    // this._client;
    this._intent;
    this._roomIds = []; // TODO: verify that js sdk could be caching getRooms
    this._userId;
    this._mnManager = MNManager.getInstance();
    this._allocationHandler = new AllocationHandler(this._config.domain);
    this._subscriptionHandler = SubscriptionHandler.getInstance(this._config.domain);
    this.registry = null;
    this._starttime;
    this._bridge;
    this._pdp = new PDP();
  }

  initialize(bridge) {
    this._bridge = bridge;

    return new Promise((resolve, reject) => {
      bridge.getInitializedIntent(this._userId, this)
      .then((intent) => {
        this._starttime = new Date().getTime();
        this._intent = intent;
        this._roomIds.push(intent.client.roomId);
        resolve();
      })
      .catch((error) => {
        console.error("+[WSHandler - initialize] Error: ", error);
      });
    });
  }

  equals(obj) {
    return (obj instanceof WSHandler) && (obj.runtimeURL === this.runtimeURL);
  }

  /**
   * Performs all necessary actions to clean up this WSHandler instance before it can be destroyed.
   **/
  cleanup() {
    console.log("\ncleaning up WSHandler for: " + this.runtimeURL);
    this._bridge.cleanupClient(this._userId);
  }

  handleMatrixMessage(event, room) {
    console.log("\n+[WSHandler handleMatrixMessage] ???????????????????????????????????????");
    let e = event ? event.event : null; // should never break this way
    if (!this._wsCon) {
      console.log("\n+[WSHandler handleMatrixMessage] disconnected client received a timelineEvent with id %s --> ignoring it", event.event.event_id);
      return;
    }
    // only interested in events coming from real internal matrix Users
    if (e.type == "m.room.message" && e.user_id.indexOf(this._mnManager.USER_PREFIX) === 0 && e.content.sender === this._mnManager.AS_NAME) {

      // filter out events that are older than the own uptime
      let uptime = new Date().getTime() - this._starttime; // TODO: figure out if timelineevents can happen when syncing initially
      if (e.unsigned && e.unsigned.age && e.unsigned.age > uptime) {
        console.log("\n+[WSHandler handleMatrixMessage] client received timelineEvent older than own uptime ---> ignoring it", e.unsigned.age, uptime);
        return;
      }

      console.log("\n+[WSHandler handleMatrixMessage] client received timelineEvent m.room.message - event: ", e);
      let m = e.content.body;
      try         { m = JSON.parse(e.content.body); } // try to parse
      catch (err) { console.error(err); }

      let targetHandlers = this._mnManager.getHandlersByAddress(m.to);
      if ( !targetHandlers || targetHandlers.length == 0 ) {
        console.log("+[WSHandler handleMatrixMessage] corresponding wsHandler not found for to-address: ", m.to);
        return;
      }

      // forward message via websocket of each target
      targetHandlers.forEach((handler, i, arr) => {
        console.log("+[WSHandler handleMatrixMessage] forwarding this message to the stub via corresponding wsHandler");
        wsHandler.sendWSMsg(m);
      });
    }
  }

  releaseCon() {
    this._wsCon = null;
  }

  updateCon(con) {
    this._wsCon = con;
  }

  /**
   * Sends a message to the handled WebSocket.
   * The message is stringified before it is sent out.
   * @param msg {Object} ... The message to be sent.
   **/
  sendWSMsg(msg) {
    if (this._wsCon) {
      let s = JSON.stringify(msg);
      // console.log(">>> WSHandler for id %s sends via websocket", this.runtimeURL, msg);
      this._wsCon.send(s);
    } else {
      console.log("WSHandler: connection is inactive --> not sending msg");
    }
  }

  getMatrixId() {
    return this._userId;
  }


  /**
   * Handles a message coming in from an external stub.
   * @param msg {reThink message}
   **/
  handleStubMessage(m) {
    console.log("+[WSHandler] [handleStubMessage]:\n", m);

    // TODO: utility to validate retHINK message
    if (!m || !m.to || !m.from) {
      console.log("+++++++ this is not a reTHINK message --> ignoring ...");
      return;
    }

    let destination = m.to.split(".");

    // The following code will filter out message node specific rethink messages from normal msg flow.

    if ( this._allocationHandler.isAllocationMessage(m) ) {
      this._allocationHandler.handleAllocationMessage(m, this);

    } else  if ( this._subscriptionHandler.isSubscriptionMessage(m) ) {
      console.log("SUBSCRIBE message detected --> handling subscription");
      this._mnManager.addHandlerMapping(m.from, this);
      this._subscriptionHandler.handleSubscriptionMessage(m, this);

    } else if (destination[0] == "domain://registry") {
      if (!m.body) {
        console.log("The message has no body and cannot be processed.");
        return;
      }
      this.registry ? console.log("connector already present") : this.registry = new RegistryConnector('http://dev-registry-domain:4567');
      this.registry.handleStubMessage(m, (body) => {
        this.sendWSMsg({
          id  : m.id,
          type: "response",
          from: m.to,
          to  : m.from,
          body: {
            code : 200,
            value: body
        }});
      });
    }
    else {
      this._route(m); // route through Matrix
    }
  }


  _route(m) {
    console.log("-------------------------------------------------------------");
    console.log("-------------------------------------------------------------\n");

    let sharedRoom = this._getRoomWith(this._intent.client.getRooms(), this._mnManager.createUserId(m.to) );
    console.log("+[WSHandler] [_route] sharedRoom=%s ", sharedRoom);
    if ( sharedRoom ) {
      console.log("+[WSHandler] [_route] found shared Room with toUser=%s, roomId=%s --> sending message ...", this._mnManager.createUserId(m.to), sharedRoom.roomId);
      this._intent.sendText(sharedRoom.roomId, JSON.stringify(m));
      return;
    }

    let roomAlias = this._mnManager.createRoomAlias(this._mnManager.createUserId(m.from), this._mnManager.createUserId(m.to));
    if( roomAlias.charAt( 0 ) === '#' )
        roomAlias = roomAlias.slice( 1 );
    console.log("+[WSHandler] [_route] inviting target user %s in room %s ", this._mnManager.createUserId(m.to), roomAlias);
    this._intent.createRoom({
      options:{
        room_alias_name: roomAlias,
        visibility: 'public',    // check if neccessary
        invite:[this._mnManager.createUserId(m.to)],
      }
    })
    .then((room)=>{
      console.log("+[WSHandler] [_route] room created, id:", room.room_id);
      console.log("+[WSHandler] [_route] room created, alias: ", room.room_alias);

      new Promise((resolve, reject) => {
        this._intent.onEvent = (e) => {
          // console.log("++++ WAITING for user %s to join: Intent EVENT: type=%s, userid=%s, membership=%s, roomid=%s", toUser, e.type, e.user_id, e.content.membership, e.room_id);
          // wait for the notification that the targetUserId has (auto-)joined the new room
          if (e.type === "m.room.member" && e.user_id === this._mnManager.createUserId(m.to) && e.content.membership === "join" && e.room_id === room.room_id) {
            resolve(e.room_id);
          }
        }
      })
      .then((room_id) => {
        console.log("+[WSHandler] [_route] %s has joined room %s --> sending message",  this._mnManager.createUserId(m.to), room_id);
        this._intent.sendText(room.room_id, JSON.stringify(m));
      });

      // invite the other user?
      // invite:[this._mnManager.createUserId(m.to)], // invite can be done here because the client must have an allocated address or the runtime wouldn't know who to connect to
      // this._intent.invite(roomId.room_id, this._mnManager.createUserId(m.to))
      // .then(()=>{
      //   console.log("+[WSHandler] [_route] INVITE SUCCESS ", this._mnManager.createUserId(m.to));
      // })
    })
    .catch((e)=>{
      console.error("+[WSHandler] [_route] ERROR: ", e);
    });

    // this._intent.invite(roomAlias, m.to)
    // .then(() => {
    //   console.log("+[WSHandler] [_route] invite successfully sent");
    //   _sendToRoom(roomAlias, m);
    // })
    // .catch(() => {
    //   console.error("+[WSHandler] [_route] FAILED TO INVTE TARGET USER: ", m.to);
    //   this._intent.join(roomAlias)
    //   .then(() => {
    //     console.log("+[WSHandler] [_route] ROOM JOINED");
    //     _sendToRoom(roomAlias, m);
    //   })
    //   .catch(() => {
    //     console.log("+[WSHandler] [_route] FAILED TO JOIN ROOM");
    //   })
    // })


    // // get target user
    // let targetUserHandler = this._mnManager.getHandlersByAddress(m.to);
    // console.log("+[WSHandler] [_route] targetUser: ", targetUserHandler[0].getMatrixId());
    // if ( targetUserHandler ) { // DO NOT USE THE WASHANDLER HERE, MAYBE BETTER A ROOMLIST
    //   // check if a room exists OR TODO: if possible let the intent do that
    //
    //
    // }
    //
    // else
    //   console.error("+[WSHandler] [_route] NO handler for targetUser " + m.to);
    //
    //
    //
    //
    //
    // console.log("normal message routing ----------> ");
    // this._mnManager.addHandlerMapping(m.from, this);
    //
    // // apply potential policies
    // // TODO: should this be done later in the "forEach" loop ?
    // if ( this._pdp.permits(m)) {
    //
    //   // the subscriptions are also handled by the handler mappings --> no special handling anymore
    //   let targetHandlers = this._mnManager.getHandlersByAddress(m.to);
    //
    //   if ( ! targetHandlers ) {
    //     console.log("!!! Unable to find suitable handlers for target address: :%s", target);
    //     return;
    //   }
    //
    //   // send a Matrix message to each target
    //   targetHandlers.forEach((handler, i, arr) => {
    //     // TODO: get MatrixID from handler and send Matrix Message
    //
    //     console.log("sending message to WSHandler for runtimeURL: %s and MatrixID: %s ", handler.runtimeURL, handler.getMatrixId() );
    //     handler.sendWSMsg(m);
    //   });
    // }
  }


  _getRoomWith(rooms, userId) {
    console.log("[WSHandler] [_getRoomsWith] got %d rooms to check", rooms.length);
    if ( ! rooms || rooms.length === 0) return null;
    // console.log("ROOMSSSSSSSSSSS ", rooms);

    for( let i=0; i < rooms.length; i++ ) {
      let room = rooms[i];
      let isMember = room.hasMembershipState(userId, "join");
      let num = room.getJoinedMembers().length;
      // console.log("[WSHandler] [_getRoomsWith] ROOM ", room );
      // console.log("[WSHandler] [_getRoomsWith] checking userId=%s isMember=%s, num=%s ", userId, isMember, num );
      if ( isMember && num == 2 ) return room;
    }
    return null;
  }

}
