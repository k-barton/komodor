// SciViews-K array functions
// Various functions to manipulate arrays, 'sv.array' namespace'
// Copyright (c) 2008-2011, Romain Francois and Kamil Barton
// License: MPL 1.1/GPL 2.0/LGPL 2.1
////////////////////////////////////////////////////////////////////////////////
// sv.array.remove(a, s);     // Eliminate 's' from 'a'
// sv.array.contains(a, s);   // Does array 'a' contain 's'
// sv.array.removeItem(a, s); // this function is removed now - use splice
// 									// instead
//
// Additional methods to Array objects /////////////////////////////////////////
// Adding to Array.prototype has REALLY strange side effects. No idea why.

// Define the 'sv.array' namespace
if (typeof(sv) == 'undefined') sv = {};
if (typeof(sv) == 'undefined') sv = {};
if (typeof(sv.array) == 'undefined') sv.array = {};

//sv.array.remove = function (a, item) Array.prototype.remove.call(a, item);

sv.array.contains = function array_contains (arr, s) (arr.indexOf(s) !== -1);

sv.array.unique = function array_unique(arr)
	arr.reduce(function(a, j) {
		if(a.indexOf(j)==-1) a.push(j);
		return(a)}, []);

sv.array.remove = function array_remove(arr, item) arr.filter(function(x) x !== item);

sv.array.duplicates = function array_duplicates(arr) {
	var dup = [];
	arr.forEach(function(el, i, a) {
		if(i > 0 && a.lastIndexOf(el, i - 1) != -1) dup.push(el) });
	return dup;
}
