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
  var data = this.querystring.stringify({
    body: message
  })
  console.log("data: ");console.log(data);
  console.log("url before: ");console.log(url);

  var o = { id: '4',
    type: 'CREATE',
    from: 'hyperty://matrix1.rethink/matrixmn/ac98ac7d-d6ee-436e-beea-dc2c1cde172e',
    to: 'registry://msg-node.matrix1.rethink',
    body:
     { user: 'user://testuser10',
       hypertyDescriptorURL: 'hyper-1',
       hypertyURL: 'cde172e' }
  };

  this.requestify.request(url, {
      method: 'PUT',
      body: o,
      headers: {'content-type': 'application/json'},
      dataType: 'json'
  })
  .then(function(response) {
      // get the response body
      console.log("aaa)()()()(=)======()()(==)=((=)(==(=(=(==)))))");
      console.log(response.getBody());

      // get the response headers
      response.getHeaders();

      // get specific response header
      response.getHeader('Accept');

      // get the code
      response.getCode();

      // get the raw response body
      response.body;
  })
  .catch( (e) => {
    console.log("eee");
    console.log(e);
  });


  var dest = this.url.parse(url);
  console.log("url after");console.log(dest);

  var options = {
    hostname: dest.hostname,
    port: dest.port,
    path: dest.pathname,
    // hostname: 'localhost',
    // port: 4567,
    // path: '/',
    method: 'POST',
    headers: {'content-type': 'application/json'}
  }

  console.log("options");
  console.log(options);

  var req = this.http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      console.log(`BODY: ${chunk}`);
      callback(null, chunk);
    });
    res.on('end', () => {
      console.log('No more data in response.')
    });
  });

  req.on('error', (e) => {
    console.log(`problem with request: ${e.message}`);
    callback(e, null)
  });

  req.write(data);
  req.end();
  //
  // this.http.post({
  //       headers: ,
  //       url: url,
  //       body: message
  //     }, function(error, response, body) {
  //       if(err) {
  //         callback(err, null);
  //       }
  //
  //       callback(null, body);
  //     });
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
