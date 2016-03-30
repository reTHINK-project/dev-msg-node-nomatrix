var RegistryConnector = function(registryURL) {
  var RequestWrapper = require('./js-request');
  this._request = new RequestWrapper();
  this._registryURL = registryURL
  // this.wsHandler = wsHandler;
};

RegistryConnector.prototype.handleStubMessage = function (m, callback) {
  // CREATE hyperties for allocation here or in the registry
  if (m.type.toLowerCase() === "create") {
    this.addHyperty(m.body.value.user, m.body.value.hypertyURL, m.body.value.hypertyDescriptorURL, callback);
  }

  // READ
  else if (m.type.toLowerCase() === "read"){
    console.log("READ message received on WSHandler");

    // // error handling
    // if (!m.body.user) {
    //   console.log("This is not a read message.");
    //   callback({code: 422})
    // }

    // It must be a USER GET request if no hypertyURL is given.
    // if (m.body.user && !m.body.hypertyURL) {
      this.getUser(m.body.resource, callback);
      // this.getUser(m.body.user, callback);
      //   (response) => {
      //   console.log("SUCCESS GET USER from REGISTRY", response);
      //   this.wsHandler.sendWSMsg({
      //     id  : m.id,
      //     type: "RESPONSE",
      //     from: m.to,
      //     to  : m.from,
      //     body: response
      //   });
      // })
    // }

    // // It has to be a HYPERTY GET request when a hypertyURL is given.
    // // TODO: check for correctness with documentation
    // // TODO: clearify why every hypertyURL is returned instead of the one wanted
    // else if (m.body.user && m.body.hypertyURL) {
    //   this.getHyperty(m.body.user, m.body.hypertyURL, (response) => {
    //     console.log("SUCCESS GET HYPERTY from REGISTRY", response);
    //     this.wsHandler.sendWSMsg({
    //       id  : m.id,
    //       type: "RESPONSE",
    //       from: m.to,
    //       to  : m.from,
    //       body: response
    //     });
    //   });
    // }
  }

  // UNKNOWN
  else {
    console.error("+[RegistryConnector] [handleStubMessage] msg type unknown");
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
