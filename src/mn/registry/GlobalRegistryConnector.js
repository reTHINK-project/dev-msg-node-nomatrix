/**
 * Copyright 2016 PT Inovação e Sistemas SA
 * Copyright 2016 INESC-ID
 * Copyright 2016 QUOBIS NETWORKS SL
 * Copyright 2016 FRAUNHOFER-GESELLSCHAFT ZUR FOERDERUNG DER ANGEWANDTEN FORSCHUNG E.V
 * Copyright 2016 ORANGE SA
 * Copyright 2016 Deutsche Telekom AG
 * Copyright 2016 Apizee
 * Copyright 2016 TECHNISCHE UNIVERSITAT BERLIN
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var GlobalRegistryConnector = function(url) {
  this._registryURL = url;
};

GlobalRegistryConnector.prototype.processMessage = function(msg, callback) {
  switch(msg.type.toLowerCase()) {
    case "read":
      this.readOperation(msg, callback);
    break;

    case "create":
      this.createOperation(msg, callback);
    break;
  }
};


GlobalRegistryConnector.prototype.readOperation = function(msg, callback) {

  // GET request for given guid
  request.get(this._registryURL + '/guid/' + msg.body.resource, function(err, response, statusCode) {
    if(err) {
      var body = {
        'code': 504,
        'description': 'Error contacting the global registry.'
      };
    }
    else if(statusCode == 200) {
      var body = {
        'description': 'request was performed successfully',
        'code': statusCode,
        'value': response
      };
    }
    else {
      var body = {
        'code': statusCode,
        'description': response.message
      }
    }
    callback(body);
  });
};

GlobalRegistryConnector.prototype.createOperation = function(msg, callback) {

  // PUT request with msg.body.value as jwt data
  request.put(this._registryURL + '/guid/' + msg.body.resource, msg.body.value, function(err, response, statusCode) {
    if(err) {
      var body = {
        'code': 504,
        'description': 'Error contacting the global registry.'
      };
    }
    else {
      var body = {
        'description': 'request was performed successfully',
        'code': statusCode
      };
    }
    callback(body);
  });
};

module.exports = GlobalRegistryConnector;
