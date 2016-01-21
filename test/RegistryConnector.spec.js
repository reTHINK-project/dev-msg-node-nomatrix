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

  let cleanup = () => {
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
          expect(m.type).to.eql("response");
          expect(m.from).to.eql("domain://msg-node." + config.homeserver +  "/hyperty-address-allocation");
          expect(m.to).to.eql(runtime1URL + "/registry/allocation");
          expect(m.body.message).not.to.be.null;
          expect(m.body.allocated.length).to.be(1);
          // store address1
          address1 = m.body.allocated[0];
          console.log("address1 by allocation");
          console.log(address1);
          // console.log("allocated address for hyperty 1: " + address1);

          send1({
            id: "4",
            type: "CREATE",
            from: "runtime://matrix1.rethink/1541/registry/123", // from runtime, not hyperty
            to: "domain://registry." + config.homeserver,
            body: { user: 'user://google.com/testuser111',
                    hypertyDescriptorURL: 'http://matrix1.rethink/HelloHyperty123',
                    hypertyURL: address1,
                    // assertedIdentity: "user://gmail.com/testuser111",
                    // idToken: JSON.stringify({
                    //   email: "testuser111@gmail.com",
                    //   family_name: "user",
                    //   gender: "male",
                    //   given_name: "test",
                    //   id: "108032014444772078694",
                    //   link: "https://plus.google.com/108032014444772078694",
                    //   locale: "de",
                    //   name: "test user",
                    //   picture: "https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/4252rscbv5M/photo.jpg",
                    //   verified_email: true
                    // }),
                    // authorised: true
                  }
          });
        } else
        if (seq1 === 3) {
          expect(m).to.eql( {
            id   : "4",
            type : "response",
            from : "domain://registry." + config.homeserver,
            to   : "runtime://matrix1.rethink/1541/registry/123",
            body : {code : 200}
          });
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
        type: "CREATE",
        from: runtime1URL + "/registry/allocation",
        to: "domain://msg-node." + config.homeserver +  "/hyperty-address-allocation",
        body: {
          number: 1
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
          expect(m.type).to.eql("response");
          expect(m.from).to.eql("domain://registry." + config.homeserver);
          expect(m.to)  .to.eql(runtime2URL);
          expect(m.body.last.replace(':/','://')).to.eql(address1);
          // TODO: solve issue that "proto:/" comes from registry instead of "proto://"
          // hyperty:/matrix1.rethink/matrixmn/13597964-10cf-428d-a0c4-799802b06f33
          // hyperty://matrix1.rethink/matrixmn/13597964-10cf-428d-a0c4-799802b06f33
          done();
        }
      },
      addListener: (url, callback) => {
        send1 = callback;
      }

    }

    connectStub(bus2, runtime1URL, config1).then( (stub) => {
      stub1 = stub;
      send1( {
        id: 10,
        type: "READ",
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
  //
  // TODO: implement tests and corrsponding lines in WSHandler
  // it('get a hyperty through the messaging node in the registry', function(done) {
  //
  // }
  //
  // TODO: implement tests and corrsponding lines in WSHandler
  // it('register a user through the messaging node in the registry', function(done) {
  //
  // }
  //

});
