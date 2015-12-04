import expect from 'expect.js';
import ProtoStubMatrix from '../src/stub/ProtoStubMatrix';

describe('Matrix-Stub address allocation and domain external messaging', function() {

  this.timeout(0);

  let address1 = null;
  let stub1 = null;
  let stub2 = null;
  let seq1 = 0;
  let seq2 = 0;

  let connectStub = (bus, stubId, stubConfig) => {

    let stub = new ProtoStubMatrix('hyperty-runtime://' + config.homeserver + '/protostub/' + stubId, bus, stubConfig);
    stub.connect(stubConfig.identity).then((validatedToken) => {}, (err) => {
      expect.fail();
    });
    return stub;
  };

  let cleanup = () => {
    stub1.disconnect();
    stub2.disconnect();
  }


  /**
   * Tests the connection of a stub internally in a Matrix Domain.
   * This test uses an idToken to authenticate against the Matrix Domain.
   */
  it('connect from Vertx domain, send PING to Matrix Hyperty address and expect PONG back', function(done) {

    // TODO:
    console.log("******* VERTX TEST is disabled for now **********");
    done();

    // prepare and connect stub1 with an identity token
    let config1 = {
      identity: {
        user: "@horst:matrix.docker",
        pwd: "horst1"
      },
      messagingnode: "ws://localhost:8001/stub/connect"
    }

    let send1;
    let bus1 = {
      postMessage: (m) => {
        seq1++;
        console.log("stub 1 (internal) got message no " + seq1 + " : " + JSON.stringify(m));
        if (seq1 === 1) {
          expect(m).to.eql("SYNC COMPLETE");
          send1({
            "id": "1",
            "type": "CREATE",
            "from": "hyperty-runtime://matrix.docker/runsteffen/registry/allocation",
            "to": "domain://msg-node.matrix.docker/hyperty-address-allocation",
            "body": {
              "number": 1
            }
          });
          stub1.postMessage(allocateMsg);
        } else if (seq1 === 2) {
          // this message is expected to be the allocation response
          expect(m.id).to.eql("1");
          expect(m.type).to.eql("RESPONSE");
          expect(m.from).to.eql("domain://msg-node.matrix.docker/hyperty-address-allocation");
          expect(m.to).to.eql("hyperty-runtime://matrix.docker/runsteffen/registry/allocation");
          expect(m.body.message).not.to.be.null;
          expect(m.body.allocated.length).to.be(1);
          // store address1
          address1 = m.body.allocated[0];
          console.log("allocated address for domain internal hyperty: " + address1);

          // run external stub, after hyperty allocation is done
          runExternalStub(done);
        } else {
          send1({
            "id": m.id,
            "type": "PONG",
            "from": address1,
            "to": m.from,
            "body": {
              "message": "Thanks and hello back to external Domain"
            }
          });

        }
      },
      addListener: (url, callback) => {
        send1 = callback;
      }
    }
    connectStub(callback1, 1, config1).then((stub) => {
      stub1 = stub;
    });
  });

  let keepAlive = () => {
    console.log("keep alive");
    setTimeout(keepAlive, 5000);
  }

  let runExternalStub = (done) => {
    setTimeout(keepAlive, 5000);
  }

});
