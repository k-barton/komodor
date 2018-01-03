/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  Copyright (c) 2008-2017 Kamil Barton
 *  Copyright (c) 2008-2009, Philippe Grosjean, Romain Francois and Kamil Barton
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */

/* globals sv, navigator */

let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
        .getService(Components.interfaces.nsIWindowMediator);
let w = wm.getMostRecentWindow("Komodo");
if (typeof w.sv === 'undefined') w.sv = {};
var sv = w.sv;



if (typeof sv.string === 'undefined') sv.string = {};

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
	var items = str.split("/");
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

sv.string.trim = function (str, which = "both") {
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

// source:
// https://sites.google.com/site/getsnippet/javascript/string/expandtabs
sv.string.expandTabs = function(str, tabSize) {
  let spaces = " ".repeat((tabSize = tabSize || 8));
  return str.replace(/([^\r\n\t]*)\t/g, (a, b) => b + spaces.slice(b.length % tabSize));
};

sv.string.unindent = function(str, tabSize) {
    str = sv.string.expandTabs(str, tabSize);
    var unindentBy = str.match(/^[\t ]+/mg).reduce((a, v) => Math.min(a, v.length), Infinity);
    return str.replace(new RegExp("^ {" + unindentBy + "}", "mg"), "");
};
