describe('Forked Workers', function() {
	var chai = require('chai');
	var assert = chai.assert;
	var path = require('path');
	var fork = require('child_process').fork;

	// our different test modules
	var modules = {
		echo: path.resolve(__dirname , './modules/Echo'),
		failProcessing: path.resolve(__dirname , './modules/FailProcessing'),
		fatalProcessing: path.resolve(__dirname , './modules/FatalProcessing'),
		failOnLoad: path.resolve(__dirname , './modules/FailOnLoad')
	};

	// default test timeout increased as we are launching new node processes.
	this.timeout(30000);

	// ensure we have a full stack trace when assertions fail
	chai.config.includeStack = true;

	//TODO: update the configuration to allow coverage of the forked processes.

	it('emit the required events when started and then terminated', function(done) {
		var events = [];
		var worker = fork(modules.echo)
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
		var worker = fork(modules.echo)
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
		var worker = fork(modules.failProcessing)
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
		var worker = fork(modules.fatalProcessing)
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
		var worker = fork(modules.failOnLoad, { silent : true })
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
});