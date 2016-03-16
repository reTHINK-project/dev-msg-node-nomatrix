var config = {};
// THE external domain, that is used by the Runtimes to talk to the MN (MIGHT contain a port number)
config.domain        = "rethink.no-ip.org";

// THE pure Matrix domain, that is used to create UserIDs
config.matrixDomain  = "rethink.no-ip.org";


// should not be necessary to change below this line
config.WS_PORT       = 8001;
config.homeserverUrl = "http://localhost:8008";
config.registration  = "rethink-mn-registration.yaml";

module.exports = config;
