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
                var robWidget = require("ko/windows").getWidgetWindows()
                    .find(x => x.name === "robViewbox");
                if (!robWidget) return undefined;
                _rOB = robWidget.rob;
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
    this.checkRVersion2 = (fileName) => _this.rCliExec(fileName, "do.call(cat,c(R.version[c('major','minor','svn rev')],sep='.'))");
    
    
    
//     var r = require("kor/fileutils").whereIs("R")   
//     for(let i = 0; i < r.length; ++i) kor.checkRVersion(r[i]).then((function(j, val) this[j] = val).bind(res, i));


    this.fireEvent = (eventName, detail) => {
        logger.debug("fireEvent: " + eventName + " fired");
        require("sdk/timers").setImmediate(() => _this.command.fireEvent(_w, eventName, detail, false, false));
    };
    
    this.progressBar = (title, label = "", min = 0, max = 1, initial = 0, 
        width = 320) => {
        var range = max - min;
        var realValue = initial;
        var w = _w.openDialog("chrome://komodor/content/extra/progress.xul",
            "_blank", "chrome,titlebar,centerscreen,outerWidth=" + width +
            ",height=64",
            {title: title, label: label, max: 100, initial: realValue});
        return {
            get window() w,
            get value() realValue,
            set value(v) {
                realValue = Math.max(min, Math.min(max, v));
                w.progressMeter.setAttribute("value", Math.round((realValue - min) / range * 100));
            },
            set title(v) {
              w.document.title = v;
            },
            get title() {
                return w.document.title;
            },
            set label(v) {
              w.document.getElementById("label").value = v;
            },
            get label() {
                return w.document.getElementById("label").value;
            },
            close() {
                w.close();
            }
        };
    };
    
    var progressBars = new Map(), progressBarCounter = 0;
    
    this.rProgressBar = (title = "R progress bar", label = "",
        min = 0, max = 1, initial = 0, width = 300) => {
        var pb = _this.progressBar(title, label, min, max, initial, width);
        progressBars.set(++progressBarCounter, pb);
        pb.window.pbId = progressBarCounter;
        pb.window.pbList = progressBars;
        return progressBarCounter;
    };
    
    this.rSetProgressBar = (id, value, title, label) => {
        var pb = progressBars.get(id);
        if(!pb) return null;
        var prevValue = pb.value;
        if(typeof value === "number")
            pb.value = value;
        if(typeof title === "string") pb.title = title;
        if(typeof label === "string") pb.label = label;
        return prevValue;
    };
    
    this.rcloseProgressBar = (id) => {
        var pb = progressBars.get(id);
        if(!pb) return;
        pb.close();
    };
    
  
}).apply(kor);

// jshint ignore:start

if (typeof module === "object") {
    module.exports = kor;
} else {
    this.EXPORTED_SYMBOLS = ["kor"]; // jshint ignore: line
}
