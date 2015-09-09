var ForkedWorker = require('../../../lib/ForkedWorker');

new ForkedWorker()
	.on('data', function(data, callback) {
		callback('Fails Processing');
	})
	.start();
