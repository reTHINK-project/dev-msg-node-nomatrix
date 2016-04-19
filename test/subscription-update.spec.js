import expect from 'expect.js';
import activateStub from '../src/stub/MatrixProtoStub';
import Config from './configuration.js';

let config = new Config();

describe('Matrix-Stub SUBSCRIPTION and UPDATE ', function() {
  this.timeout(0);
  let stubUrl1 = "hyperty-runtime://" + config.homeserver + "/stub-for-allocation";
  let stubUrl2 = "hyperty-runtime://" + config.homeserver + "/stub-for-subscription";

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


  /**
   * Tests the connection of a stub internally in a Matrix Domain.
   * This test uses an idToken to authenticate against the Matrix Domain.
   */
  it('subscribe for object and receive update', function(done) {

    let bus1;
    let bus2;
    let seq1 = 0;
    let seq2 = 0;
    let objectAddress;
    let stub1 = null;
    let stub2 = null;
    let send1;
    let send2;

    let configuration1 = {
      messagingnode: config.messagingnode,
      runtimeURL : "runtime://" + config.homeserver + "/allocation"
    }
    let configuration2 = {
      messagingnode: config.messagingnode,
      runtimeURL : "runtime://" + config.homeserver + "/subscription"
    }

    bus1 = {
      postMessage: (m) => {
        seq1++;
        // console.log("stub got message no " + seq1 + " : " + JSON.stringify(m));
        if (seq1 === 1) {
          expect(m).to.eql( {
            type : "update",
            from : stubUrl1,
            to : stubUrl1 + "/status",
            body : {value: 'connected'}
          });

          send1( {
            id: "1",
            type: "create",
            from: stubUrl1 + "/registry/allocation",
            to: "domain://msg-node." + config.homeserver +  "/object-address-allocation",
            body: {
              scheme: "connection",
              value : {
                number: 1,
              }
            }
          });
        }
        else
        if (seq1 === 2) {
          // this message is expected to be the allocation response
          expect(m.id).to.eql("1");
          expect(m.type.toLowerCase()).to.eql("response");
          expect(m.from).to.eql("domain://msg-node." + config.homeserver +  "/object-address-allocation");
          expect(m.to).to.eql(stubUrl1 + "/registry/allocation");
          expect(m.body.code).to.eql(200);
          expect(m.body.value.allocated.length).to.be(1);
          // must start with requested scheme
          expect(m.body.value.allocated[0].indexOf("connection://")).to.be(0);
          // store address1
          objectAddress = m.body.value.allocated[0];
          // console.log("allocated address for object 1: " + objectAddress);

          // Now connect the second stub, which sends a subscribe as soon as it is connected
          connectStub(bus2, stubUrl2, configuration2).then( (s) => {
            stub2 = s;
          });

        }
      },
      addListener: (url, callback) => {
        send1 = callback;
      }
    }

    bus2 = {
      postMessage: (m) => {
        seq2++;
        // console.log("stub got message no " + seq2 + " : " + JSON.stringify(m));
        if (seq2 === 1) {
          expect(m).to.eql( {
            type : "update",
            from : stubUrl2,
            to : stubUrl2 + "/status",
            body : {value: 'connected'}
          });

          send2( {
            id: "2",
            type: "subscribe",
            from: stubUrl2 + "/sm",
            to: "domain://msg-node." + config.homeserver +  "/sm",
            body: {
              subscribe : [objectAddress, objectAddress+"/changes"]
            }
          });
        }
        else
        if (seq2 === 2) {
          // this message is expected to be the allocation response
          expect(m.id).to.eql("2");
          expect(m.type.toLowerCase()).to.eql("response");
          expect(m.from).to.eql("domain://msg-node." + config.homeserver +  "/sm");
          expect(m.to).to.eql(stubUrl2 + "/sm");
          expect(m.body.code).to.eql(200);

          // Now Stub 1 sends an update message
          send1( {
            id: "3",
            type: "update",
            from: objectAddress,
            to: objectAddress + "/changes",
            body: {
              value : "changed-value"
            }
          });

        } else
        if (seq2 === 3) {
          // this message is expected to be the allocation response
          expect(m.id).to.eql("3");
          expect(m.type.toLowerCase()).to.eql("update");
          expect(m.from).to.eql(objectAddress),
          expect(m.to).to.eql(objectAddress + "/changes"),
          expect(m.body.value).to.eql("changed-value");

          stub1.disconnect();
          stub2.disconnect();
          done();
        }
      },
      addListener: (url, callback) => {
        send2 = callback;
      }
    }

    // start the whole testcase by connecting the first stub
    connectStub(bus1, stubUrl1, configuration1).then( (s) => {
      stub1 = s;
    });


  });

});
