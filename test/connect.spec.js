import expect from 'expect.js';
import activateStub from '../src/stub/MatrixProtoStub';
import Config from './configuration.js';

let config = new Config();

describe('Matrix-Stub connect to ' + config.homeserver + ' with messagingnode ' + config.messagingnode, function() {

  class Bus {
    constructor(owner, doLog) {
      this.owner = owner;
      this.doLog = doLog;
    }

    postMessage(msg) {
      if (this.doLog === true)
        console.log('Bus ' + this.owner + ' got msg: ' + JSON.stringify(msg));

      if ( this.sendCallback )
        this.sendCallback(msg);
    }

    addListener(url, sendCallback) {
      // not required here
    }
  }


  /*
   * The connection of a stub without credentials must be treated as extra domain connect.
   */
  it('stub connection', function(done) {

    let bus = new Bus("generic", false);
    let configuration = {
      messagingnode : config.messagingnode,
      runtimeURL : "runtime://" + config.homeserver + "/6225"
    }
    let stub = activateStub('hyperty-runtime://' + config.homeserver + '/protostub/1', bus, configuration).instance;

    stub.connect().then( () => {
        stub.disconnect();
        done();
    },
    (err) => {
      expect.fail();
    });
  });

});
