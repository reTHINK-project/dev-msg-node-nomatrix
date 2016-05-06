/**
* Copyright 2016 PT Inovação e Sistemas SA
* Copyright 2016 INESC-ID
* Copyright 2016 QUOBIS NETWORKS SL
* Copyright 2016 FRAUNHOFER-GESELLSCHAFT ZUR FOERDERUNG DER ANGEWANDTEN FORSCHUNG E.V
* Copyright 2016 ORANGE SA
* Copyright 2016 Deutsche Telekom AG
* Copyright 2016 Apizee
* Copyright 2016 TECHNISCHE UNIVERSITAT BERLIN
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*   http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
**/

//import MatrixClient from "../client/MatrixClient";
import MNManager from '../common/MNManager';
import AllocationHandler from '../allocation/AllocationHandler';
import SubscriptionHandler from '../subscription/SubscriptionHandler';
import PDP from '../policy/PDP';
let RegistryInterface = require('../registry/RegistryInterface');
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
   * @param config {Object} the configurations of the MatrixMN
   * @param wsCon {WebSocketConnection} the websocket connection to handle
   * @param userId {String} the userId of the Matrix Client this Handler is responsible for
   **/
  constructor(config, wsCon, userId) {
    this.runtimeURL = wsCon.runtimeURL;
    this._config = config;
    this._wsCon = wsCon;
    this._userId = userId;
    this._intent;
    this._roomIds = []; // TODO: verify that js sdk could be caching getRooms
    this._mnManager = MNManager.getInstance();
    this._allocationHandler = new AllocationHandler(this._config.domain);
    this._subscriptionHandler = SubscriptionHandler.getInstance(this._config.domain);
    this._registryInterface = new RegistryInterface(this._config);
    this._starttime;
    this._bridge;
    this._pdp = new PDP();
  }

  /**
   * Initialize the WSHandler.
   * @param bridge {RethinkBridge} an instance of a RethinkBridge to the Matrix Homeserver
   * @return {Promise}
   **/
  initialize(bridge) {
    this._bridge = bridge;
    return new Promise((resolve, reject) => {
      bridge.getInitializedIntent(this)
      .then((intent) => {
        this._starttime = new Date().getTime();
        this._intent = intent;
        this._roomIds.push(intent.client.roomId);
        resolve();
      })
      .catch((error) => {
        console.error("+[WSHandler] [initialize] ERROR: ", error);
      });
    });
  }

  /**
   * Performs all necessary actions to clean up this WSHandler instance before it can be destroyed.
   **/
  cleanup() {
    console.log("+[WSHandler] [cleanup] cleaning up WSHandler for runtime '%s' and MatrixId '%s'", this.runtimeURL, this.getMatrixId());
    this._bridge.cleanupClient(this.getMatrixId());
  }

  /**
   * Handles messages coming from the Matrix Homeserver to this WSHandler
   *
   * @param event {Object} The event which occcured
   * @param room {Object} The Matrix-room for which the event has been emitted
   **/
  handleMatrixMessage(event, room) {
    let e = event.event;
    console.log("+[WSHandler] [handleMatrixMessage] handle matrixmsg event.type: " , e.type);

    if (!this._wsCon) {
      console.log("+[WSHandler] [handleMatrixMessage] disconnected client received a timelineEvent with id %s --> ignoring ...", e.event_id);
      return;
    }

    // filter out events that are older than the own uptime
    let uptime = (new Date().getTime() - this._starttime);
    if ( e.unsigned && e.unsigned.age && e.unsigned.age > uptime ) {
      console.log("+[WSHandler] [handleMatrixMessage] client received timelineEvent older than own uptime (age=%s, uptime=%s)", e.unsigned.age, uptime);
      return;
    }

    // only interested in events coming from real internal Matrix users &&
    // only interested in events sent not by myself
    if ( e.type == "m.room.message" && e.user_id.indexOf(this._mnManager.USER_PREFIX) === 0 && e.user_id !== this.getMatrixId()){
      console.log("+[WSHandler] [handleMatrixMessage] Intent received timelineEvent of type m.room.message");
      let m = e.content.body;
      try       { m = JSON.parse(m); }
      catch (e) { console.error(e); return; }
      this.sendWSMsg(m); // send the msg to the runtime
    }
  }

  /**
   * Handles invite events for this WSHandler
   * Any invite from a rethink user will be accepted.
   * @param event {Object} The event which occcured
   * @param member {Object} The Matrix-member for which the event emitted
   **/
  handleMembershipEvent(event, member) { // equals "m.room.member" event
    // TODO: only auto-join if room prefix matches automatically created rooms
    // TODO: create room prefix
    // only join the room if this WSHandler / MatrixUser has been invited
    if (member.membership === "invite" && member.userId === this.getMatrixId()) {
      console.log("+[WSHandler] [handleMembershipEvent] member=%s received invite=%s", member.userId, member.membership);
      this._intent.client.joinRoom(member.roomId)
      .then((room)=>{
        console.log("+[WSHandler] [handleMembershipEvent] member '%s' automatically joined '%s'", member.userId, member.roomId );
      })
      .catch((err)=>{
        // TODO: it may be forbiden to join the room
        console.error("+[WSHandler] [handleMembershipEvent] ERROR: ", err);
      });
    }
  }

  /**
   * Sends a message to the handled WebSocket / to the runtime.
   * The message is stringyfied before it is sent out.
   * @param msg {Object} ... The message to be sent.
   **/
  sendWSMsg(msg) {
    if (this._wsCon) {
      // console.log("+[WSHandler] [sendWSMsg] send message to id=%s via websocket: ", this.runtimeURL, msg);
      this._wsCon.send(JSON.stringify(msg));
    } else {
      console.log("+[WSHandler] [sendWSMsg] connection is inactive --> not sending msg");
    }
  }


  /**
   * Handles a message coming in from an external stub.
   * @param msg {reThink message}
   **/
  handleStubMessage(m) {
    // console.log("+[WSHandler] [handleStubMessage]:", m);

    // TODO: utility to validate retHINK message
    if (!m || !m.to || !m.from) {
      console.log("+[WSHandler] [handleStubMessage] this is not a reTHINK message --> ignoring ...");
      return;
    }

    // The following code will filter out message node specific rethink messages from normal msg flow.

    if ( this._allocationHandler.isAllocationMessage(m) ) {
      // console.log("+[WSHandler] [handleStubMessage] allocation message detected");
      this._allocationHandler.handleAllocationMessage(m, this);

    } else  if ( this._subscriptionHandler.isSubscriptionMessage(m) ) {
      // console.log("+[WSHandler] [handleStubMessage] subscription message detected");
      this._mnManager.addHandlerMapping(m.from, this);
      this._subscriptionHandler.handleSubscriptionMessage(m, this);

    } else if (this._registryInterface.isRegistryMessage(m)) {
      // console.log("+[WSHandler] [handleStubMessage] registry message detected");
      this._registryInterface.handleRegistryMessage(m, this);
    }

    else {
      // SDR: send only, if PDP permits it
      if ( this._pdp.permits(m) ) {
        // map the route to the from address for later use
        this._mnManager.addHandlerMapping(m.from, this);
        this._route(m); // route through Matrix
      }
    }
  }

  _route(m) {
    console.log("+[WSHandler] [_route] routing message through Matrix");
    // if more than one m.to are present the message must be handled for every to
    let msg = m;
    if (m.to instanceof Array) {
      for (let i = 0; i < m.to.length; i++) {
        msg.to = m.to[i];
        this._singleRoute(msg);
      }
    } else {
      this._singleRoute(msg);
    }
  }

  _singleRoute(m) {
    // SDR: If we have no mapped handler(s) for the to-address, then we have no connected stub for the toUser
    // in this case it makes no sense to send a Matrix msg to a non-existing/-connected client
    if ( this._mnManager.getHandlersByAddress(m.to) instanceof Array ) {

      // We have to look at the matrix id that was created with the hash of the RuntimeURL that belongs
      // to the stub/WSHandler that is responsible for this to-address.
      let handlers = this._mnManager.getHandlersByAddress(m.to);
      console.log("+[WSHandler] [_singleRoute] handlers.length %s for to-address %s", handlers, m.to);

      for (let i=0; i<handlers.length; i++) {
        var toUser = handlers ? handlers[i].getMatrixId() : null;
        if (!toUser) {
          console.error("+[WSHandler] [_singleRoute] no toUser ", toUser);
          return;
        }

        let rooms = this._intent.client.getRooms();
        console.log("+[WSHandler] [_singleRoute] found %d rooms for this intent", rooms.length);
        let sharedRoom = this._getRoomWith(rooms, toUser);
        // console.log("+[WSHandler] [_singleRoute] sharedRoom=", sharedRoom);
        if ( sharedRoom ) {
          console.log("+[WSHandler] [_singleRoute] found shared Room with toUser=%s, roomId=%s --> sending message ...", toUser, sharedRoom.roomId);
          this._intent.sendText(sharedRoom.roomId, JSON.stringify(m));
          return;
        }

        // create a room or use a present one
        let roomAlias = this._mnManager.createRoomAlias(this.getMatrixId(), toUser);
        console.log("+[WSHandler] [_singleRoute] inviting target user %s in room %s ", toUser, roomAlias);

        var starttest = new Date().getTime();

        this._intent.createRoom({
          options:{
            // removal of alias results in approx. 1.5003 times better performance
            // or 66.7% faster room creation respectively
            // room_alias_name: roomAlias.charAt(0) === '#' ? roomAlias.slice(1) : roomAlias,
            visibility: 'private',
            //invite:[toUser],
          },
          createAsClient: false
        })
        .then((room)=>{
          // console.log("+[WSHandler] [_singleRoute] room created, alias: ", room.room_alias);
          // console.log("+[WSHandler] [_singleRoute] room created, id:", room.room_id);
          var mitteltest = new Date().getTime();

          this._intent.invite(room.room_id, toUser)
          .then(()=>{
            var endetest = new Date().getTime();
            console.log('###############################################################################');
            console.log("erstelle Raum: " + (mitteltest-starttest));
            console.log("lade ein:      " + (endetest-mitteltest));
            console.log("Gesamtzeit:    " + (endetest-starttest));
            console.log("Verhältnis:    " + ( (mitteltest-starttest) / (endetest-mitteltest) ) );
            console.log("+[WSHandler] [_singleRoute] sending message to room %s...", room.room_id);
            this._intent.sendText(room.room_id, JSON.stringify(m));

            // SDR: don't wait until peer has joined - just send the message
            // new Promise((resolve, reject) => {
            //   this._intent.onEvent = (e) => {
            //     // console.log("+[WSHandler] [_singleRoute] WAITING for user %s to join: Intent EVENT: type=%s, userid=%s, membership=%s, roomid=%s", toUser, e.type, e.user_id, e.content.membership, e.room_id);
            //     // wait for the notification that the targetUserId has (auto-)joined the new room
            //     if (e.type === "m.room.member" && e.user_id === this._mnManager.createUserId(m.to) && e.content.membership === "join" && e.room_id === room.room_id) {
            //       resolve(e.room_id);
            //     }
            //   }
            // })
            // .then((room_id) => {
            //   console.log("+[WSHandler] [_singleRoute] %s has joined room %s --> sending message",  this._mnManager.createUserId(m.to), room_id);
            //   this._intent.sendText(room.room_id, JSON.stringify(m));
            // });

            // invite the other user?
            // invite:[this._mnManager.createUserId(m.to)], // invite can be done here because the client must have an allocated address or the runtime wouldn't know who to connect to
            // this._intent.invite(roomId.room_id, this._mnManager.createUserId(m.to))
            // .then(()=>{
            //   console.log("+[WSHandler] [_singleRoute] INVITE SUCCESS ", this._mnManager.createUserId(m.to));
            // })
          })
        })
        .catch((e)=>{
          // // we are probably receiving this message: M_UNKNOWN: Room alias already taken
          // // in that case find out if we are already in that room and send it out
          // if (e.errcode == 'M_UNKNOWN' && e.httpStatus == 400 && e.message === 'Room alias already taken' ) {
          //   this._intent.client.getRoomIdForAlias(roomAlias + ':' + this._config.domain)
          //   .then((roomid) => {
          //     this._intent.sendText(roomid.room_id, JSON.stringify(m));
          //   })
          //   .catch((e) => {
          //     console.error("+[WSHandler] [_singleRoute] LOCALLY CRITICAL ERROR after no roomAlias: ", e);
          //   })
          //
          // } else {
          //   // either the entropy for the room alias wasn't high enough or an unexpected error happened
          //   // does't break the messaging node mut the delivery of this particular message
            console.error("+[WSHandler] [_singleRoute] LOCALLY CRITICAL ERROR: ", e);
          // }

        });
      }
    }
    else {
      console.error("+[WSHandler] [_singleRoute] client side Protocol-on-the-fly not implemented yet!")
      // console.log("+[WSHandler] [_singleRoute] handlers by address", this._mnManager.getHandlersByAddress(m.to));
      // console.log("+[WSHandler] [_singleRoute] handlers ", this._mnManager._handlers);
    }
  }

  _getRoomWith(rooms, userId) {
    console.log("+[WSHandler] [_getRoomWith] %s rooms to check", rooms.length);
    if ( !rooms || rooms.length === 0 ) return null;

    for( let i=0; i < rooms.length; i++ ) {
      let room = rooms[i];
      let isMember = room.hasMembershipState(userId, "join");
      let num = room.getJoinedMembers().length;
      // console.log("+[WSHandler] [_getRoomWith] room.currentState: ", room.currentState );
      console.log("+[WSHandler] [_getRoomWith] checking userId='%s' isMember='%s' membercount='%s'", userId, isMember, num );
      if ( isMember && num === 3 ) return room;
    }
    return null;
  }

  releaseCon() {
    this._wsCon = null;
  }

  updateCon(con) {
    this._wsCon = con;
  }

  getMatrixId() {
    return this._userId;
  }

  equals(obj) {
    return (obj instanceof WSHandler) && (obj.runtimeURL === this.runtimeURL);
  }
}
