describe('Forked Workers', function() {
	var chai = require('chai');
	var assert = chai.assert;
	var path = require('path');
	var fork = require('child_process').fork;

	// our different test modules
	var modules = {
		echo: path.resolve(__dirname , './modules/Echo.js'),
		failProcessing: path.resolve(__dirname , './modules/FailProcessing.js'),
		fatalProcessing: path.resolve(__dirname , './modules/FatalProcessing.js'),
		failOnLoad: path.resolve(__dirname , './modules/FailOnLoad.js'),
		enforceNew: path.resolve(__dirname, './modules/EnforceNew.js')
	};

	// default test timeout increased as we are launching new node processes.
	this.timeout(30000);

	// ensure we have a full stack trace when assertions fail
	chai.config.includeStack = true;

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

	it('emit the required events when started and then terminated', function(done) {
		var events = [];
		var config = createConfig(modules.echo);
		var worker = fork(config.path, config.args, config.options)
						.on('message', function(message) {
							assert.deepEqual(message, { event: 'started', instanceId: worker.pid });
							assert.isTrue(worker.connected);
							events.push('started');
							worker.disconnect();
						})
						.on('disconnect', function() {
							assert.isFalse(worker.connected);
							events.push('disconnect');
							})
						.on('exit', function(exitCode) {
							assert.strictEqual(exitCode, 0);
							assert.isFalse(worker.connected);
							assert.deepEqual(events, ['started', 'disconnect']);
							done();
						});
	});
	it('emit the required events and results of their data processing', function(done) {
		var events = [];
		var myData = { a: { b: 0, c: 'sometext'} };
		var config = createConfig(modules.echo);
		var worker = fork(config.path, config.args, config.options)
						.on('message', function(message) {
							if (message.event==='started') {
								assert.deepEqual(message, { event: message.event, instanceId: worker.pid });	
								assert.isTrue(worker.connected);
								events.push(message.event);
								worker.send({ event: 'data', data: myData });
							} else if (message.event==='data') {
								assert.deepEqual(message, { event: message.event, instanceId: worker.pid, data: { echoOf: myData } });
								assert.isTrue(worker.connected);
								events.push(message.event);
								worker.disconnect();
							} else {
								assert.fail(message, null, 'Unknown message received');
							}
						})
						.on('disconnect', function() {
							assert.isFalse(worker.connected);
							events.push('disconnect');
							})
						.on('exit', function(exitCode) {
							assert.strictEqual(exitCode, 0);
							assert.isFalse(worker.connected);
							assert.deepEqual(events, ['started', 'data', 'disconnect']);
							done();
						});
	});
	it('emit the required events when a non fatal error occurs', function(done) {
		var events = [];
		var myData = { a: { b: 0, c: 'sometext'} };
		var config = createConfig(modules.failProcessing);
		var worker = fork(config.path, config.args, config.options)
						.on('message', function(message) {
							if (message.event==='started') {
								assert.deepEqual(message, { event: message.event, instanceId: worker.pid });	
								assert.isTrue(worker.connected);
								events.push(message.event);
								worker.send({ event: 'data', data: myData });
							} else if (message.event==='error') {
								assert.deepEqual(message, { event: message.event, instanceId: worker.pid, data: 'Fails Processing' });	
								assert.isTrue(worker.connected);
								events.push(message.event);
								worker.disconnect();
							} else {
								assert.fail(message, null, 'unknown message received');
							}
						})
						.on('disconnect', function() {
							assert.isFalse(worker.connected);
							events.push('disconnect');
							})
						.on('exit', function(exitCode) {
							assert.strictEqual(exitCode, 0);
							assert.isFalse(worker.connected);
							assert.deepEqual(events, ['started', 'error', 'disconnect']);
							done();
						});
	});
	it('emit the required events when a fatal error occurs', function(done) {
		var events = [];
		var myData = { a: { b: 0, c: 'sometext'} };
		var config = createConfig(modules.fatalProcessing);
		var worker = fork(config.path, config.args, config.options)
						.on('message', function(message) {
							if (message.event==='started') {
								assert.deepEqual(message, { event: message.event, instanceId: worker.pid });	
								assert.isTrue(worker.connected);
								events.push(message.event);
								worker.send({ event: 'data', data: myData });
							} else if (message.event==='error') {
								assert.deepEqual(message, { event: message.event, instanceId: worker.pid, data: 'Fails Processing' });	
								assert.isTrue(worker.connected);
								events.push(message.event);
							} else {
								assert.fail(message, null, 'unknown message received');
							}
						})
						.on('disconnect', function() {
							assert.isFalse(worker.connected);
							events.push('disconnect');
							})
						.on('exit', function(exitCode) {
							assert.strictEqual(exitCode, 1);
							assert.isFalse(worker.connected);
							assert.deepEqual(events, ['started', 'error', 'disconnect']);
							done();
						});
	});
	it('emit the required events when a fatal error occurs preventing them to start', function(done) {
		var events = [];
		var config = createConfig(modules.failOnLoad);
		var worker = fork(config.path, config.args, config.options)
						.on('error', function() {
							assert.fail(arguments,null,'error should not have been emitted');
						})
						.on('message', function() {
							assert.fail(arguments,null,'message should not have been emitted');
						})
						.on('disconnect', function() {
							assert.isFalse(worker.connected);
							events.push('disconnect');
							})
						.on('exit',
							function(exitCode) {
								assert.strictEqual(exitCode, 1);
								assert.isFalse(worker.connected);
								assert.deepEqual(events, ['disconnect']);
								done();
						});
	});
	it('enforce the uses of the new operator', function(done) {
		var events = [];
		var config = createConfig(modules.enforceNew);
		var worker = fork(config.path, config.args, config.options)
						.on('message', function(message) {
							assert.deepEqual(message, { event: 'started', instanceId: worker.pid });
							assert.isTrue(worker.connected);
							events.push('started');
							worker.disconnect();
						})
						.on('disconnect', function() {
							assert.isFalse(worker.connected);
							events.push('disconnect');
							})
						.on('exit', function(exitCode) {
							assert.strictEqual(exitCode, 0);
							assert.isFalse(worker.connected);
							assert.deepEqual(events, ['started', 'disconnect']);
							done();
						});
	});
});