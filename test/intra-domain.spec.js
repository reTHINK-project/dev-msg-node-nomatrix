import expect from 'expect.js';
import activateStub from '../src/stub/MatrixProtoStub';
import Config from './configuration.js';

let config = new Config();

describe('Matrix-Stub address allocation and domain internal messaging. Matrix Homeserver: ' + config.homeserver, function() {

  this.timeout(0);

  let runtime1URL = "hyperty-runtime://" + config.homeserver + "/1";
  let runtime2URL = "hyperty-runtime://" + config.homeserver + "/2"

  let address1 = null;
  let address2 = null;
  let stub1 = null;
  let stub2 = null;
  let seq1 = 0;
  let seq2 = 0;

  let connectStub = (bus, runtimeURL, stubConfig) => {

    return new Promise((resolve, reject) => {
      let stub = activateStub(runtimeURL, bus, stubConfig).instance;

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
      messagingnode: config.messagingnode,
      runtimeURL : "runtime://" + config.homeserver + "/1111"
    }

    let send1;
    let bus1 = {
      postMessage: (m) => {
        seq1++;
        // console.log("stub 1 got message no " + seq1 + " : " + JSON.stringify(m));
        if (seq1 === 1) {
          expect(m).to.eql( {
            type : "update",
            from : runtime1URL,
            to : runtime1URL + "/status",
            body : {value: 'connected'}
          });

          send1( {
            id: "1",
            type: "create",
            from: runtime1URL + "/registry/allocation",
            to: "domain://msg-node." + config.homeserver +  "/hyperty-address-allocation",
            body: {
              value : {
                number: 1
              }
            }
          });
        }
        else
        if (seq1 === 2) {
          // this message is expected to be the allocation response
          expect(m.id).to.eql("1");
          expect(m.type.toLowerCase()).to.eql("response");
          expect(m.from).to.eql("domain://msg-node." + config.homeserver +  "/hyperty-address-allocation");
          expect(m.to).to.eql(runtime1URL + "/registry/allocation");
          expect(m.body.code).to.eql(200);
          expect(m.body.value.allocated.length).to.be(1);
          // store address1
          address1 = m.body.value.allocated[0];
          console.log("allocated address for hyperty 1: " + address1);
        } else
        if (seq1 === 3) {

          // this msg is expected to be the the text sent from address1 via stub2 to address1 via stub1
          expect(m).to.eql( {
            id : "2",
            type : "PING",
            from : address2,
            to : address1,
            body : {
              message : "Hello from 2 to 1",
              via : runtime1URL
            }
          });

          setTimeout(
            send1({
              id: "3",
              type: "PONG",
              from: address1,
              to: address2,
              body: {
                message: "Thanks and hello back from 1 to 2"
              }
            }), 50);
        }
      },
      addListener: (url, callback) => {
        send1 = callback;
      }

    }

    connectStub(bus1, runtime1URL, config1).then( (stub) => {
      stub1 = stub;
    });



    let config2 = {
      messagingnode: config.messagingnode,
      runtimeURL : "runtime://" + config.homeserver + "/2222"
    }
    let send2;
    let bus2 = {
      postMessage: (m) => {
        seq2++;
        // console.log("stub 2 got message no " + seq2 + " : " + JSON.stringify(m));

        if (seq2 === 1) {
          expect(m).to.eql( {
            type : "update",
            from : runtime2URL,
            to : runtime2URL + "/status",
            body : {value: 'connected'}
          });

          send2( {
            id: "1",
            type: "create",
            from: runtime2URL + "/registry/allocation",
            to: "domain://msg-node." + config.homeserver + "/hyperty-address-allocation",
            body: {
              value : {
                number: 1
              }
            }
          });
        } else
        if (seq2 === 2) {
          expect(m.id).to.eql("1");
          expect(m.type.toLowerCase()).to.eql("response");
          expect(m.from).to.eql("domain://msg-node." + config.homeserver + "/hyperty-address-allocation");
          expect(m.to).to.eql(runtime2URL + "/registry/allocation");
          expect(m.body.code).to.eql(200);
          expect(m.body.value.allocated.length).to.be(1);
          address2 = m.body.value.allocated[0];
          console.log("allocated address for hyperty 2: " + address2);

          // send msg from address2 via stub2 to address 1
          send2( {
            id: "2",
            type: "PING",
            from: address2,
            to: address1,
            body: {
              message: "Hello from 2 to 1"
            }
          });
        } else
        if (seq2 === 3) {
          // this msg is expected to be the the text sent from address1 via stub2 to address1 via stub1
          expect(m).to.eql( {
            id : "3",
            type : "PONG",
            from : address1,
            to : address2,
            body : {
              message : "Thanks and hello back from 1 to 2",
              via : runtime2URL
            }
          });
          // We are done --> cleaning up
          cleanup();
          done();
        }
      },
      addListener: (url, callback) => {
        send2 = callback;
      }
    }

    connectStub(bus2, runtime2URL, config2).then( (stub) => {
      stub2 = stub;
    });

  });

});
