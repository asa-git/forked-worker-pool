describe('Handlers of a Forked Worker', function() {
	var chai = require('chai');
	var assert = chai.assert;
	var path = require('path');
	var EventEmitter = require('events').EventEmitter;

	var _ForkedWorker=require(path.resolve('./', 'lib/_ForkedWorker'));
	process.env.istanbul_config_file = './test/conf/istanbul.json';

	// our different test modules
	var modules = {
		echo: path.resolve(__dirname , './modules/Echo'),
		failProcessing: path.resolve(__dirname , './modules/FailProcessing'),
		fatalProcessing: path.resolve(__dirname , './modules/FatalProcessing'),
		failOnLoad: path.resolve(__dirname , './modules/FailOnLoad'),
		slowWorker: path.resolve(__dirname , './modules/SlowWorker')
	};

	// default test timeout increased as we are launching new node processes.
	this.timeout(30000);

	// ensure we have a full stack trace when assertions fail
	chai.config.includeStack = true;

	//TODO: update the configuration to allow coverage of the forked processes.

	function createConfig(path, isSilent) {
		return (process.env.running_under_istanbul ?
				{	path: './node_modules/istanbul/lib/cli',
					args: ['--config=./test/conf/istanbul.json', 'cover', '--report', 'none', '--print', 'none', '--include-pid', path],
					options: { silent: (isSilent===false ? false : true ) } } : 
				{	path: path,
					args: [],
					options: { silent: (isSilent===false ? false : true ) }
				});
	}

	// generic test used multiple times
	function validateInstance(instance, worker, shouldBeConnected) {
		assert.strictEqual(instance, worker);
		assert.strictEqual(instance.isConnected(), shouldBeConnected);
		assert.isNumber(instance.getId());
		assert.strictEqual(instance.getId(), worker.getId());
	}

	// ensure the worker does not emit an event for which no listener has be set
	function validateAllowedEvents(worker) {
		var events = ['started','data','error','disconnected','exit'];
		events.forEach(
			function(event) {
				if (EventEmitter.listenerCount(worker, event)===0) {
					var msg = 'Unexpected Event received: ' + event;
					worker.on(event, function() { assert.fail(arguments,null, msg); });
				}
			});
	}

	it('emit the required events when the forked worker is started and then terminated', function(done) {
		var events = [];
		var worker = new _ForkedWorker(createConfig(modules.echo))
						.on('started', function(instance) {
							validateInstance(instance, worker, true);
							events.push('started');
							instance.disconnect();
						})
						.on('disconnected', function(instance) {
							validateInstance(instance, worker, false);
							events.push('disconnected');
							})
						.on('exit', function(instance, exitCode) {
							validateInstance(instance, worker, false);
							assert.strictEqual(exitCode, 0);
							assert.deepEqual(events, ['started', 'disconnected']);
							done();
						});
		validateAllowedEvents(worker);
	});
	it('emit the required events and result of the forked worker data processing', function(done) {
		var events = [];
		var myData = { a: { b: 0, c: 'sometext'} };
		var worker = new _ForkedWorker(createConfig(modules.echo))
						.on('started', function(instance) {
							validateInstance(instance, worker, true);
							assert.isTrue(instance.send(myData));
							events.push('started');
						})
						.on('data', function(instance, data) {
							validateInstance(instance, worker, true);
							assert.deepEqual(data, { echoOf: myData } );
							events.push('data');
							instance.disconnect();
						})
						.on('disconnected', function(instance) {
							validateInstance(instance, worker, false);
							assert.isFalse(instance.send(myData));
							events.push('disconnected');
							})
						.on('exit', function(instance, exitCode) {
							validateInstance(instance, worker, false);
							assert.strictEqual(exitCode, 0);
							assert.deepEqual(events, ['started', 'data', 'disconnected']);
							assert.isFalse(instance.send(myData));
							done();
						});
		validateAllowedEvents(worker);
	});
	it('emit the required events when a non fatal error occurs', function(done) {
		var events = [];
		var myData = { a: { b: 0, c: 'sometext'} };
		var worker = new _ForkedWorker(createConfig(modules.failProcessing))
						.on('started', function(instance) {
							validateInstance(instance, worker, true);
							assert.isTrue(instance.send(myData));
							events.push('started');
						})
						.on('error', function(instance, message) {
							validateInstance(instance, worker, true);
							assert.strictEqual(message, 'Fails Processing');
							events.push('error');
							instance.disconnect();
						})
						.on('disconnected', function(instance) {
							validateInstance(instance, worker, false);
							events.push('disconnected');
							})
						.on('exit', function(instance, exitCode) {
							validateInstance(instance, worker, false);
							assert.strictEqual(exitCode, 0);
							assert.deepEqual(events, ['started', 'error', 'disconnected']);
							done();
						});
		validateAllowedEvents(worker);
	});
	it('emit the required events when a fatal error occurs', function(done) {
		var events = [];
		var myData = { a: { b: 0, c: 'sometext'} };
		var worker = new _ForkedWorker(createConfig(modules.fatalProcessing))
						.on('started', function(instance) {
							validateInstance(instance, worker, true);
							assert.isTrue(instance.send(myData));
							events.push('started');
						})
						.on('error', function(instance, message) {
							validateInstance(instance, worker, true);
							assert.strictEqual(message, 'Fails Processing');
							events.push('error');
						})
						.on('disconnected', function(instance) {
							validateInstance(instance, worker, false);
							events.push('disconnected');
							})
						.on('exit', function(instance, exitCode) {
							validateInstance(instance, worker, false);
							assert.strictEqual(exitCode, 1);
							assert.deepEqual(events, ['started', 'error', 'disconnected']);
							done();
						});
		validateAllowedEvents(worker);
	});
	it('emit the required events when a fatal error occurs preventing the forked worker to start', function(done) {
		var events = [];
		var worker = new _ForkedWorker(createConfig(modules.failOnLoad))
						.on('disconnected', function(instance) {
							validateInstance(instance, worker, false);
							events.push('disconnected');
							})
						.on('exit', function(instance, exitCode) {
							validateInstance(instance, worker, false);
							assert.strictEqual(exitCode, 1);
							assert.deepEqual(events, ['disconnected']);
							done();
						});
		validateAllowedEvents(worker);
	});
	it('can terminate the forked worker before receiving the started message', function(done) {
		var events = [];
		var worker = new _ForkedWorker(createConfig(modules.echo))
						.on('disconnected', function(instance) {
							validateInstance(instance, worker, false);
							events.push('disconnected');
							})
						.on('exit', function(instance, exitCode) {
							validateInstance(instance, worker, false);
							assert.strictEqual(exitCode, 0);
							assert.deepEqual(events, ['disconnected']);
							done();
						})
						.disconnect();
		validateAllowedEvents(worker);
	});
	it('can terminate the forked worker before receiving the result of a data processing', function(done) {
		var events = [];
		var myData = { a: { b: 0, c: 'sometext'} };
		var worker = new _ForkedWorker(createConfig(modules.slowWorker))
						.on('started', function(instance) {
							validateInstance(instance, worker, true);
							assert.isTrue(instance.send(myData));
							events.push('started');
							process.nextTick(instance.disconnect.bind(instance));
						})
						.on('disconnected', function(instance) {
							validateInstance(instance, worker, false);
							events.push('disconnected');
							})
						.on('exit', function(instance, exitCode) {
							validateInstance(instance, worker, false);
							assert.strictEqual(exitCode, 0);
							assert.deepEqual(events, ['started', 'disconnected']);
							done();
						});
		validateAllowedEvents(worker);
	});
	it('will not sent data to a disconnecting worker', function(done) {
		var events = [];
		var myData = { a: { b: 0, c: 'sometext'} };
		var worker = new _ForkedWorker(createConfig(modules.slowWorker))
						.on('started', function(instance) {
							validateInstance(instance, worker, true);
							instance.disconnect();
							assert.isFalse(instance.send(myData));
							events.push('started');
						})
						.on('disconnected', function(instance) {
							validateInstance(instance, worker, false);
							events.push('disconnected');
							})
						.on('exit', function(instance, exitCode) {
							validateInstance(instance, worker, false);
							assert.strictEqual(exitCode, 0);
							assert.deepEqual(events, ['started', 'disconnected']);
							done();
						});
		validateAllowedEvents(worker);
	});
	it('enforce the uses of the new operator', function(done) {
		var worker = _ForkedWorker(createConfig(modules.echo));
		assert.instanceOf(worker, _ForkedWorker);
		worker
			.on('exit', function(instance, exitCode) {
				validateInstance(instance, worker, false);
				assert.strictEqual(exitCode, 0);
				done();
			})
			.disconnect();
	});
});