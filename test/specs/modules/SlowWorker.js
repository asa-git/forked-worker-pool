var ForkedWorker = require('../../../lib/ForkedWorker');

var worker = new ForkedWorker()
		.on('data', function(data, callback) {
			setTimeout(function() { callback(null, data); }, 1500);
		});
setTimeout(function() { worker.start(); }, 1500);

