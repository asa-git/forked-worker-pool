//var util = require('util');
var ForkedWorker = require('../../../lib/ForkedWorker');
/*var winston = require('winston');
var logger = new (winston.Logger) ({
				transports: [
					new (winston.transports.File)({ filename: 'somefile.log' })
				]});*/

new ForkedWorker()
	.on('data', function(data, callback) {
		callback(null, { echoOf: data });
	})
	/*.on('disconnect', function() {
		//logger.log('info', 'instance disconnected', process.connected);
	})*/
	.start();
//process.disconnect();
//notifyReady();
//.start();
