var sync = require('./sync');

module.exports = {
    'test isObjetOrArray' : function(assert) {
	assert.equal(sync.isObjectOrArray({}), true);
	assert.equal(sync.isObjectOrArray([]), true);
	assert.equal(sync.isObjectOrArray("foo"), false);
	assert.equal(sync.isObjectOrArray(4), false);
	assert.equal(sync.isObjectOrArray(5.5), false);
	assert.equal(sync.isObjectOrArray(undefined), false);
	assert.equal(sync.isObjectOrArray(null), false);
    },
    'test identifySuspects' : function(assert) {
	var suspects = sync.identifySuspects({"a": 1, "b": 2, "c": 3, "d": "hmm"},
					     {"a": 1, "b": 2, "c": 3, "d": "hmm"});
	assert.equal(suspects.length, 0);
	suspects = sync.identifySuspects({"a": 1, "b": 2, "c": 3, "d": "hmm"},
					 {"a": 1, "b": 3, "c": 3, "d": "hmm"});
	assert.equal(suspects.length, 1);
	suspects = sync.identifySuspects({"a": 1, "b": {}, "c": 3, "d": "hmm"},
					 {"a": 1, "b": {}, "c": 3, "d": "hmm"});
	assert.equal(suspects.length, 1);
	suspects = sync.identifySuspects({"a": 1, "b": 2, "c": 3, "d": "hmm"},
					 {"a": "1", "b": 2, "c": 3, "d": "hmm"});
	assert.equal(suspects.length, 1);
	suspects = sync.identifySuspects({"a": 1, "b": 2, "c": 3, "d": "hmmm"},
					 {"a": 1, "b": 2, "c": 3, "d": "hmm"});
	assert.equal(suspects.length, 1);
	suspects = sync.identifySuspects({"xxx": 1, "b": 2, "c": 3, "d": "hmm"},
					 {"yyy": 1, "b": 2, "c": 3, "d": "hmm"});
	assert.equal(suspects.length, 2);
	suspects = sync.identifySuspects({"0": 1, "b": 2, "c": 3, "d": "hmm"},
					 {0: 1, "b": 2, "c": 3, "d": "hmm"});
	assert.equal(suspects.length, 0);
    },
    'test created' : function(assert) {
	var record = sync.created(["foo"], {});
	assert.equal(record.length, 1);
	record = sync.created(["foo"], 1);
	assert.equal(record.length, 1);
	record = sync.created(["foo"], {"bar":"baz"});
	assert.equal(record.length, 2);
	record = sync.created(["foo"], {"bar":"baz", "qux":"baz"});
	assert.equal(record.length, 3);
	assert.equal(record[0].action, "create");
	assert.equal(record[0].path.length, 1);
	assert.equal(record[1].path.length, 2);
	assert.equal(record[1].value, "baz");
	assert.equal(record[2].path.length, 2);
	assert.equal(record[2].value, "baz");
    },
    'test removed' : function(assert) {
	var record = sync.removed(["foo"], {});
	assert.equal(record.length, 1);
	record = sync.removed(["foo"], 1);
	assert.equal(record.length, 1);
	record = sync.removed(["foo"], {"bar":"baz"});
	assert.equal(record.length, 2);
	record = sync.removed(["foo"], {"bar":"baz", "qux":"baz"});
	assert.equal(record.length, 3);
	assert.equal(record[0].action, "remove");
	assert.equal(record[0].path.length, 2);
	assert.equal(record[1].path.length, 2);
	assert.equal(record[2].path.length, 1);
    },
    'test edited' : function(assert) {
	var record = sync.edited(["foo"], 5, 3);
	assert.equal(record.length, 1);
	assert.equal(record[0].action, "edit");
	assert.equal(record[0].value, 3);
	assert.equal(record[0].path.length, 1);
	record = sync.edited(["foo"], {"bar": "baz"}, 3);
	assert.equal(record.length, 2);
	assert.equal(record[0].action, "edit");
	assert.equal(record[1].action, "remove");
	record = sync.edited(["foo"], 3, {"bar": "baz"});
	assert.equal(record.length, 2);
	assert.equal(record[0].action, "edit");
	assert.equal(record[1].action, "create");
    },
    'test detectUpdates' : function(assert) {
	var snap =     { "foo": 1, "bar": 1, "baz": 1, "qux": 1 }; 
	var replica1 = { "foo": 0, "bar": 1, "baz": 1, "qux": 1 }; 
	var replica2 = { "foo": 1, "bar": 0, "baz": 1, "qux": 1 }; 
	var replica3 = { "foo": 1, "bar": 1, "baz": 0, "qux": 1 }; 
	var replica4 = { "foo": 1, "bar": 1, "baz": 1, "qux": 0 };
	
	function checkReplica(name, replica) {
	    var updateList = sync.detectUpdates(snap, replica);
	    assert.equal(updateList.length, 1);
	    assert.equal(updateList[0].action, "edit");
	    assert.equal(updateList[0].value, 0);
	}
	checkReplica("replica1", replica1);
	checkReplica("replica2", replica2);
	checkReplica("replica3", replica3);
	checkReplica("replica4", replica4);
    },
    'test applyCommand to edit an object' : function(assert) {
	var c = new sync.Command("edit", ["foo"], "bar");
	var target = {foo: "qux"};
	sync.applyCommand(target, c);
	assert.equal(target.foo, "bar");
	var newCommand = new sync.Command("edit", ["foo", {"id" : 3}, "name"], "test");
	var newTarget = {foo : [{"id" : 1,
				 "name" : "one"},
				{"id" : 2,
				 "name" : "two"},
				{"id" : 3,
				 "name" : "three"},
				{"id" : 4,
				 "name" : "four"}]
			};
	sync.applyCommand(newTarget, newCommand);
	assert.equal(newTarget.foo[0].name, "one");
	assert.equal(newTarget.foo[1].name, "two");
	assert.equal(newTarget.foo[2].name, "test");
	assert.equal(newTarget.foo[3].name, "four");
    },
    'test applyCommand on non-existent object' : function(assert) {
	var newCommand = new sync.Command("edit", ["foo", {"id" : 6}, "name"], "test");
	var newTarget = {foo : [{"id" : 1,
				 "name" : "one"},
				{"id" : 2,
				 "name" : "two"},
				{"id" : 3,
				 "name" : "three"},
				{"id" : 4,
				 "name" : "four"}]
			};
	sync.applyCommand(newTarget, newCommand);
	assert.equal(newTarget.foo[0].name, "one");
	assert.equal(newTarget.foo[1].name, "two");
	assert.equal(newTarget.foo[2].name, "three");
	assert.equal(newTarget.foo[3].name, "four");

	var newCommand = new sync.Command("delete", ["foo", {"id" : 6}]);
	var newTarget = {foo : [{"id" : 1,
				 "name" : "one"},
				{"id" : 2,
				 "name" : "two"}]
			};
	sync.applyCommand(newTarget, newCommand);
	assert.equal(newTarget.foo[0].name, "one");
	assert.equal(newTarget.foo[1].name, "two");

	var newCommand = new sync.Command("create", ["foo", {"id" : 5}, "objects", 3], {"id" : 9, "name" : "new"});
	var newTarget = {foo : [{"id" : 1,
				 "name" : "one"},
				{"id" : 2,
				 "name" : "two"}]
			};
	sync.applyCommand(newTarget, newCommand);
	assert.equal(newTarget.foo[0].name, "one");
	assert.equal(newTarget.foo[1].name, "two");
	assert.equal(newTarget.foo.length, 2);
    },
    'test applyCommand to create an object past the end of the paths array bounds' : function(assert) {
	var newCommand = new sync.Command("create", ["foo", {"id" : 2}, "objects", 3], {"id" : 9, "name" : "new"});
	var newTarget = {foo : [{"id" : 1,
				 "name" : "one"},
				{"id" : 2,
				 "objects" : [{"id" : 8, "name" : "eight"},
					      {"id" : 10, "name" : "ten"}]}]
			};
	sync.applyCommand(newTarget, newCommand);
	assert.equal(newTarget.foo[1].objects[2].name, "new");
	assert.equal(newTarget.foo[1].objects[2].id, 9);
    },
//     'test applyCommand to delete an object' : function(assert) {
// 	var newCommand = new sync.Command("delete", ["foo", {"id" : 1}]);
// 	var newTarget = {foo : [{"id" : 1,
// 				 "name" : "one"},
// 				{"id" : 2,
// 				 "name" : "two"}]
// 			};
// 	sync.applyCommand(newTarget, newCommand);
// 	assert.equal(newTarget.foo.length, 1);
// 	assert.equal(newTarget.foo[0].name, "two");

//     }
    'test applyCommand to create an object in the middle of the paths array' : function(assert) {
	var newCommand = new sync.Command("create", ["foo", {"id" : 2}, "objects", 1], {"id" : 9, "name" : "new"});
	var newTarget = {foo : [{"id" : 1,
				 "name" : "one"},
				{"id" : 2,
				 "objects" : [{"id" : 8, "name" : "eight"},
					      {"id" : 10, "name" : "ten"}]}]
			};
	sync.applyCommand(newTarget, newCommand);
	assert.equal(newTarget.foo[1].objects[0].id, 8);
	assert.equal(newTarget.foo[1].objects[1].id, 9);
	assert.equal(newTarget.foo[1].objects[2].id, 10);

    },
    'test applyCommand with a move' : function(assert) {
	var newCommand = new sync.Command("move", ["foo", {"id" : 1}], ["foo", {"id" : 2}, "objects", 1]);
	var newTarget = {foo : [{"id" : 1,
				 "name" : "one"},
				{"id" : 2,
				 "objects" : [{"id" : 8, "name" : "eight"},
					      {"id" : 10, "name" : "ten"}]}]
			};
	sync.applyCommand(newTarget, newCommand);
	assert.equal(newTarget.foo.length, 1);
	assert.equal(newTarget.foo[0].objects[0].id, 8);
	assert.equal(newTarget.foo[0].objects[1].id, 1);
	assert.equal(newTarget.foo[0].objects[2].id, 10);
    },
    
    'test applyCommand on an object that has moved' : function(assert) {
	var newCommand = new sync.Command("edit", ["foo", {"id" : 6}, "name"], "test");
	var newTarget = {foo : [{"id" : 1,
				 "name" : "one"},
				{"id" : 2,
				 "name" : "two"},
				{"id" : 3,
				 "name" : "three"},
				{"id" : 4,
				 "name" : "four"},
				{"id" : 5,
				 "objects" : [{"id" : 8,
					       "name" : "eight"},
					      {"id" : 6,
					       "name" : "hello"}]}]
			};
	sync.applyCommand(newTarget, newCommand);
	assert.equal(newTarget.foo[0].name, "one");
	assert.equal(newTarget.foo[1].name, "two");
	assert.equal(newTarget.foo[2].name, "three");
	assert.equal(newTarget.foo[3].name, "four");
	assert.equal(newTarget.foo[4].objects[1].name, "hello");
    },

    'test that applyCommands does not mutate the commands' : function(assert) {
	var commands = [new sync.Command("create", ["foo", 0], {"id" : 1, "objects" : []}),
			new sync.Command("create", ["foo", {"id" : 1}, "objects", 0], 5)];
	var target = {"foo" : []};
	sync.applyCommands(target, commands);
	assert.equal(target.foo[0].id, 1);
	assert.equal(target.foo[0].objects[0], 5);
	assert.equal(commands[0].value.objects.length, 0);
    }
    
};



