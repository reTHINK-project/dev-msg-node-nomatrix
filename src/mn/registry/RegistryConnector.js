var RegistryConnector = function(registryURL) {

  var RequestWrapper = require('./js-request');
  console.log("before wrapper");
  this._request = new RequestWrapper();
  console.log("after wrapper");
  this._registryURL = registryURL;
  console.log("end connector constructor");

};

RegistryConnector.prototype.getUser = function(userid, callback) {
  this._request.get(this._registryURL + '/hyperty/user/' + encodeURIComponent(userid), function(err, response) {
    console.log("Get user: " + JSON.stringify(response));
    callback(response);
  });
};

RegistryConnector.prototype.createUser = function(userid, callback) {
  this._request.put(this._registryURL + '/hyperty/user/' + userid, "", function(err, response) {
    console.log("Create user: " + response);
    callback(response);
  });
};

RegistryConnector.prototype.getHyperty = function(userid, hypertyid, callback) {
  var endpoint = '/hyperty/user/' + encodeURIComponent(userid) + '/' + encodeURIComponent(hypertyid);

  this._request.get(this._registryURL + endpoint, function(err, response) {
    console.log("Get hyperty: " + JSON.stringify(response));
    callback(response);
  });
};

RegistryConnector.prototype.addHyperty = function(userid, hypertyid, hypertyDescriptor, callback) {
  var endpoint = '/hyperty/user/' + encodeURIComponent(userid) + '/' + encodeURIComponent(hypertyid);
  var data = { 'descriptor': hypertyDescriptor };
  console.log("endpoint: ");console.log(this._registryURL + endpoint);
  console.log("data: ");console.log(data);
  this._request.put(this._registryURL + endpoint, data, function(err, response) {
    console.log("Add hyperty: ", response);
    callback(response);
  });
};

module.exports = RegistryConnector;
