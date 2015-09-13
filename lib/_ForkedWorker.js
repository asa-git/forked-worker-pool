/**
 * Private implementation to handle forked worker in the NodeJs Instance with the Pool.
 * Note: the only reason this module is in its own file is to allow unit testing.
 * There are no reason to refer to this file in your application.
 */

//TODO: document the option parameter of the constructor
//TODO: see how to implement an optional timout for the started state.

var fork = require('child_process').fork;
var util = require('util');
var EventEmitter = require('events').EventEmitter;

function _ForkedWorker(config) {

	if (!(this instanceof _ForkedWorker)) {
		return new _ForkedWorker(config);
	}

	var self = this;
	this._instance = fork(config.path, config.args, config.options)
						.on('message', function(message) {
							// handles a notification sent by the worked instance
							switch(message.event) {
								case 'started':
									// The worker is now ready to receive new data to process
									// Send the notification to the pool unless this worker was asked to be disconnected.
									var duplicate = (self._isStarted === true);
									self._isStarted = true;
									if (self._disconnectRequested) {
										self.disconnect();
									} else if (!duplicate) {
										process.nextTick(self.emit.bind(self, 'started', self));	
									}
									break;
								case 'data':
									// The worker has sent the results of its processing
									process.nextTick(self.emit.bind(self, 'data', self, message.data));
									break;
								case 'error':
									// The worker has raised an error...
									process.nextTick(self.emit.bind(self, 'error', self, message.data));
									break;
							}
						})
						.on('disconnect', function() {
							// The forked process has been disconnected (no more messages can be sent to it).
							process.nextTick(self.emit.bind(self, 'disconnected', self));
						})
						.on('exit', function(exitCode) {
							// The forked process has been terminated.
							// Clean up any resources held by this instance and notify the pool.
							process.nextTick(self.emit.bind(self, 'exit', self, exitCode));
							self._instance = null;
						});
	this._id = this._instance.pid;
	this._isStarted = false;
	this._disconnectRequested = false;
}
util.inherits(_ForkedWorker, EventEmitter);

_ForkedWorker.prototype.disconnect = function() {
	if (this.isConnected()) {
		process.nextTick(this._instance.disconnect.bind(this._instance));
	}
	this._disconnectRequested = true;
	return this;
};

_ForkedWorker.prototype.isConnected = function() {
	return (this._instance && this._instance.connected && this._isStarted ? true : false);
};

_ForkedWorker.prototype.getId = function()  {
	return this._id;
};

_ForkedWorker.prototype.send = function(data)  {
	if (this.isConnected() && !this._disconnectRequested) {
		this._instance.send({ event: 'data', data: data });
		return true;
	}
	return false;
};

module.exports = _ForkedWorker;