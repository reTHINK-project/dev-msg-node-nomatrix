import expect from 'expect.js';
import ProtoStubMatrix from '../src/stub/ProtoStubMatrix';
import Config from './configuration.js';

let config = new Config();

describe('Matrix-Stub address allocation and domain internal messaging. Matrix Homeserver: ' + config.homeserver, function() {

  this.timeout(0);

  let address1 = null;
  let address2 = null;
  let stub1 = null;
  let stub2 = null;
  let seq1 = 0;
  let seq2 = 0;

  let connectStub = (bus, runtimeURL, stubConfig) => {

    return new Promise((resolve, reject) => {
      let stub = new ProtoStubMatrix(runtimeURL, bus, stubConfig);

      stub.connect(stubConfig.identity).then((responseCode) => {
        resolve(stub);

      }, (err) => {
        expect.fail();
        reject();
      });
    });

  };

  let cleanup = () => {
    stub1.disconnect();
    stub2.disconnect();
  }

  /**
   * Tests the connection of a stub internally in a Matrix Domain.
   * This test uses an idToken to authenticate against the Matrix Domain.
   */
  it('allocate hyperty addresses via 2 stubs and send PING/PONG between them', function(done) {

    // prepare and connect stub1 with an identity token
    let config1 = {
      messagingnode: config.messagingnode
    }

    let send1;
    let bus1 = {
      postMessage: (m) => {
        seq1++;
        // console.log("stub 1 got message no " + seq1 + " : " + JSON.stringify(m));
        if (seq1 === 1) {
          expect(m.header).to.eql( {
            type : "update",
            from : "hyperty-runtime://" + config.homeserver + "/protostub/1",
            to : "hyperty-runtime://" + config.homeserver + "/protostub/1/status"
          });
          expect(m.body).to.eql( {value: 'connected'} );
        }
        else
        if (seq1 === 2) {
          // this message is expected to be the allocation response
          expect(m.header).to.eql( {
            id : "1",
            type : "RESPONSE",
            from : "domain://msg-node." + config.homeserver +  "/hyperty-address-allocation",
            to : "hyperty-runtime://" + config.homeserver + "/runsteffen/registry/allocation"
          });
          expect(m.body.message).not.to.be.null;
          expect(m.body.allocated.length).to.be(1);
          // store address1
          address1 = m.body.allocated[0];
          // console.log("allocated address for hyperty 1: " + address1);
        } else
        if (seq1 === 3) {

          // this msg is expected to be the the text sent from address1 via stub2 to address1 via stub1
          expect(m.header).to.eql( {
            id : "2",
            type : "PING",
            from : address2,
            to : address1
          });
          expect(m.body.message).to.be.eql("Hello from 2 to 1");

          send1({
            header : {
              id: "3",
              type: "PONG",
              from: address1,
              to: address2,
            },
            body: {
              message: "Thanks and hello back from 1 to 2"
            }
          });
        }
      },
      addListener: (url, callback) => {
        send1 = callback;
      }

    }

    connectStub(bus1, 'hyperty-runtime://' + config.homeserver + '/protostub/1', config1).then( (stub) => {
      stub1 = stub;
      send1( {
        header : {
          id: "1",
          type: "CREATE",
          from: "hyperty-runtime://" + config.homeserver +  "/runsteffen/registry/allocation",
          to: "domain://msg-node." + config.homeserver +  "/hyperty-address-allocation",
        },
        body: {
          number: 1
        }
      });
    });



    let config2 = {
      messagingnode: config.messagingnode
    }
    let send2;
    let bus2 = {
      postMessage: (m) => {
        seq2++;
        // console.log("stub 2 got message no " + seq2 + " : " + JSON.stringify(m));

        if (seq2 === 1) {
          expect(m.header).to.eql( {
            type : "update",
            from : "hyperty-runtime://" + config.homeserver + "/protostub/2",
            to : "hyperty-runtime://" + config.homeserver + "/protostub/2/status"
          });
          expect(m.body).to.eql( {value: 'connected'});
        } else
        if (seq2 === 2) {
          expect(m.header).to.eql( {
            id : "1",
            type : "RESPONSE",
            from : "domain://msg-node." + config.homeserver + "/hyperty-address-allocation",
            to : "hyperty-runtime://" + config.homeserver + "/runhorst/registry/allocation"
          });
          expect(m.body.allocated).not.to.be.null
          expect(m.body.allocated.length).to.be(1);
          address2 = m.body.allocated[0];
          // console.log("allocated address for hyperty 2: " + address2);

          // send msg from address2 via stub2 to address 1
          send2( {
            header : {
              id: "2",
              type: "PING",
              from: address2,
              to: address1,
            },
            body: {
              message: "Hello from 2 to 1"
            }
          });
        } else
        if (seq2 === 3) {
          // this msg is expected to be the the text sent from address1 via stub2 to address1 via stub1
          expect(m.header).to.eql( {
            id : "3",
            type : "PONG",
            from : address1,
            to : address2
          });
          expect(m.body.message).to.be.eql("Thanks and hello back from 1 to 2");
          // We are done --> cleaning up
          cleanup();
          done();
        }
      },
      addListener: (url, callback) => {
        send2 = callback;
      }
    }

    connectStub(bus2, 'hyperty-runtime://' + config.homeserver + '/protostub/2', config2).then( (stub) => {
      stub2 = stub;
      send2( {
        header : {
          id: "1",
          type: "CREATE",
          from: "hyperty-runtime://" + config.homeserver + "/runhorst/registry/allocation",
          to: "domain://msg-node." + config.homeserver + "/hyperty-address-allocation",
        },
        body: {
          number: 1
        }
      });
    });

  });

});
