/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/**
 * This file contains a simple synchronization method for JSON objects
 * based on the file synchronization algorithm presented by Norman
 * Ramsey and Elod Csirmaz in
 *
 *   An Algebraic Approach to File Synchronization
 *   <http://www.eecs.harvard.edu/~nr/pubs/sync-abstract.html>
 *
 *   Abstract: "We present a sound and complete proof system for
 *   reasoning about operations on filesystems. The proof system
 *   enables us to specify a file-synchronization algorithm that can
 *   be combined with several different conflict-resolution
 *   policies. By contrast, previous work builds the
 *   conflict-resolution policy into the specification, or worse, does
 *   not specify the behavior formally. We present several
 *   alternatives for conflict resolution, and we address the knotty
 *   question of timestamps."
 *
 * We map this algorithm to JSON records by giving object and array
 * values the same treatment that Ramsey and Csirmaz give file system
 * directories. For the definition of JSON, see RFC 4627.
 *
 *   <http://www.ietf.org/rfc/rfc4627.txt>
 **/

/**
 * This algorithm requires that we keep a snapshot around, such as the
 * last response from a server.
 **/

/* Implementations of MochiKit functions */
var AdapterRegistry = function () {
    this.pairs = [];
};

AdapterRegistry.prototype = {
    register: function (name, check, wrap, /* optional */ override) {
        if (override) {
            this.pairs.unshift([name, check, wrap]);
        } else {
            this.pairs.push([name, check, wrap]);
        }
    },
    
    match: function (/* ... */) {
        for (var i = 0; i < this.pairs.length; i++) {
            var pair = this.pairs[i];
            if (pair[1].apply(this, arguments)) {
                return pair[2].apply(this, arguments);
            }
        }
        throw "Match not found when trying to match in Adapter Registry";
    },

    unregister: function (name) {
        for (var i = 0; i < this.pairs.length; i++) {
            var pair = this.pairs[i];
            if (pair[0] == name) {
                this.pairs.splice(i, 1);
                return true;
            }
        }
        return false;
    }
};

var comparatorRegistry = new AdapterRegistry();

function reduce(fn, iterable, initial) {
    var i = 0;
    var x = initial;
    var count = iterable.length;
    for (i = 0; i < count; ++i)
        x = fn(x, iterable[i]);
    return x;
}

function registerComparator(name, check, comparator, /* optional */ override) {
    comparatorRegistry.register(name, check, comparator, override);
}

function compareArray(a, b) {
    var count = a.length;
    var rval = 0;
    if (count > b.length) {
        rval = 1;
        count = b.length;
    } else if (count < b.length) {
        rval = -1;
    }
    for (var i = 0; i < count; i++) {
        var cmp = compare(a[i], b[i]);
        if (cmp) {
            return cmp;
        }
    }
    return rval;
}

function isArray() {
    for (var i = 0; i < arguments.length; i++) {
        var o = arguments[i];
        var typ = typeof(o);
        if (
            (typ != 'object' && !(typ == 'function' && typeof(o.item) == 'function')) ||
                o === null ||
                typeof(o.length) != 'number' ||
                o.nodeType === 3 ||
                o.nodeType === 4
        ) {
            return false;
        }
    }
    return true;
}

function compare(a, b) 
{
    if (a == b) {
        return 0;
    }
    var aIsNull = (typeof(a) == 'undefined' || a === null);
    var bIsNull = (typeof(b) == 'undefined' || b === null);
    if (aIsNull && bIsNull) {
        return 0;
    } else if (aIsNull) {
        return -1;
    } else if (bIsNull) {
        return 1;
    }
    // bool, number, string have meaningful comparisons
    var prim = {'boolean': true, 'string': true, 'number': true};
    if (!(typeof(a) in prim && typeof(b) in prim)) {
        return comparatorRegistry.match(a, b);
    }
    if (a < b) {
        return -1;
    } else if (a > b) {
        return 1;
    }
    // These types can't be compared
    throw new TypeError(JSON.stringify(a) + " and " + JSON.stringify(b) + " can not be compared");
}

function arrayEqual(self, arr) {
    if (self.length != arr.length) {
        return false;
    }
    return (compare(self, arr) === 0);
}

function isArray(value) 
{ 
    return value && typeof value === "object" && value.constructor === Array; 
}

function _flattenArray(res, lst) {
    for (var i = 0; i < lst.length; i++) {
        var o = lst[i];
        if (isArray(o)) {
            arguments.callee(res, o);
        } else {
            res.push(o);
        }
    }
    return res;
}

function flattenArray(arr)
{
    return _flattenArray([], arr);
}

function map(fun, arr)
{
    var len = arr.length >>> 0;
    if (typeof fun != "function")
	throw new TypeError();

    var res = new Array(len);
    for (var i = 0; i < len; i++)
    {
	if (i in arr)
            res[i] = fun.call(this, arr[i], i, arr);
    }

    return res;
}

function isNull() {
    for(var i=0; i<arguments.length; i++) {
	if(arguments[i]!==null) {
	    return false;
	}
    }
    return true;
}

function filter(fn, lst, self) 
{
    return Array.prototype.filter.call(lst, fn, self);
}

function forEach(iterable, func, /* optional */obj) {
    for (var i = 0; i < iterable.length; i++) 
        func(iterable[i]);
}

function extend(self, obj, /* optional */skip) {
    // Extend an array with an array-like object starting
    // from the skip index
    if (!skip) {
        skip = 0;
    }
    if (obj) {
        // allow iterable fall-through, but skip the full isArrayLike
        // check for speed, this is called often.
        var l = obj.length;
        if (!self) {
            self = [];
        }
        for (var i = skip; i < l; i++) {
            self.push(obj[i]);
        }
    }
    // This mutates, but it's convenient to return because
    // it's often used like a constructor when turning some
    // ghetto array-like to a real array
    return self;
}

function partial()
{
    var argArray = Array.prototype.slice.call(arguments),
    fn = argArray[0],
    args = argArray.slice(1);
    return function() {
	return fn.apply(this, args.concat(Array.prototype.slice.call(arguments)));
    };
}

function keys(obj)
{
    var array = [];
    for ( var prop in obj ) {
	if ( obj.hasOwnProperty( prop ) ) {
	    array.push( prop );
	}
    }
    return array;
}

function findValue(lst, value, start/* = 0 */, /* optional */end) {
    if (typeof(end) == "undefined" || end === null) {
        end = lst.length;
    }
    if (typeof(start) == "undefined" || start === null) {
        start = 0;
    }
    for (var i = start; i < end; i++) {
        if (compare(lst[i], value) === 0) {
            return i;
        }
    }
    return -1;
}

registerComparator("Array", isArray, compareArray);
registerComparator("CommandComparator", 
		   function areCommands(a, b) {
		       return (a instanceof Command && b instanceof Command)
		   },
		   function compareCommands(a, b) { return a.equals(b) ? 0 : -1; }
		  );

/* End MochiKit function implementations */

/*
  var snapshotJSON =
  {
  "x": 42,
  "a": 1,
  "b":
  {
  "c": 2,
  "d":
  {
  "e": 3,
  "f": 4
  },
  "g": 5
  },
  "h": 6.6,
  "i": [7, 8, 9],
  "j": 10,
  "k": { "m": 11 },
  "n": 66,
  }

  * After local updates have occured, the JSON object will have
  * changed. Our algorithm determines a sequence of updates to the
  * snapshot that result in an object approximating the current
  * state. We can perform this detection without logging each change by
  * ignoring sequences deemed to be insignificant. For example, the
  * field "x" with value 42 could be deleted and subsequently added
  * with a value of 43. Our algorithm will not track these changes.
  * The key is present in both JSON objects, so the change will be
  * represented as an edit.

  var currentJSON =
  {
  "x": 43,             edited
  "a": 1,
  "new": 11,           created
  "b":
  {
  "c": 2,
  "new2": 22,        created
  "d":
  {
  "e": 3,
  /*"f": 4       removed
  },
  "g": 55,           edited  
  },
  /* "h": 6.6,           removed    
  "i": [7, 8, 9, 99],   added array element 
  "j": 10,
  "k": 42,              replaced object with primitive 
  "n": { "new3": 77 },  replaced primitive with object 
  }
*/
/**
 * function detectUpdates(snapshot, current)
 *
 * @param  snapshot
 *         An old version of the object.
 *
 * @param  current
 *         The current version of the object.
 *
 * @return An array of change operations.
 *
 * Ramsey and Csirmaz characterize all changes to the tree in terms of
 * three operations:
 *
 *   1.) create
 *   2.) remove
 *   3.) edit
 *  
 * We need to determine which changes have occured, and sequence them
 * such that the object is never in an incoherent state.
 *
 *   { "foo": 1, "bar": { "baz": 42 }}
 *
 * For example, we must avoid a sequence that calls for a deletion of
 * "bar" followed by an edit to "baz".
 *
 * A path syntax is useful to express the locations of changes, and
 * maps relatively cleanly to URIs. We express keys as path segments,
 * with arrays implying numeric path segments for their members. Keys
 * with objects or arrays as values have a "/" path separator
 * appended. Given an object
 *
 *   {
 *     "foo": 1,
 *     "bar":
 *      {
 *        "baz": 42,
 *        "qux": [43, 44, 45, 46]
 *      }
 *   }
 *
 * the following paths map to these values
 * 
 *   /foo       => 1
 *   /bar/baz   => 42
 *   /bar/qux/2 => 45
 *
 * In the JSON sync algorithm, Ramsey and Csirmaz's directories
 * correspond to objects and arrays, while their files correspond to
 * primitive JSON values such as strings and integers.
 *
 * The function isObjectOrArray() is used to distinguish between the
 * two cases.
 */

function isObjectOrArray(x) {
    return !isNull(x) && typeof(x) == "object";
}

/**
 * As an object pair is scanned, we can safely ignore keys that are
 * present in both objects that also share identical primitive
 * values. The function identifySuspects() returns a list of keys that
 * warrant further inspection.
 **/
function identifySuspects(snapshot, current) {
    /**
     * First, the union of both objects' keys must be calculated. This
     * code is suboptimal if both arguments are arrays, since we could
     * simply run keys() on the longer of the two in that case.
     **/
    var keySet = {}
    forEach(extend(keys(snapshot), keys(current)),
	    function(key) { keySet[key] = true }); 
    /**
     * Using the keys present in one or both objects, filter out those
     * that are present with identical primitive values.
     **/
    return filter(function(key) { 
        return (isObjectOrArray(snapshot[key]) ||
	        isObjectOrArray(current[key]) ||
	        snapshot[key] !== current[key]);
    }, keys(keySet));
}

/**
 * We use Command objects to represent operations performed
 * on each replica.
 **/
function Command(action, path, value) {
    this.action = action;
    this.path = path;
    this.value = value;
}
Command.prototype = {
    equals: function(other) {
	return (other && other.action == this.action && 
		arrayEqual(this.path, other.path) &&
		(isObjectOrArray(other.value) && isObjectOrArray(this.value) ?
		 other.value.constructor == this.value.constructor :
		 other.value === this.value));
    },
    /**
     * Check whether the other command's path starts with our path.
     **/
    isParentOf: function(other) {
	return other.path.length > this.path.length &&
            arrayEqual(other.path.slice(0, this.path.length), this.path);
    }
}

/**
 * Objects need to be created in preorder (before their child nodes),
 * to avoid a disconnected tree.
 **/
function created(path, value) {
    if (isObjectOrArray(value)) {
	/* object created. Prepend the creation record to its children */
	return extend([new Command("create", path, value.constructor())],
                      _detectUpdates(path, {}, value));
    }

    /* primitive created */
    return [new Command("create", path, value)];
}

/**
 * Objects need to be removed in postorder (after their child nodes),
 * to avoid a disconnected graph. This is the same way "rm -rf" works.
 **/
function removed(path, value) {
    if (isObjectOrArray(value)) {
	/* Object removed. Append the removal record to its children. */
	return extend(_detectUpdates(path, value, {}),
                      [new Command("remove", path)]);
    }
    
    /* primitive removed */
    return [new Command("remove", path)];
}

/**
 * Some edit operations are more complicated than they first
 * appear. In particular, we want to recurse into object values where
 * the key was previously a primitive. This approach provides us with
 * a detailed creation log, and allows us to reconcile more JSON
 * graphs, because it provides a detailed log of the created children
 * of the new object.
 **/
function edited(path, old, update) {
    if (isObjectOrArray(old) && !isObjectOrArray(update)) {
	/* object replaced by primitive */
	return extend([new Command("edit", path, update)],
                      _detectUpdates(path, old, {}));
    } else if (!isObjectOrArray(old) && isObjectOrArray(update)) {
	/* primitive replaced by object */
	return extend([new Command("edit", path, update.constructor())],
                      _detectUpdates(path, {}, update));
    }
    
    /* primitive edit */
    return [new Command("edit", path, update)];   
}


function _detectUpdates(stack, snapshot, current) {
    /* check for edits and recurse into objects and arrays */
    return flattenArray(map(
	function (key) {
	    var old = snapshot[key];
	    var update = current[key];
	    var path = stack.concat([key]);

	    /* create */
	    if (typeof(old) == "undefined")
		return created(path, update);

	    /* remove */
	    if (typeof(update) == "undefined")
		return removed(path, old);

	    /* edit */
	    if (!isObjectOrArray(old) || !isObjectOrArray(update))
		return edited(path, old, update);

	    /* recurse into object/array values at the same path */
	    /** 
	     * We need to detect container type changes. This type of edit
	     * changes the algebra described by Ramsey and Csirmaz a bit,
	     * because it imposes additional ordering constraints on the
	     * update sequence, which complicates the algorithm, but it
	     * seems worth it to avoid profiling JSON.
	     *
	     * When an object's type changes at a path π, we want to reverse
	     * the normal order of operations that Ramsey and Csirmaz give,
	     * because we assume that a deletion of all of the array's
	     * elements preceded the change from array to object. This
	     * assumption does prevent key preservation across non-idiomatic
	     * transformations between Object and Array types.
	     *
	     *  remove(π/π')
	     *  removeObj(π, Array(m))
	     *  createObj(π, Object(m))
	     *  create(π/π')
	     *
	     * In otherwords, when an Array at path π is changed to an
	     * Object, that implies a recursive deletion of all its
	     * children, a removal of an Array at path π, a creation of an
	     * Object at path π, and recursive creation of the Object's
	     * members. This means we have to interleave creates and
	     * removes, unlike Ramsey and Csirmaz.
	     * 
	     **/

	    ///XXX change this to recurse and return
	    var changeSequence = [];
	    if (old.constructor != update.constructor) {
		changeSequence.push(new Command("edit", path, update.constructor()));
	    }

	    /**
	     * Now we recurse into objects and arrays, and append
	     * the current key to our path stack.
	     **/
	    return extend(changeSequence,
			  _detectUpdates(path, old, update));
            
	}, identifySuspects(snapshot, current)));
}

/**
 * function orderUpdates(updates)
 *
 * @param  updates
 *         An array of produced by detectUpdates.
 *
 * @return An array of change operations in the canonical order.
 *
 * Once we have our updates, we'll need to order the records in the
 * canonical sequence described by Ramsey and Csirmaz for path π:
 *
 * (a) Commands of the form edit (π, Dir(m)), in any order determined
 *     by π.
 * (b) Commands of the form create (π, X), in preorder. 
 * (c) Commands of the form remove (π), in postorder. 
 * (d) Commands of the form edit (π, File(m, x)), in any order
 *     determined by π.
 *
 **/
function orderUpdates(updates) {
    var dirEdits = [];
    var creates = [];
    var removes = [];
    var edits = [];
    
    /** 
     *  _detectUpdates orders creates and removes canonically, so we
     *  just need to weed out the edits.
     **/
    forEach(updates, function(update) {
	if (update.action == "edit")
	    isObjectOrArray(value) ? dirEdits.push(update) : edits.push(update);
	else if (update.action == "create")
	    creates.push(update);
	else if (update.action == "remove")
	    removes.push(update);
    });
    
    return chain(dirEdits, creates, removes, edits);
}


/**
 * 
 *
 * Excerpt from Ramsey and Csirmaz:
 *
 *    The reconciler takes the sequences S1 , ... , Sn that are
 *    computed to have been performed at each replica. It com- putes
 *    sequences S ∗ 1 , ... , S ∗ n that make the filesystems as close
 *    as possible. The idea of the algorithm is that a command C ∈
 *    Si should be propagated to replica j (included ∗ in Sj ) iff
 *    three criteria are met:
 *
 *      * C ∈ Sj , i.e., C has not already been performed at
 *        replica j
 *
 *      * no commands at replicas other than i conflict with C
 *
 *      * no commands at replicas other than i conflict with commands
 *        that must precede C
 *
 *    A command C must precede command C iff they appear in the same
 *    sequence Si , C precedes C in Si , and they do not commute (C ;
 *    C C; C ).
 *
 **/

/**
 * function commandInList(command, commands)
 *
 * Check whether a command appears in a list of commands, so we can
 * tell if a command has already been performed at a replica.
 *
 **/

function commandInList(command, commands) {
    return (findValue(commands, command) != -1);
}

/**
 * Now we find commands with paths that are of interest, make sure
 * it's not the same command, and then check to see if it's a break.
 * 
 * function conflictsFromReplicas(command, commandListsFromOtherReplicas)
 *
 * @param  command 
 *         A Command object.
 *
 * @param  commandListsFromOtherReplicas
 *         A list of command lists from other replicas ([[],[],[]])
 *
 * @return A list of objects conforming to the interface:
 *         {
 *           command: Command
 *           conflicts: [Command, Command, Command...]
 *           commandList: [Command, Command, Command...]
 *         }
 *  
 **/

/**
 * Check whether an edit or create operation has been attempted under
 * a remove.
 **/ 
function isBreak(a, b) {
    return a.isParentOf(b) && 
        ((!isObjectOrArray(a.value) || a.action == "remove") &&
         b.action != "remove");
}

/**
 * Check whether the commands would result in a broken graph,
 * or whether they are attempting to insert the different values
 * at the same path.
 **/
function doesConflict(command, other) {
    var broken = isBreak(command, other) || isBreak(other, command); 
    return broken || (arrayEqual(command.path, other.path)
                      && !command.equals(other));
}

function conflictsFromReplica(command, commandList) {
    return {
	"command": command,
	"conflicts": filter(partial(doesConflict, command), commandList),
	"commandList": commandList
    };
}

function conflictsFromReplicas(command, commandListsFromOtherReplicas) {
    return map(partial(conflictsFromReplica, command),
               commandListsFromOtherReplicas);
}

/**
 * If a command doesn't conflict, we still might have to put it in the 
 * conflict list if an earlier command did conflict, and that command
 * is a precondition for the current command.
 **/
function mustPrecede(command, earlierCommand) {  
    if (earlierCommand.action == "edit")
	return false;

    return earlierCommand.isParentOf(command);
}

function precedingCommandsConflict(command, conflictList) {
    if (isEmpty(conflictList))
	return false;
    if (some(conflictList, partial(mustPrecede, command))) {
	return true;
    }
    return false;
}

function reconcile(commandLists) {
    var propagations = [];
    var conflicts = [];

    forEach(commandLists, function() {
	propagations.push([]);
	conflicts.push([]);
    });

    for (var i = 0; i < commandLists.length; ++i) {
	for (var j = 0; j < commandLists.length; ++j) {
	    if (i != j) {
		forEach(commandLists[i],
			function (command) {
			    if (!commandInList(command, commandLists[j])) {
				var others = chain(commandLists.slice(0, i), 
						   commandLists.slice(i + 1));
				var conflict = conflictsFromReplicas(command, others);
				if (every(conflict, function(c) { return c.conflicts.length == 0 })) {
				    if (precedingCommandsConflict(command, conflicts[j])) {
					conflicts[j].push(command);
				    } else {
					propagations[j].push(command);
				    }
				} else {
				    conflicts[j].push(command);
				}
			    }
			}
		       );
	    }
	}
    }
    
    return {"propagations":propagations, "conflicts":conflicts};
}

/**
 * Map a path array to an object reference, such that [foo, bar, baz]
 * becomes a reference to the value at obj[foo][bar][baz].
 **/
function pathToReference(obj, path) {
    return reduce(function (reference, segment) {
        return reference ? reference[segment] : reference;
    }, 
                  path, obj);
}

/**
 * Apply a single command to an object.
 **/
function applyCommand(target, command) {  
    var container =
	pathToReference(target, command.path.slice(0, command.path.length - 1));

    if (command.action == "remove")
	delete container[command.path[command.path.length - 1]];
    
    container[command.path[command.path.length - 1]] = command.value;
}

/**
 * Apply a list of commands to an object.
 **/
function applyCommands(target, commands) {
    forEach(commands, partial(applyCommand, target));
}

/**
 * Now we define a more traditional OO api to wrap this functionality.
 * 
 * @param identifiers 
 *        A string or array of strings for the synchronizer to identify 
 *        fields to be used as a identifiers.
 * 
 * @param onConflict
 *        A function that will be called when a conflict arises.
 *
 * @param onPropagate
 *        A function that will be called when a propagation arises. 
 **/
function Synchronizer(ids, onConflict, onPropagate) {
    this.identifiers = isObjectorArray(ids) ? ids : [ids];
    this.onConflict = onConflict;
    this.onPropagate = onPropagate;
}

Synchronizer.prototype = {
    /**
     * Synchronize JSON objects.
     *
     * @param snapshot
     *        A common baseline JSON object to work from.
     *
     * @param jsonObjects
     *        An array of JSON objects to sync, all of which are derived
     *        from the common baseline.
     **/
    sync: function(snapshot, jsonObjects) {
	
    }
}

exports.detectUpdates = partial(_detectUpdates, []);
exports.isObjectOrArray = isObjectOrArray;
exports.identifySuspects = identifySuspects;
exports.orderUpdates = orderUpdates;
exports.Command = Command;
exports.created = created;
exports.removed = removed;
exports.edited = edited;
exports.orderUpdates = orderUpdates;
exports.commandInList = commandInList;
exports.doesConflict = doesConflict;
exports.conflictsFromReplica = conflictsFromReplica;
exports.conflictsFromReplicas = conflictsFromReplicas;
exports.reconcile = reconcile;
exports.pathToReference = pathToReference;
exports.applyCommand = applyCommand;
exports.applyCommands = applyCommands;
exports.findValue = findValue;