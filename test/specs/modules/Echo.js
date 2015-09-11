var ForkedWorker = require('../../../lib/ForkedWorker');

new ForkedWorker()
	.on('data', function(data, callback) {
		callback(null, { echoOf: data });
	})
	.start();
