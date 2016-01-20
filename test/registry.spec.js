import expect from 'expect.js';
import activateStub from '../src/stub/MatrixProtoStub';
import Config from './configuration.js';

let config = new Config();

describe('registry: ' + config.homeserver, function() {

  this.timeout(0);

  let runtime1URL = "hyperty-runtime://" + config.homeserver + "/1";

  let address1 = null;
  let stub1 = null;
  let seq1 = 0;

  let connectStub = (bus, runtimeURL, stubConfig) => {
    return new Promise((resolve, reject) => {
      let stub = activateStub(runtimeURL, bus, stubConfig).instance;

      stub.connect(stubConfig.identity)
      .then((responseCode) => { // response code is a websocket
        resolve(stub);
      }, (err) => {
        expect.fail();
        reject();
      });
    });
  };

  let cleanup = () => {
    stub1.disconnect();
  }
//
//   /**
//    * Tests the connection of a stub internally in a Matrix Domain.
//    * This test uses an idToken to authenticate against the Matrix Domain.
//    */
//   it('allocate hyperty addresses and register them', function(done) {
//
//     // prepare and connect stub1 with an identity token
//     let config1 = {
//       messagingnode: config.messagingnode
//     }
//
//     let send1;
//     let bus1 = {
//       postMessage: (m) => {
//         seq1++;
//         // console.log("stub 1 got message no " + seq1 + " : " + JSON.stringify(m));
//         if (seq1 === 1) {
//           expect(m).to.eql( {
//             type : "update",
//             from : runtime1URL,
//             to : runtime1URL + "/status",
//             body : {value: 'connected'}
//           });
//         }
//         send1( {
//           id: "1",
//           type: "CREATE",
//           from: runtime1URL + "/registry/allocation",
//           to: "registry://127.0.0.1:8001",
//           body: {
//             number: 1,
//             user: "alice",
//             hypertyURL: "",
//             hypertyDescriptorURL:""
//           }
//         });
//
//       },
//       addListener: (url, callback) => {
//         send1 = callback;
//       }
//
//     }
//
//
//     connectStub(bus1, runtime1URL, config1)
//     .then( (stub) => {
//       stub1 = stub;
//       send1( {
//         id: "1",
//         type: "CREATE",
//         from: runtime2URL + "/registry/allocation",
//         to: "domain://msg-node." + config.homeserver + "/hyperty-address-allocation",
//         body: {
//           number: 1
//         }
//       });
//     });
// /*
//     // registry address allocation
//     connectStub(bus1, runtime1URL, config1).then( (stub) => {
//       stub1 = stub;
//       send1( {
//         id: "1",
//         type: "CREATE",
//         from: runtime1URL + "/registry/allocation",
//         to: "registry://127.0.0.1:8001",
//         body: {
//           number: 1,
//           user: "alice",
//           hypertyURL: "",
//           hypertyDescriptorURL:""
//         }
//       });
//     });
// */
//
//
//   });
//
});
