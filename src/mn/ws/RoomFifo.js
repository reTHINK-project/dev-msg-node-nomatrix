import MNManager from '../common/MNManager';

export default class RoomFifo {

  constructor(intent, fromUser, toUser) {
    this.intent = intent;
    this.fromUser = fromUser;
    this.toUser = toUser;
    this._mnManager = MNManager.getInstance();
    this.alias;
    this.room;
    this.sequence = Promise.resolve();
    this.fifo = [];
    this.counter = 0;
    this.timer;
  }

  getId() {
    if (!this.alias)
      this.alias = this._mnManager.createRoomAlias(this.fromUser, this.toUser);
    return this.alias;
  }

  // enqueue message to the promise sequence
  sendMessage(m) {
    if ( this.timer )
      clearTimeout(this.timer);

    this.counter++;
    if ( m )
      this.fifo.push(m);
    console.log("pushed msg to fifo --> size now %d", this.fifo.length);
    if ( (this.fifo.length >= 120) || (!m)) {
      let buf = [];
      let count = 0;
      let size = 0;
      while ((this.fifo.length > 0) && (size < (1024 * 60))) {
        let a = this.fifo.shift();
        size += JSON.stringify(a).length;
        buf.push(a);
        count ++;
      }
      console.log("copied to buf: length now %d and size: %d ", buf.length, size);
      this.sequence = this.sequence.then(() => {
        return this._doSend(buf);
      });
    }
    else
      this.timer = setTimeout(() => { this.sendMessage() }, 25 );
  }

  _doSend(m) {
    return new Promise((resolve, reject) => {
      this._getRoom().then((room) => {
        if ( m.length > 0 ) {
          this.intent.sendText(this.room.roomId, JSON.stringify(m));
          this.timer = setTimeout(() => { this.sendMessage() }, 25 );
        }
        resolve();
      });
    });
  }

  _getRoom() {
    return new Promise((resolve, reject) => {
      // room created here already ?
      if (this.room) {
        console.log("this.room already set");
        resolve(this.room);
      }
      else {
        // pre-existing room ?
        this.room = this._getPreExistingRoom();
        if (this.room) {
          console.log("pre-existing room found");
          resolve(this.room);
        }
        else {
          console.log("creating new room");
          // create new room with this.toUser and return Promise
          return this._createRoom();
        }
      }
    });
  }

  _getPreExistingRoom() {
    let rooms = this.intent.client.getRooms();

    console.log("+[ROOM] [_hasRoom] %s rooms to check", rooms.length);
    if (!rooms || rooms.length === 0) return null;

    for (let i = 0; i < rooms.length; i++) {
      let room = rooms[i];
      let isMember = room.hasMembershipState(this.toUser, "join");
      let num = room.getJoinedMembers().length;
      console.log("+[ROOM] [_hasRoom] checking userId='%s' isMember='%s' membercount='%s' ", this.toUser, isMember, num);
      if (isMember && num === 3) {
        return room;
      }
    }
    return null;
  }

  _createRoom() {
    return new Promise((resolve, reject) => {
      // create ROOM and invite toUser
      var starttest = new Date().getTime();
      console.log("+[ROOM] [_createRoom] create room and invite target user %s", this.toUser);

      var start = Date.now();
      this.intent.createRoom({
          options: {
            visibility: 'private',
            invite: [this.toUser],
          },
          createAsClient: false
        })
        .then((room) => {
          console.log("+[ROOM] [_createRoom] room created with id: %s", room.room_id);
          var endetest = new Date().getTime();
          console.log('###############################################################################');
          console.log("Raum erstellt: " + (endetest - starttest));
          this.room = room;
          resolve(room);
        })
        .catch((e) => {
          console.error("+[ROOM] [initialize] CRITICAL ERROR: ", e);
          reject();
        });
    });
  }
}
