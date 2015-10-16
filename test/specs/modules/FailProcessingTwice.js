var ForkedWorker = require('../../../lib/ForkedWorker');

var failureCount = 0;
new ForkedWorker()
	.on('data', function(data, callback) {
		if (failureCount<2) {
			failureCount++;
			callback('Fails Processing');
		} else {
			callback(null, data);
		}
	})
	.start();
