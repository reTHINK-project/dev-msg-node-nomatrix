import expect from 'expect.js';
import activateStub from '../src/stub/MatrixProtoStub';
import Config from './configuration.js';
let ServiceFramework = require('service-framework');
let MessageFactory = new ServiceFramework.MessageFactory(false,{});
let config = new Config();

describe('Matrix-Stub hyperty address allocation ', function() {
  this.timeout(0);
  let runtimeStubURL = "hyperty-runtime://" + config.homeserver + "/stub1";

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
  it('allocate hyperty addresses', function(done) {

    let msgID = 0;
    let seq = 0;
    let address1;
    let addresses;
    let allocationKey;
    let stub = null;
    let msg; // temporarily stores a message

    let configuration = {
      messagingnode: config.messagingnode,
      runtimeURL : "runtime://" + config.homeserver + "/allocation-test"
    }

    let send;
    let bus = {
      postMessage: (m) => {
        seq++;
        //console.log("stub got message no " + seq + " : " + JSON.stringify(m));
        if (seq === 1) {
          expect(m).to.eql( {
            type : "update",
            from : runtimeStubURL,
            to : runtimeStubURL + "/status",
            body : {value: 'connected'}
          });

          msg = MessageFactory.createCreateMessageRequest(
            runtimeStubURL + "/registry/allocation", // from
            "domain://msg-node." + config.homeserver + "/hyperty-address-allocation", // to
            {number: 1}, // body.value
            "policyURL" // policy
          );
          send(msg);
        }
        else
        if (seq === 2) {
          // this message is expected to be the allocation response
          expect(m.id).to.eql(msg.id);
          expect(m.type.toLowerCase()).to.eql("response");
          expect(m.from).to.eql("domain://msg-node." + config.homeserver +  "/hyperty-address-allocation");
          expect(m.to).to.eql(runtimeStubURL + "/registry/allocation");
          expect(m.body.code).to.eql(200);
          expect(m.body.value.allocated.length).to.be(1);

          address1 = m.body.value.allocated[0]; // store address1
          // console.log("allocated address for hyperty 1: " + address1);

          allocationKey = runtimeStubURL + "/allocationKeyTest";
          msg = MessageFactory.createCreateMessageRequest(
            runtimeStubURL + "/registry/allocation", // from
            "domain://msg-node." + config.homeserver + "/hyperty-address-allocation", // to
            { number: 3,
              scheme: "WRONG-SCHEME-SHOULD-BE-IGNORED",
              "allocationKey" : allocationKey
            }, // body.value
            "policyURL" // policy
          );
          send(msg);
        } else
        if (seq === 3) {
          // this message is expected to be the allocation response
          expect(m.id).to.eql(msg.id);
          expect(m.type.toLowerCase()).to.eql("response");
          expect(m.from).to.eql("domain://msg-node." + config.homeserver +  "/hyperty-address-allocation");
          expect(m.to).to.eql(runtimeStubURL + "/registry/allocation");
          expect(m.body.code).to.eql(200);
          expect(m.body.value.allocated.length).to.be(3);

          addresses = m.body.value.allocated; // store addresses

          msg = MessageFactory.createDeleteMessageRequest(
            runtimeStubURL + "/registry/allocation", // from
            "domain://msg-node." + config.homeserver + "/hyperty-address-allocation", // to
            [address1], // body.childrenResources
            "attribute" // attribute
          );
          send(msg);
        } else
        if (seq === 4) {
          // this message is expected to be the allocation response
          expect(m.id).to.eql(msg.id);
          expect(m.type.toLowerCase()).to.eql("response");
          expect(m.from).to.eql("domain://msg-node." + config.homeserver +  "/hyperty-address-allocation");
          expect(m.to).to.eql(runtimeStubURL + "/registry/allocation");
          expect(m.body.code).to.eql(200);

          // delete addresses by allocationKey
          msg = MessageFactory.createDeleteMessageRequest(
            runtimeStubURL + "/registry/allocation", // from
            "domain://msg-node." + config.homeserver + "/hyperty-address-allocation", // to
            allocationKey // resource
          );
          send(msg);
        } else
        if (seq === 5) {
          // this message is expected to be the deallocation response
          expect(m.id).to.eql(msg.id);
          expect(m.type.toLowerCase()).to.eql("response");
          expect(m.from).to.eql("domain://msg-node." + config.homeserver +  "/hyperty-address-allocation");
          expect(m.to).to.eql(runtimeStubURL + "/registry/allocation");
          expect(m.body.code).to.eql(200);

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
