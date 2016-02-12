var RegistryConnector = function(wsHandler, registryURL) {
  var RequestWrapper = require('./js-request');
  this._request = new RequestWrapper();
  this._registryURL = registryURL
  this.wsHandler = wsHandler;
};

RegistryConnector.prototype.handleStubMessage = function (m) {
  // CREATE hyperties for allocation here or in the registry
  if (m.type.toLowerCase() === "create") {
    // register a Hyperty in the domain registry
    // TODO: make this configurable - Priority: low
    // Reason: domainname is in /etc/hosts and can find the registry this way
    // If it was an internet DNS address, the target would be found anyway when hardcoded here.
    // The information should come from configuration.js in the data folder.
    if (!m.body.user || !m.body.hypertyURL || !m.body.hypertyDescriptorURL) {
      console.log("This is not a create message.");
      return;
    }

    this.addHyperty(m.body.user, m.body.hypertyURL, m.body.hypertyDescriptorURL, (response) => {
      console.log("SUCCESS CREATE HYPERTY from REGISTRY", response);
      this.wsHandler.sendWSMsg({ // send the message back to the hyperty / runtime / it's stub
        id  : m.id,
        type: "RESPONSE",
        from: m.to,    // "registry://localhost:4567",
        to  : m.from,  // "registry://localhost:4567",
        body: { code: 200 }
      });
    });
  }

  // READ
  else if (m.type.toLowerCase() === "read"){
    console.log("READ message received on WSHandler");

    // error handling
    if (!m.body.user) {
      console.log("This is not a read message.");
      this.wsHandler.sendWSMsg({
        id  : m.id,
        type: "RESPONSE",
        from: m.to,
        to  : m.from,
        body: { code: 422 } // missing values / unprocessable
      });
    }

    // It must be a USER GET request if no hypertyURL is given.
    if (m.body.user && !m.body.hypertyURL) {
      this.getUser(m.body.user, (response) => {
        console.log("SUCCESS GET USER from REGISTRY", response);
        this.wsHandler.sendWSMsg({
          id  : m.id,
          type: "RESPONSE",
          from: m.to,
          to  : m.from,
          body: response
        });
      })
    }

    // It has to be a HYPERTY GET request when a hypertyURL is given.
    // TODO: check for correctness with documentation
    // TODO: clearify why every hypertyURL is returned instead of the one wanted
    else if (m.body.user && m.body.hypertyURL) {
      this.getHyperty(m.body.user, m.body.hypertyURL, (response) => {
        console.log("SUCCESS GET HYPERTY from REGISTRY", response);
        this.wsHandler.sendWSMsg({
          id  : m.id,
          type: "RESPONSE",
          from: m.to,
          to  : m.from,
          body: response
        });
      });
    }
  }

  // UNKNOWN
  else {
    console.error("msg type unknown");
  }
};

RegistryConnector.prototype.getUser = function(userid, callback) {
  this._request.get(this._registryURL + '/hyperty/user/' + encodeURIComponent(userid), function(err, response) {
    console.log("Get user: " + JSON.stringify(response));
    callback(response);
  });
};

RegistryConnector.prototype.createUser = function(userid, callback) {
  this._request.put(this._registryURL + '/hyperty/user/' + encodeURIComponent(userid), "", function(err, response) {
    console.log("Create user: " + response);
    callback(response);
  });
};

RegistryConnector.prototype.getHyperty = function(userid, hypertyid, callback) {
  var endpoint = '/hyperty/user/' + encodeURIComponent(userid) + '/' + encodeURIComponent(hypertyid);

  this._request.get(this._registryURL + endpoint, function(err, response) {
    console.log("Get hyperty: ", response);
    callback(response);
  });
};

RegistryConnector.prototype.addHyperty = function(userid, hypertyid, hypertyDescriptor, callback) {
  var endpoint = '/hyperty/user/' + encodeURIComponent(userid) + '/' + encodeURIComponent(hypertyid);
  var data = { 'descriptor': hypertyDescriptor };
  // console.log("[][][][][][][][][][][][][][][][][][][][][][][][][][]");
  // console.log("userid: ", userid);
  // console.log("userid urlencoded: " , encodeURIComponent(userid));
  // console.log("endpoint: ");console.log(this._registryURL + endpoint);
  // console.log("data: ");console.log(data);
  this._request.put(this._registryURL + endpoint, data, function(err, response) {
    console.log("Add hyperty: ", response);
    callback(response);
  });
};

module.exports = RegistryConnector;
