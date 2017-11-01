/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  Copyright (c) 2008-2017 Kamil Barton
 *  Copyright (c) 2008-2009, Philippe Grosjean, Romain Francois and Kamil Barton
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */

if (typeof(sv) == 'undefined') sv = {};
if (typeof(sv.string) == 'undefined') sv.string = {};

// Replace line feed and carriage return by 'code'
sv.string.replaceCRLF = function (str, code) {
	// Replace all \r\n by 'code' in cmd
	str = str.replace(/(\r?\n|\r)/g, code);
	return str;
};

// Remove the last line feed and or carriage return in the text
sv.string.removeLastCRLF = function (str) {
	if(str) str = str.replace(/[\n\r]{1,2}$/, "");
    return str;
};

// changes a string to a regular expression
sv.string.toRegex = function (str) {
	// brackets
	str = str.replace(/([\]\(\\\*\+\?\|\{\[\(\)\^\$\.\#])/g, "\\$1")
		.replace(/\t/g, "\\t")	//.replace(/ /, "\\s")
		.replace(/\n/g, "\\n")	.replace(/\r/g, "\\r")
		.replace(/\f/g, "\\f");
	return str;
};

// Get filename or last directory name in a file path
sv.string.filename = function (str) {
	// Under Windows, replace \ by /
	if (navigator.platform.indexOf("Win") == 0)
		str = str.replace(/[\\]/g, "/");
	// Remove last trailing '/'
	str = str.replace(/\/$/, "");
	// Split into components
	items = str.split("/");
	// Return last component
	return items[items.length - 1];
};

sv.string.addslashes = function(str) {
    return str.replace(/([\\"'])/g, "\\$1")
        .replace(/\x00/g, "\\0")
        .replace(/\u0008/g, "\\b")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\f/g, "\\f")
        .replace(/\v/g, "\\v");
};

sv.string.trim = function (str, which) {
	if (which === undefined) which = "both";
	var rx;
	switch(which) {
	 case "left":
		rx = /^\s+/g;
		break;
	 case "right":
		rx = /\s+$/g;
		break;
	 default:
		rx = /^\s+|\s+$/g;
		break;
	}
	return str.replace(rx, "");
};

// Trim function for String
String.prototype.trim = function() sv.string.trim(this);

// Right trim
String.prototype.rtrim = function() sv.string.trim(this, "right");

// Left trim
String.prototype.ltrim = function() sv.string.trim(this, "left");

// Add slashes
String.prototype.addslashes = function () sv.string.addslashes(this);

// Escape string for regular expression
String.prototype.regExpEscape = function() sv.string.toRegex(this);
