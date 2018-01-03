/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  Copyright (c) 2011-2017 Kamil Barton
 *  Copyright (c) 2008-2011 Romain Francois and Kamil Barton
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */

// Define the 'sv.array' namespace
let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
        .getService(Components.interfaces.nsIWindowMediator);
let w = wm.getMostRecentWindow("Komodo");
if (typeof w.sv === 'undefined') w.sv = {};
var sv = w.sv;


if (typeof(sv.array) == 'undefined') sv.array = {};


sv.array.contains = function array_contains (arr, s) (arr.indexOf(s) !== -1);

sv.array.unique = function array_unique(arr)
	arr.reduce(function(a, j) {
		if(a.indexOf(j)==-1) a.push(j);
		return a;
    }, []);

sv.array.remove = function array_remove(arr, item) arr.filter(function(x) x !== item);

sv.array.duplicates = function array_duplicates(arr) {
	var dup = [];
	arr.forEach(function(el, i, a) {
		if(i > 0 && a.lastIndexOf(el, i - 1) != -1) dup.push(el);
    });
	return dup;
};
