var RegistryConnector = function(registryURL) {

  if( typeof(engine) != 'undefined' &&
     typeof(engine.factory) != 'undefined' &&
     typeof(engine.factory.engineName) != 'undefined' &&
     typeof(engine.factory.engineName.contains) == 'function' &&
           engine.factory.engineName.contains("Nashorn")) {

    var RequestWrapper = require(__dirname + '/java-request');
  }else {
    var RequestWrapper = require(__dirname + '/js-request');
  }

  this._request = new RequestWrapper();
  this._registryURL = registryURL;
};

RegistryConnector.prototype.processMessage = function(msg, callback) {
  switch(msg.type.toLowerCase()) {
    case "read":
      if(msg.body.search != 'undefined' && msg.body.search === 'hypertyResourcesDataSchemes') {
        this.hypertySearch(msg.body.resource.user, msg.body.resource.resources, msg.body.resource.dataSchemes, callback);
      }else if(msg.body.search != 'undefined' && msg.body.search === 'dataObjectPerReporter') {
        this.getDataObjectByReporter(msg.body.resource, callback);
      }else if(msg.body.search != 'undefined' && msg.body.search === 'dataObjectPerURL') {
        this.getDataObject(msg.body.resource, callback);
      }else {
        this.getUser(msg.body.resource, callback);
      }
    break;

    case "create":
      if('hypertyURL' in msg.body.value) {
        this.addHyperty(msg.body.value.user, msg.body.value.hypertyURL, msg.body.value.hypertyDescriptorURL, msg.body.value.expires, msg.body.value.resources, msg.body.value.dataSchemes, callback);
      }else {
        this.addDataObject(msg.body.value.name, msg.body.value.schema, msg.body.value.expires, msg.body.value.url, msg.body.value.reporter, callback);
      }
    break;

    case "update":
      if('hypertyURL' in msg.body.value) {
        this.addHyperty(msg.body.value.user, msg.body.value.hypertyURL, msg.body.value.hypertyDescriptorURL, msg.body.value.expires, callback);
      }else {
        this.addDataObject(msg.body.value.name, msg.body.value.schema, msg.body.value.expires, msg.body.value.url, msg.body.value.reporter, callback);
      }
    break;

    case "delete":
      if('hypertyURL' in msg.body.value) {
        this.deleteHyperty(msg.body.value.user, msg.body.value.hypertyURL, callback);
      }else {
        this.deleteDataObject(msg.body.value.name, callback);
      }
    break;
  }
};

RegistryConnector.prototype.getUser = function(userid, callback) {
  this._request.get(this._registryURL + '/hyperty/user/' + encodeURIComponent(userid), function(err, response, statusCode) {

    var body = {
      'code': statusCode,
      'value': JSON.parse(response)
    };

    callback(body);
  });
};

RegistryConnector.prototype.addHyperty = function(userid, hypertyid, hypertyDescriptor, expires, resources, dataschemes, callback) {
  var endpoint = '/hyperty/user/' + encodeURIComponent(userid) + '/' + encodeURIComponent(hypertyid);
  var data = {
    'descriptor': hypertyDescriptor,
    'expires': expires,
    'resources': resources,
    'dataSchemes': dataschemes
  };

  this._request.put(this._registryURL + endpoint, JSON.stringify(data), function(err, response, statusCode) {

    var body = {
      'code': statusCode
    };

    callback(body);
  });
};

RegistryConnector.prototype.deleteHyperty = function(userid, hypertyid, callback) {
  var endpoint = '/hyperty/user/' + encodeURIComponent(userid) + '/' + encodeURIComponent(hypertyid);

  this._request.del(this._registryURL + endpoint, function(err, response, statusCode) {

    var body = {
      'code': statusCode
    };

    callback(body);
  });
};

RegistryConnector.prototype.getDataObject = function(resource, callback) {

  this._request.get(this._registryURL + '/hyperty/dataobject/url/' + encodeURIComponent(resource), function(err, response, statusCode) {

    var body = {
      'code': statusCode,
      'value': JSON.parse(response)
    };

    callback(body);
  });
};

RegistryConnector.prototype.getDataObjectByReporter = function(reporter, callback) {

  this._request.get(this._registryURL + '/hyperty/dataobject/reporter/' + encodeURIComponent(reporter), function(err, response, statusCode) {

    var body = {
      'code': statusCode,
      'value': JSON.parse(response)
    };

    callback(body);
  });
};

RegistryConnector.prototype.addDataObject = function(dataobjName, schema, expires, url, reporter, callback) {
  var endpoint = '/hyperty/dataobject/' + encodeURIComponent(url);
  var data = {
    'name': dataobjName,
    'schema': schema,
    'url': url,
    'reporter': reporter,
    'expires': expires
  };

  this._request.put(this._registryURL + endpoint, JSON.stringify(data), function(err, response, statusCode) {

    var body = {
      'code': statusCode
    };

    callback(body);
  });
};

RegistryConnector.prototype.deleteDataObject = function(dataObjectName, callback) {
  var endpoint = '/hyperty/dataobject/url/' + encodeURIComponent(dataObjectName);

  this._request.del(this._registryURL + endpoint, function(err, response, statusCode) {

    var body = {
      'code': statusCode
    };

    callback(body);
  });
};

RegistryConnector.prototype.hypertySearch = function(userid, resources, dataschemes, callback) {
  var endpoint = '/hyperty/user/' + encodeURIComponent(userid) + '/hyperty';

  var qsResources = '';
  var qsDataschemes = '';
  var querystring = '';

  if(typeof resources != "undefined" && resources != null && resources.length > 0) {
    var qsResources = 'resources=' + resources.join(',');
  }

  if(typeof dataschemes != "undefined" && dataschemes != null && dataschemes.length > 0) {
    var qsDataschemes = 'dataSchemes=' + dataschemes.join(',');
  }

  if(qsResources != "" && qsDataschemes != "") {
    var querystring = '?' + qsResources + '&' + qsDataschemes;
  }else if(qsResources != "") {
    var querystring = '?' + qsResources;
  }else if(qsDataschemes != "") {
    var querystring = '?' + qsDataschemes;
  }

  this._request.get(this._registryURL + endpoint + querystring, function(err, response, statusCode) {

    var body = {
      'code': statusCode,
      'value': JSON.parse(response)
    };

    callback(body);
  });

};

module.exports = RegistryConnector;
