var config = {};
// THE external domain, that is used by the Runtimes to talk to the MN (MIGHT contain a port number)
config.domain        = "matrix1.rethink";

// THE pure Matrix domain, that is used to create UserIDs
config.matrixDomain  = "matrix1.rethink";


// should not be necessary to change below this line
config.WS_PORT       = 8001;
config.homeserverUrl = "http://localhost:8008";
config.registration  = "rethink-mn-registration.yaml";

module.exports = config;
