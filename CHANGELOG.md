#v1.0.4
-	The send method of the pool accepts a second argument in the form of a callback which will be called when the specified job has been completed instead of the listener to the ```data``` event. This callback will receive the same parameters as the listeners of the ```data``` event.
-	Update to the tests to be compatible with istanbul 0.3.21+

#v1.0.3
-	Addition of the required code to allow coverage of forked instances (istanbul implementation provided as example in the wiki).
-	Addition of a check to ensure the module path is an absolute one and exists.

#v1.0.2
-	Fix a silly issue with the ForkedWorker not accessible without referring to the lib folder.

#v1.0.0
-	Initial release
