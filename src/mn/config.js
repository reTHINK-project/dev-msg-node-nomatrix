var config = {};
// config.domain        = "matrix.docker";
config.domain        = "matrix1.rethink";

// should not be necessary to change below this line
config.WS_PORT       = 8001;
config.homeserverUrl = "http://localhost:8008";
config.registration  = "rethink-mn-registration.yaml";

module.exports = config;
