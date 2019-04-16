/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
'use strict'; // jshint ignore:line

//Usage:
// Cu.import("chrome://komodor/content/modules/utils.js");
// Cu.import("resource://kor/utils.js");

this.ArrayUtils = { // jshint ignore:line
    
    toString() "[object KorArrayUtils]",

    unique(arr)
    arr.reduce((a, j) => {
        if (a.indexOf(j) == -1) a.push(j);
        return a;
    }, []),

    remove(arr, item) arr.filter(x => x !== item),

    duplicates(arr) {
        let dup = [];
        arr.forEach((el, i, a) => {
            if (i > 0 && a.lastIndexOf(el, i - 1) !== -1) dup.push(el);
        });
        return dup;
    }

};

this.StringUtils = { // jshint ignore:line
    
    toString() "[object KorStringUtils]",
    
    // changes a string to a regular expression
    toRegex(str) {
        // brackets
        str = str.replace(/([\]\(\\\*\+\?\|\{\[\(\)\^\$\.\#])/g, "\\$1")
            .replace(/\t/g, "\\t") //.replace(/ /, "\\s")
            .replace(/\n/g, "\\n").replace(/\r/g, "\\r")
            .replace(/\f/g, "\\f");
        return str;
    },

    addslashes(str) {
        return str.replace(/([\\"'])/g, "\\$1")
            .replace(/\x00/g, "\\0")
            .replace(/\u0008/g, "\\b")
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r")
            .replace(/\f/g, "\\f")
            .replace(/\v/g, "\\v");
    },

    uid(length = 1) {
        let rval = "";
        for (let i = 0; i < length; ++i)
            rval += Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        return rval;
    },
    
    // source:
    // https://sites.google.com/site/getsnippet/javascript/string/expandtabs
    expandTabs(str, tabSize) {
        let spaces = " ".repeat((tabSize = tabSize || 8));
        return str.replace(/([^\r\n\t]*)\t/g, (a, b) => b + spaces.slice(b.length % tabSize));
    },

    
    unindent(str, tabSize) {
        str = this.expandTabs(str, tabSize);
        var unindentBy = str.match(/^[\t]+/mg).reduce((a, v) => Math.min(a, v.length), Infinity);
        return str.replace(new RegExp("^ {" + unindentBy + "}", "mg"), "");
    },

    
    //compareVersion(v1, v2) 
	//Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator).compare(v1, v2)
    
};

// jshint ignore:start
if (typeof module === "object") {
    module.exports.str = this.StringUtils;
    module.exports.arr = this.ArrayUtils;
} else {
    this.EXPORTED_SYMBOLS = ['ArrayUtils', 'StringUtils'];
}
// jshint ignore:end
