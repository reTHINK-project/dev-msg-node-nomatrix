import expect from 'expect.js';
import activateStub from '../src/stub/MatrixProtoStub';
import Config from './configuration.js';

let config = new Config();

describe('Matrix-Stub address allocation and register the Hyperty in the Domain-Registry', function() {

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

  after(function() {
    cleanup();
  });

  let cleanup = () => {
    if ( stub1 )
      stub1.disconnect();
    if ( stub2 )
      stub2.disconnect();
  }

  /**
   * Tests the connection of a stub internally in a Matrix Domain.
   * This test uses an idToken to authenticate against the Matrix Domain.
   */
  it('allocate hyperty address in localdomain and register the hyperty', function(done) {

    // prepare and connect stub1 with an identity token
    let config1 = {
      messagingnode: config.messagingnode,
      runtimeURL : "runtime://" + config.homeserver + "/2345"
    }

    let send1;
    let bus1 = {
      postMessage: (m) => {
        // console.log(m);
        seq1++;
        // console.log("stub 1 got message no " + seq1 + " : " + JSON.stringify(m));
        if (seq1 === 1) {
          expect(m).to.eql( {
            type : "update",
            from : runtime1URL,
            to : runtime1URL + "/status",
            body : {value: 'connected'}
          });
        }
        else
        if (seq1 === 2) {
          // this message is expected to be the allocation response
          expect(m.id).to.eql("1");
          expect(m.type.toLowerCase()).to.eql("response");
          expect(m.from).to.eql("domain://msg-node." + config.homeserver +  "/hyperty-address-allocation");
          expect(m.to).to.eql(runtime1URL + "/registry/allocation");
          expect(m.body.code).eql(200);
          expect(m.body.value.allocated.length).to.be(1);
          address1 = m.body.value.allocated[0]; // store address1
          // console.log("allocated address for hyperty 1: " + address1);
          send1({
            id: "4",
            type: "create",
            from: "runtime://matrix1.rethink/1541/registry/123", // from runtime, not hyperty
            to: "domain://registry." + config.homeserver,
            body: { user: 'user://google.com/testuser111',
                    hypertyDescriptorURL: 'http://matrix1.rethink/HelloHyperty123',
                    hypertyURL: address1
                  }
          });
        } else
        if (seq1 === 3) {
          expect(m.id).to.eql("4");
          expect(m.type.toLowerCase()).to.eql("response");
          expect(m.from).to.eql("domain://registry." + config.homeserver);
          expect(m.to).to.eql("runtime://matrix1.rethink/1541/registry/123");
          expect(m.body.message).to.eql("Hyperty created");
          // expect(m).to.eql( {
          //   id   : "4",
          //   type : "response",
          //   from : "domain://registry." + config.homeserver,
          //   to   : "runtime://matrix1.rethink/1541/registry/123",
          //   body : {message : "Hyperty created"}
          // });
          stub1.disconnect();
          done();
        }
      },
      addListener: (url, callback) => {
        send1 = callback;
      }
    }

    connectStub(bus1, runtime1URL, config1).then( (stub) => {
      stub1 = stub;
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
    });

  });

  it('get a user from the registry', function(done) {
    // prepare and connect stub1 with an identity token
    let config1 = {
      messagingnode: config.messagingnode,
      runtimeURL : "runtime://" + config.homeserver + "/23456"
    }

    let send1;
    let bus2 = {
      postMessage: (m) => {
        // console.log("MESSAGE#-#-#-#-#-#--#-#-#-#-#-#--#-#-#-#-");
        // console.log(m);
        if (m.id === 10) {
          expect(m.type.toLowerCase()).to.eql("response");
          expect(m.from).to.eql("domain://registry." + config.homeserver);
          expect(m.to)  .to.eql(runtime2URL);
          expect(m.body[address1]).not.to.be.null;
          stub1.disconnect();
          done();
        }
      },
      addListener: (url, callback) => {
        send1 = callback;
      }

    }

    connectStub(bus2, runtime2URL, config1).then( (stub) => {
      stub1 = stub;
      send1( {
        id: 10,
        type: "read",
        from: runtime2URL,
        to: "domain://registry." + config.homeserver,
        body: {
          user: 'user://google.com/testuser111'
        }
      });
    });

  });

  // TODO: implement tests and corrsponding lines in WSHandler
  // it('delete a hyperty through the messaging node in the registry', function(done) {
  //
  // }



});
