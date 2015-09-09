/**
 * Provides a simple implementation for forked workers.
 */

//TODO: allow streams of data (thus bigger set of data)to be piped to and from the pool.
 
var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
 * Constructor of a Forked Worker.
 */
function ForkedWorker() {
	if (!(this instanceof ForkedWorker)) {
		return new ForkedWorker();
	}
	var self = this;
	process
		.on('message', function(message) {
			if (message.event === 'data') {
				process.nextTick(function() {
					self.emit(
						'data',
						message.data,
						function dataCallBack(err, data) {
							if (process.connected) {
								if (err) {
									process.send({ event: 'error', instanceId: process.pid, data: err });
								} else {
									process.send({ event: 'data', instanceId: process.pid, data: data });
								}
								
							}
						});
				});
			}
		})
		.on('disconnect', function() {
			self.emit('disconnect');
		});
}
util.inherits(ForkedWorker, EventEmitter);

/**
 * Notifies the pool this worker is initialized and ready to process data.
 */
ForkedWorker.prototype.start = function() {
	if (process.connected) {
		process.send({ event: 'started', instanceId: process.pid });
	}
	return this;
};

module.exports = ForkedWorker;