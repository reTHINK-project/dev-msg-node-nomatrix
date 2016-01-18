var JSRequest = function() {
  console.log("before require request");
  this._client = require('request');
  console.log("after require request");
};

JSRequest.prototype.get = function(url, callback) {
  this._client
      .get(url)
      .on('response', function(response) {
        callback(null, response);
      });
};

JSRequest.prototype.put = function(url, message, callback) {
  this._client
      .post({
        headers: {'content-type': 'application/json'},
        url: url,
        body: message
      }, function(error, response, body) {
        if(err) {
          callback(err, null);
        }

        callback(null, body);
      });
};

JSRequest.prototype.update = function(url, message, callback) {
};

module.exports = JSRequest;
