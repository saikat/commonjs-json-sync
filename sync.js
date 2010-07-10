/* Some helper functions */
function reduce(fn, iterable, initial) {
    var i = 0;
    var x = initial;
    var count = iterable.length;
    for (i = 0; i < count; ++i)
        x = fn(x, iterable[i]);
    return x;
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

function isObjectOrArray(x) {
    return !isNull(x) && typeof(x) == "object";
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

function forEach(iterable, func, /* optional */obj) {
    for (var i = 0; i < iterable.length; i++) 
        func(iterable[i]);
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

function filter(fn, lst, self) 
{
    return Array.prototype.filter.call(lst, fn, self);
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

/**
 * We use Command objects to represent operations performed
 * on each replica.
 **/
function Command(action, path, value) {
    this.action = action;
    this.path = path;
    this.value = value;
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
 * Map a path array to an object reference, such that [foo, bar, baz]
 * becomes a reference to the value at obj[foo][bar][baz].
 **/
function pathToReference(obj, path) {
    return reduce(function (reference, segment) {
	if (reference) {
	    if (typeof segment === "object" && segment.hasOwnProperty("id")) {
		var count = reference.length,
		obj = null;
		while (count--)
		    if (reference[count].id === segment.id)
			return reference[count];
		
		return null;
	    }
	    else
		return reference[segment];
	}
	else
	    return reference;
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
applyCommands = function(target, commands) {
    forEach(commands, partial(applyCommand, target));
}

detectUpdates = partial(_detectUpdates, []);

if (typeof(exports) != "undefined") {
    exports.detectUpdates = detectUpdates;
    exports.applyCommands = applyCommands;

    // TODO These shouldn't be getting exported, but they are so that I can test them
    exports.isObjectOrArray = isObjectOrArray;
    exports.identifySuspects = identifySuspects;
    exports.created = created;
    exports.removed = removed;
    exports.edited = edited;
    exports.Command = Command;
    exports.applyCommand = applyCommand;
    exports.applyCommands = applyCommands;
}
