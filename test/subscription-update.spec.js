import expect from 'expect.js';
import activateStub from '../src/stub/MatrixProtoStub';
import Config from './configuration.js';

let config = new Config();

describe('Matrix-Stub SUBSCRIPTION and UPDATE ', function() {
  this.timeout(0);
  let runtimeStubURL = "hyperty-runtime://" + config.homeserver + "/stub-for-subscription";

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

    let msgID = 0;
    let seq = 0;
    let objectAddress;
    let stub = null;

    let configuration = {
      messagingnode: config.messagingnode,
      runtimeURL : "runtime://" + config.homeserver + "/subscription-test"
    }

    let send;
    let bus = {
      postMessage: (m) => {
        seq++;
        // console.log("stub got message no " + seq + " : " + JSON.stringify(m));
        if (seq === 1) {
          expect(m).to.eql( {
            type : "update",
            from : runtimeStubURL,
            to : runtimeStubURL + "/status",
            body : {value: 'connected'}
          });

          send( {
            id: "1",
            type: "create",
            from: runtimeStubURL + "/registry/allocation",
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
        if (seq === 2) {
          // this message is expected to be the allocation response
          expect(m.id).to.eql("1");
          expect(m.type.toLowerCase()).to.eql("response");
          expect(m.from).to.eql("domain://msg-node." + config.homeserver +  "/object-address-allocation");
          expect(m.to).to.eql(runtimeStubURL + "/registry/allocation");
          expect(m.body.code).to.eql(200);
          expect(m.body.value.allocated.length).to.be(1);
          // must start with requested scheme
          expect(m.body.value.allocated[0].indexOf("connection://")).to.be(0);
          // store address1
          objectAddress = m.body.value.allocated[0];
          // console.log("allocated address for object 1: " + objectAddress);

          send( {
            id: "2",
            type: "subscribe",
            from: runtimeStubURL + "/sm",
            to: "domain://msg-node." + config.homeserver +  "/sm",
            body: {
              resource : objectAddress,
              childrenResources : [],
              schema : ""
            }
          });
        }
        else
        if (seq === 3) {
          // this message is expected to be the allocation response
          expect(m.id).to.eql("2");
          expect(m.type.toLowerCase()).to.eql("response");
          expect(m.from).to.eql("domain://msg-node." + config.homeserver +  "/sm");
          expect(m.to).to.eql(runtimeStubURL + "/sm");
          expect(m.body.code).to.eql(200);


          send( {
            id: "3",
            type: "update",
            from: objectAddress,
            to: objectAddress + "/changes",
            body: {
              value : "changed-value"
            }
          });

        } else
        if (seq === 4) {
          // this message is expected to be the allocation response
          expect(m.id).to.eql("3");
          expect(m.type.toLowerCase()).to.eql("update");
          expect(m.from).to.eql(objectAddress),
          expect(m.to).to.eql(objectAddress + "/changes"),
          expect(m.body.value).to.eql("changed-value");

          stub.disconnect();
          done();
        }
      },
      addListener: (url, callback) => {
        send = callback;
      }
    }

    connectStub(bus, runtimeStubURL, configuration).then( (s) => {
      stub = s;
    });

  });

});
