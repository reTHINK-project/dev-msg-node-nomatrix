import expect from 'expect.js';
import ProtoStubMatrix from '../src/stub/ProtoStubMatrix';

describe('Matrix-Stub connect', function() {

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
      this.sendCallback = sendCallback;
    }
  }


  /**
   * Tests the connection of a stub internally in a Matrix Domain.
   * This test uses an idToken to authenticate against the Matrix Domain.
   */
  it('stub connected to internal domain with idToken', function(done) {

    let bus = new Bus("steffen", true);

    let configuration = {
      identity : {
        token : "QHN0ZWZmZW46bWF0cml4LmRvY2tlcg...fVQroZzieCAGpKXzmt"
      },
      messagingnode : "ws://localhost:8001/stub/connect"
    }
    let stub = new ProtoStubMatrix('hyperty-runtime://matrix.docker/protostub/1', bus, configuration);

    stub.connect( configuration.identity ).then( (validatedToken) => {

      expect( configuration.identity.token ).to.eql( validatedToken );
      stub.disconnect();
      done();
    },
    (err) => {
      expect.fail();
    });
  });

  /**
  * Tests the connection of a stub internally in a Matrix Domain.
  * This test uses username/password to authenticate against the Matrix Domain.
   */
  it('stub connected to internal domain with username / password', function(done) {

    let bus = new Bus("steffen", true);

    let configuration = {
      identity : {
        user : "@steffen:matrix.docker",
        pwd : "steffen"
      },
      messagingnode : "ws://localhost:8001/stub/connect"
    }
    let stub = new ProtoStubMatrix('hyperty-runtime://matrix.docker/protostub/1', bus, configuration);

    stub.connect( configuration.identity ).then( (validatedToken) => {

      expect(validatedToken).not.to.be.null;
      stub.disconnect();
      done();
    },
    (err) => {
      expect.fail();
    });
  });


  /*
   * The connection of a stub without credentials must be treated as extra domain connect.
   */
  it('stub without credentials is treated as external', function(done) {

    let bus = new Bus("external-hyperty", true);

    let configuration = {
      messagingnode : "ws://localhost:8001/stub/connect"
    }
    let stub = new ProtoStubMatrix('hyperty-runtime://external.runtime/protostub/1', bus, configuration);

    stub.connect().then(
      (validatedToken) => {
        expect(validatedToken).to.be.undefined;
        done();
    },
    (err) => {
      expect.fail();
    });
  });

});
