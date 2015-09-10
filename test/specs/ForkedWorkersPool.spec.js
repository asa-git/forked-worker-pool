describe('The Pool of a Forked Workers', function() {
	var chai = require('chai');
	var assert = chai.assert;
	var path = require('path');
	//var EventEmitter = require('events').EventEmitter;

	//var _ForkedWorker=require(path.resolve('./', 'lib/_ForkedWorker'));
	var Pool = require(path.resolve('./', 'lib/index'));

	// our different test modules
	var modules = {
		echo: path.resolve(__dirname , './modules/Echo'),
		failProcessing: path.resolve(__dirname , './modules/FailProcessing'),
		fatalProcessing: path.resolve(__dirname , './modules/FatalProcessing'),
		failOnLoad: path.resolve(__dirname , './modules/FailOnLoad'),
		slowWorker: path.resolve(__dirname , './modules/SlowWorker')
	};

	// default test timeout increased as we are launching new node processes.
	this.timeout(10000);

	// ensure we have a full stack trace when assertions fail
	chai.config.includeStack = true;

	//TODO: update the configuration to allow coverage of the forked processes.

	it ('throws an error on an invalid configuration object', function() {

		function test(expectedErrorType, expectedErrorMessage, config, index) {
			assert.throws(	function() { new Pool(config); },
							expectedErrorType,
							expectedErrorMessage,
							'Failed at the index:' + index);

		}
		function add(obj, key, value) {
			obj[key] = value;
			return obj;
		}

		// the config object itself
		[ null, undefined, function() {}, '', 0, [], false]
			.forEach(test.bind(null, TypeError, 'Expecting a valid config object'));

		// the module path
		[ null, null, undefined, function() {}, '', 0, [], false]
			.map(function(config, index) {
				var base = {};
				return (index===0 ? base : add(base, 'path', config));
			})
			.forEach(test.bind(null, Error, 'Expecting a path for the workers module'));

		// the number of workers
		[ null, null, undefined, function() {}, '', 0, '2', [], false]
			.map(function(config, index) {
				var base = { path: 'somepath'};
				return (index===0 ? base : add(base, 'size', config));
			})
			.forEach(test.bind(null, Error, 'Expecting an integer>0 for the number of workers to be associated with this pool'));

		// the optional auto start flag
		[ null, undefined, function() {}, '', 0, [] ]
			.map(function(config) { return add({ path: 'somepath', size: 1}, 'autoStart', config); })
			.forEach(test.bind(null, Error, 'Expecting a boolean for the autoStart parameter'));
	});
	it ('will notify the main application when workers are started and terminated', function(done) {
		var config = { path: modules.echo, size: 10 };
		var counters = { started: 0, disconnected: 0, exit: 0};
		var pool = new Pool(config)
					.on('started', function(instance){
						assert.strictEqual(instance, pool);
						assert.isBelow(counters.started, config.size);
						counters.started++;
						assert.deepEqual(instance.getStatus(),
											{
												workers: { created: config.size, idle: counters.started, busy: 0 },
										  		jobs: { processed: 0, assigned: 0, pending: 0	}
										  	});
						if (counters.started === config.size) {
							assert.deepEqual(instance.getStatus(),
											{
												workers: { created: config.size, idle: config.size, busy: 0 },
										  		jobs: { processed: 0, assigned: 0, pending: 0	}
										  	});
							instance.releaseAll();
						}
					})
					.on('disconnected', function(instance) {
						assert.strictEqual(instance, pool);
						assert.strictEqual(instance.getStatus().workers.created, 0);
						assert.strictEqual(instance.getStatus().workers.idle, config.size - counters.disconnected - 1);
						assert.isBelow(counters.disconnected, config.size);
						counters.disconnected++;
					})
					.on('exit', function(instance) {
						assert.strictEqual(instance, pool);
						assert.isBelow(counters.exit, config.size);
						counters.exit++;
						if (counters.exit === config.size) {
							assert.deepEqual(instance.getStatus(),
											{
												workers: { created: 0, idle: 0, busy: 0 },
										  		jobs: { processed: 0, assigned: 0, pending: 0	}
										  	});
							done();
						}
					})
					.start();
	});
	it ('will notify the main application when idles workers are terminated', function(done) {
		var config = { path: modules.echo, size: 10 };
		var counters = { started: 0, disconnected: 0, exit: 0};
		var pool = new Pool(config)
					.on('started', function(instance){
						assert.strictEqual(instance, pool);
						assert.isBelow(counters.started, config.size);
						counters.started++;
						assert.strictEqual(instance.getStatus().workers.idle, 1);
						assert.strictEqual(instance.releaseIdle(1), 1);
						assert.strictEqual(instance.getStatus().workers.idle, 0);
					})
					.on('disconnected', function(instance) {
						assert.strictEqual(instance, pool);
						assert.isBelow(counters.disconnected, config.size);
						assert.strictEqual(instance.getStatus().workers.created, config.size - counters.disconnected - 1);
						counters.disconnected++;
					})
					.on('exit', function(instance) {
						assert.strictEqual(instance, pool);
						assert.isBelow(counters.exit, config.size);
						counters.exit++;
						if (counters.exit === config.size) {
							assert.deepEqual(instance.getStatus(),
											{
												workers: { created: 0, idle: 0, busy: 0 },
										  		jobs: { processed: 0, assigned: 0, pending: 0	}
										  	});
							done();
						}
					})
					.start();
	});
	it ('will automatically start forked instances if requested to', function(done) {
		var config = { path: modules.echo, size: 10, autoStart: true };
		var counters = { started: 0, disconnected: 0, exit: 0};
		var pool = new Pool(config)
					.on('started', function(instance){
						assert.strictEqual(instance, pool);
						assert.isBelow(counters.started, config.size);
						counters.started++;
						if (counters.started === config.size) {
							instance.releaseAll();
						}
					})
					.on('disconnected', function(instance) {
						assert.strictEqual(instance, pool);
						assert.isBelow(counters.disconnected, config.size);
						counters.disconnected++;
					})
					.on('exit', function(instance) {
						assert.strictEqual(instance, pool);
						assert.isBelow(counters.exit, config.size);
						counters.exit++;
						if (counters.exit === config.size) {
							done();
						}
					});
	});
	it ('will receive the expected result of the workers data processing', function(done) {
		var config = { path: modules.echo, size: 10, autoStart: true };
		var counters = { started: 0, disconnected: 0, exit: 0};
		var jobs = {};
		for (var i=0;i<1000;i++) {
			jobs[i] = { index: i };
		}
		var pool = new Pool(config)
					.on('started', function(instance){
						assert.strictEqual(instance, pool);
						assert.isBelow(counters.started, config.size);
						counters.started++;
					})
					.on('data', function(instance, dataSent, dataReceived) {
						assert.strictEqual(instance, pool);
						assert.deepEqual(dataReceived, { echoOf: dataSent } );
						assert.isDefined(jobs[dataSent.index]);
						delete jobs[dataSent.index];
						if (Object.keys(jobs).length===0) {
							instance.releaseAll();
						}
					})
					.on('disconnected', function(instance) {
						assert.strictEqual(instance, pool);
						assert.isBelow(counters.disconnected, config.size);
						counters.disconnected++;
					})
					.on('exit', function(instance) {
						assert.strictEqual(instance, pool);
						assert.isBelow(counters.exit, config.size);
						counters.exit++;
						if (counters.exit === config.size) {
							done();
						}
					});
		Object.keys(jobs).forEach(function(key) { pool.send(jobs[key]); });
	});
});