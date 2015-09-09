/**
 * Main module to create a pool of Forked Workers.
 */

//TODO: add a module path check in filterConfig()
//TODO: replace the array Pool._jobs.prending with a queue for performance.
//TODO: see how to implement an optional timout for the started state of workers.
//TODO: define the option arguments of the _ForkedWorker constructor
//TODO: handle failing workers

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var _ForkedWorker = require('./_ForkedWorker');


function isInteger(n) {
	return n === +n && n === (n|0);
}
/**
 * Utility method to filter and validate the configuration of the pool
 */
function filterConfig(config) {

	if (typeof config !== 'object' || config === null ||  Array.isArray(config)) {
		throw new TypeError('Expecting a valid config object');
	}
	if (typeof config.path !== 'string' || !config.path) {
		throw new Error('Expecting a path for the workers module');
	}
	if (typeof config.size !== 'number' || !isInteger(config.size) || config.size<=0) {
		throw new Error('Expecting an integer>0 for the number of workers to be associated with this pool');
	}
	if ('autoStart' in config && typeof config.autoStart!=='boolean') {
		throw new TypeError('Expecting a boolean for the autoStart parameter');	
	}
	return {
		path: config.path,
		size: config.size,
		autoStart: (config.autoStart || false)
	};
}

/**
 * Constructor of the pool.
 */
function Pool(config) {
	this._conf = filterConfig(config);
	this._workers = {	instances: [],
						idle: [],
						busy: [] };

	this._jobs = {		processedCount: 0,
						assigned: [],
						pending: [] };

	if (this._conf.autoStart) {
		this.start();
	}
}
util.inherits(Pool, EventEmitter);

function removeFromArray(array, valueOrFunction) {
	var index = -1;
	if (typeof valueOrFunction === 'function') {
		array.some( function(value, idx) { if (valueOrFunction(value)) { index = idx; return true; } });
	} else {
		index = array.indexOf(valueOrFunction);
	}
	return (index<0 ? null : array.splice(index, 1)[0]);
}
Pool.prototype._hasWorker = function(worker) {
	return (this._workers.instances.indexOf(worker)>=0);
};
Pool.prototype._removeWorker = function(worker) {
	// Remove the reference of the worker
	removeFromArray(this._workers.instances, worker);
	removeFromArray(this._workers.idle, worker);
	removeFromArray(this._workers.busy, worker);
	
	// make sure assign job to this worker is placed back in the queue
	var job = removeFromArray(this._jobs.assigned, function(job) { return (job.worker===worker); });
	if (job) {
		job.worker = null;
		this._jobs.pending.push(job);
	}
};
Pool.prototype._dispatchJobs = function() {
	while (this._workers.idle.length>0 && this._jobs.pending.length>0) {
		var worker = this._workers.idle.shift();
		var job = this._jobs.pending.shift();
		job.worker = worker;
		this._workers.busy.push(worker);
		this._jobs.assigned.push(job);
		worker.send(job.data);
	}
};

Pool.prototype.start = function() {
	var self = this;
	function createWorker(config) {
		return new _ForkedWorker(config.path)
				.on('started', function(worker) {
					if (self._hasWorker(worker)) {
						self._workers.idle.push(worker);
						self.emit('started', self);
						self._dispatchJobs();
					}
				})
				.on('data', function(worker, data) {
					var job = removeFromArray(self._jobs.assigned, function(job) { return (job.worker===worker); });
					removeFromArray(self._workers.busy, worker);
					if (self._hasWorker(worker)) {
						self._workers.idle.push(worker);
						self._jobs.processedCount++;
						self._dispatchJobs();
					}
					self.emit('data', self, job.data, data);
				})
				.on('disconnected', function(worker) {
					self._removeWorker(worker);
					self.emit('disconnected', self);
				})
				.on('exit', function(worker) {
					self._removeWorker(worker);
					self.emit('exit', self);
				});
	}
	while(this._workers.instances.length<this._conf.size) {
		this._workers.instances.push(createWorker(this._conf));
	}
	return this;
};
Pool.prototype.releaseIdle = function(count) {
	var nbItems = (	isInteger(count) ?
					Math.min(this._workers.idle.length, Math.max(count,0)) : 
					this._workers.idle.length );

	this._workers.idle.splice(0, nbItems).forEach(function(worker) { worker.disconnect(); });
	return nbItems;
};
Pool.prototype.releaseAll = function() {
	this._workers.instances.forEach(function(worker) { worker.disconnect(); });
	this._workers.instances = [];
	return this;
};


Pool.prototype.send = function(data) {
	this._jobs.pending.push({ data: data });
	this._dispatchJobs();
};

Pool.prototype.getStatus = function() {
	return {
		workers: {
			created: this._workers.instances.length,
			idle: this._workers.idle.length,
			busy: this._workers.busy.length
		},
		jobs: {
			processed: this._jobs.processedCount,
			assigned: this._jobs.assigned.length,
			pending: this._jobs.pending.length
		}
	};
};
module.exports = Pool;