"use strict"; // jshint ignore:line

/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  This code is based on SciViews-K general functions, which are
 *  copyright (c) 2008-2010 by Ph. Grosjean (phgrosjean@sciviews.org)
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */

/* globals Components, require */

var kor = {};

// TODO: replace
// ko.views.manager.currentView => require("ko/views").current()
// ko.views.manager.currentView.scimoz => require("ko/views").current().get("scimoz")

(function () {
    var logger = require("ko/logging").getLogger("komodoR");
    
    var _this = this;
    var _version, _w;
    //var asCJS = typeof require === "function";

    Object.defineProperties(_this, {
        langName: {value: "R_extended", enumerable: true},
        extensionId: {value: "komodor@komodor", enumerable: true},
        version: { get() _version, enumerable: true},
        mainWin: { get() _w, enumerable: true },
        toString: { value() "[object KorMain]" }
    });
    
    if (typeof require === "function") {
       var { Cc, Ci, Cu } = require('chrome');
        _w = require("ko/windows").getMain();
    } else {
       var { classes: Cc, interfaces: Ci, utils: Cu } = Components;
        if(!_w)  {
            _w = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator)
                .getMostRecentWindow("Komodo");
        }    
    }
    
    var _rOB;
    Object.defineProperties(_this, {
        command: { get() require("kor/command"), enumerable: true},
        rbrowser: { get() {
            if (!_rOB) {
                let rbrowserWidget = require("ko/windows").getWidgetWindows()
                    .find(x => x.name === "rbrowser_tabpanel");
                if (!rbrowserWidget) return undefined;
                _rOB = rbrowserWidget.rob;
            }
            return _rOB;
            }, enumerable: true},
        r: { get() require("kor/r"), enumerable: true},
        rconn: { get() require("kor/connector"), enumerable: false},
    });
    
    try {
        let AddonManager = Cu.import("resource://gre/modules/AddonManager.jsm").AddonManager;
        AddonManager.getAddonByID(_this.extensionId, (addon) => _version = addon.version);
    } catch (e) {
        Cu.reportError(e);
    }
  
    //this.ui = Cu.import("resource://kor/UI.jsm").UI;
    //this.rConnector = Cu.import("resource://kor/RConnector.jsm").RConnector;
    //this.r = Cu.import("resource://kor/RUtils.jsm").RUtils;
    //this.cmd = Cu.import("resource://kor/Command.jsm").Command;
    
    //this.loadModule = (id) => {
    //    try {
    //        return Cu.import("resource://kor/" + id + ".js?" + Math.floor(1e4 * Math.random()).toString(32));
    //    } catch (e) {
    //        Cu.reportError(e);
    //    }
    //};
    
    //const system = require("sdk/system");
    const platform = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS.toLowerCase();

    //if(platform === "linux") {
        //shQuote =  (s) => "'" + require("kor/utils").str.addslashes(s) + "'";
    let shQuote = (s) => "\"" + s + "\"";
    
    let procRBinPath;
    if(platform === "winnt") procRBinPath = (fileName) => "\"" + fileName.replace(/Rgui(?=\.exe\b|\b)/i, "R") + "\"";
    else procRBinPath = (fileName) => "'" + fileName + "'";
    
    // Note: do not use double quotes in rCommand. Cannot escape it in Windows command line.
    this.rCliExec = (fileName, rCommand) =>
    new Promise((resolve, reject) => 
        _this.command.runSystemCommand(procRBinPath(fileName) + " -q --vanilla --slave -e " +
            shQuote(rCommand), "", "", (exitCode, output) => resolve(output, exitCode)));
    
    this.checkRVersion = (fileName) => _this.rCliExec(fileName, "cat(R.version.string)");
//     var r = require("kor/fileutils").whereIs("R")   
//     for(let i = 0; i < r.length; ++i) kor.checkRVersion(r[i]).then((function(j, val) this[j] = val).bind(res, i));


    this.fireEvent = (eventName, detail) => {
        require("sdk/timers").setImmediate(() => _this.command.fireEvent(_w, eventName, detail, false, false));
    };
   
   
}).apply(kor);

// jshint ignore:start

if (typeof module === "object") {
    module.exports = kor;
} else {
    this.EXPORTED_SYMBOLS = ["kor"]; // jshint ignore: line
}
