var JSRequest = function() {
  console.log("before require request");
  //this._client = require('request');
  this.http = require('http');
  this.querystring = require('querystring');
  this.url = require('url');
  this.requestify = require('requestify');
};

JSRequest.prototype.get = function(url, callback) {
  this.http.get(url, (response) => {
    console.log('Response: ' + response.statusCode);
    response.resume();
  }).on('error', (e) => {
    console.error('Error: ' + e.message);
  });
}

JSRequest.prototype.put = function(url, message, callback) {
  console.log("bbbb=B=B=B==B==B=B==B===B=B==B=B=B=B=B=B=B=B=B==B=B");
  console.log(url);
  console.log(message);

  this.requestify.request(url, {
      method: 'PUT',
      body: message,
      headers: {'content-type': 'application/json'},
      dataType: 'json'
  })
  .then(function(response) {
      console.log("aaa)()()()(=)======()()(==)=((=)(==(=(=(==)))))");
      console.log(response.getBody());
      callback(null, response.getBody());
  })
  .catch( (e) => {
      console.error(e);
  });
};

JSRequest.prototype.update = function(url, message, callback) {
};


// JSRequest.prototype.get = function(url, callback) {
//   this._client
//       .get(url)
//       .on('response', function(response) {
//         callback(null, response);
//       });
// };
//
// JSRequest.prototype.put = function(url, message, callback) {
//   this._client
//       .post({
//         headers: {'content-type': 'application/json'},
//         url: url,
//         body: message
//       }, function(error, response, body) {
//         if(err) {
//           callback(err, null);
//         }
//
//         callback(null, body);
//       });
// };
//
// JSRequest.prototype.update = function(url, message, callback) {
// };

module.exports = JSRequest;
