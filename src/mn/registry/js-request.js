var JSRequest = function() {
  this.http = require('http');
  this.querystring = require('querystring');
  this.url = require('url');
  this.requestify = require('requestify');
};

JSRequest.prototype.get = function(url, callback) {
  console.log("GET GET GET GET GET GET GET GET GET GET from REGISTRY");
  console.log("url: ", url);
  this.requestify.get(url)
  .then( (response) => {
    // console.log(response.getBody());
    // console.log("ääääääääääääääääääääääääääääääääääääääääääääääääääää");
    // console.log(response.body);
    callback(null, response.getBody());
  })
  .catch( (error) => {
    console.error(error);
  });
}

JSRequest.prototype.put = function(url, message, callback) {
  console.log("PUT PUT PUT PUT PUT PUT PUT PUT PUT PUT to REGISTRY");
  console.log("url : ",url);
  // console.log(message);

  this.requestify.request(url, {
      method: 'PUT',
      body: message,
      headers: {'content-type': 'application/json'},
      dataType: 'json'
  })
  .then(function(response) {
      console.log("PUT PUT PUT PUT PUT PUT PUT PUT PUT PUT succeeded");
      // console.log(response.getBody());
      callback(null, response.getBody());
  })
  .catch( (e) => {
      console.error(e);
  });
};

JSRequest.prototype.del = function(url, callback) {
  console.log("DEL DEL DEL DEL DEL DEL DEL DEL DEL DEL DEL to REGISTRY");
  this.requestify.request(url, {
      method: 'DELETE'
  })
  .then(function(response) {
      console.log("PUT PUT PUT PUT PUT PUT PUT PUT PUT PUT succeeded");
      // console.log(response.getBody());
      callback(null, response.getBody());
  })
  .catch( (e) => {
      console.error(e);
  });
  //
  // this._client
  //     .del(url)
  //     .on('response', function(response) {
  //       callback(null, response.statusCode);
  //     });
};


module.exports = JSRequest;
