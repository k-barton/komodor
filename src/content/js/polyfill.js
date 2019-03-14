// from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
if (!Object.entries)
	Object.entries = function(obj) {
		var ownProps = Object.keys(obj),
			i = ownProps.length,
			resArray = new Array(i); // preallocate the Array
		while (i--) resArray[i] = [ownProps[i], obj[ownProps[i]]];
		return resArray;
	};

if (!Object.values)
	Object.values = function(obj) {
		var vals = [];
		for (var key in obj)
			if (obj.hasOwnProperty(key) && obj.propertyIsEnumerable(key))
				vals.push(obj[key]);
		return vals;
	};