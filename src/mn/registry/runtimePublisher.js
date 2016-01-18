
var MN_CONFIG = require('../config');

export default class RuntimePublisher {
  /**
   * construction of the RuntimePublisher
   * @param  {Object} config      configuration object
   * @param  {...}
   */
  constructor() {
    this.config = MN_CONFIG;
    this.http = require('http');
  }

  publishMapping(map) {
    var options = {
      host: '127.0.0.1',
      port: 4567,
      path: '/hyperty/user/1',
      method: 'PUT'
    };

    var req = this.http.request(options, function(res) {
      console.log('STATUS: ' + res.statusCode);
      console.log('HEADERS: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        console.log('BODY: ' + chunk);
      });
    });

    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });

    // write data to request body
    req.write('map\n');
    req.end();
  }

}
