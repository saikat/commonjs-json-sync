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
    'test applyCommand' : function(assert) {
	var c = new sync.Command("edit", ["foo"], "bar");
	var target = {foo: "qux"};
	sync.applyCommand(target, c);
	assert.equal(target.foo, "bar");
    }
};



