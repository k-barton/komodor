/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  Copyright (c) 2008-2017 Kamil Barton
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */

/* globals require, Components */

let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
        .getService(Components.interfaces.nsIWindowMediator);
let w = wm.getMostRecentWindow("Komodo");
if (typeof w.sv === 'undefined') w.sv = {};

Object.defineProperties(w.sv, {
   file: {  get: () => {
         require("ko/logging").getLogger("komodoR")
            .deprecated("'sv.file' is DEPRECATED. Use 'require(\"kor/fileutils\")' instead.");
        return require("kor/fileutils");
    }},
    array: {  get: () => {
         require("ko/logging").getLogger("komodoR")
            .deprecated("'sv.array' is DEPRECATED. Use 'require(\"kor/utils\").arr' instead.");
        return require("kor/utils").arr;
    }},
    string: {  get: () => {
         require("ko/logging").getLogger("komodoR")
            .deprecated("'sv.string' is DEPRECATED. Use 'require(\"kor/utils\").str' instead.");
        return require("kor/utils").str;
    }}
});

