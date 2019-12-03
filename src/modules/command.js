/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  Copyright (c) 2015-2017 Kamil Barton
 *  Copyright (c) 2009-2015, K. Barton & Ph. Grosjean (phgrosjean@sciviews.org)
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */
/* globals require, Services
 */

(function () {
"use strict";
	const { Cc, Ci, Cu } = require('chrome');

    if (typeof Services === "undefined")
        Cu.import("resource://gre/modules/Services.jsm");

    var logger = require("ko/logging").getLogger("komodoR");
    
    const { /*arr: ArrayUtils,*/ str: su } = require("kor/utils");
    const fu = require("kor/fileutils"), 
        UI = require("kor/ui"), 
        Prefs = require("kor/prefs"),
        RConn = require("kor/connector");
    
    const _W = require("kor/main").mainWin;
    var ko = _W.ko;
    var rHelpWin = null, // A reference to the R Help Window
        _this = this, RProcess = null, 
        _RIsRunning, _RIsIdle = true;
    // read only command.isRRunning
    // set via command.setRStatus - TODO merge?
    Object.defineProperties(this, {
        isRRunning: { get() _RIsRunning, enumerable: true },
        toString : { value: () => "[object KorCommand]"}
    });
    
    this.ProcessObserver = function ProcObs(command, process, callback) {
        this._command = command;
        this._process = process;
        this._callback = (callback || (() => {}));

        Services.obs.addObserver(this, 'run_terminated', false);
        try {
            this._process.wait(0);
            this.cleanUp();
        } catch (e) {}
    };

    this.ProcessObserver.prototype = {
        observe(child, topic, command) {
            if ('run_terminated' === topic && this._command === command) {
                this.cleanUp();
                this._process = null;
            }
            //else if (topic === 'status_message' && (subject.category == "run_command")
            //	&& ((matches = subject.msg.match(/^(['`"])(.+)\1 returned ([0-9]+).$/)) != null
            //		&& matches[2] == this.command)) {
            //	/*...
            //	TODO: cleanUp - observer status_message
            //	....*/
            //}
        },
        cleanUp() {
            if (this._command) {
                Services.obs.removeObserver(this, 'run_terminated');
                this._command = null;
            }
            if (this._process) {
                var processExitCode = this._process.wait(-1),
                    processOutput = (this._process.getStdout() || this._process.getStderr());
                this._callback(processExitCode, processOutput, this._process);
                this._process = null;
            }
        },
        kill() {
            if (this._command) {
                Services.obs.removeObserver(this, 'run_terminated');
                this._command = null;
            }
            if (this._process) {
                this._process.kill(-1);
                this._process = null;
            }
        }
    };

    this.getCwd = function (selected) {
        var dir = "";
        if (selected) {
            if (ko.places.manager.currentPlaceIsLocal) {
                let placesSel = ko.places.manager.getSelectedItem().getFile();
                dir = placesSel.isDirectory ? placesSel.path : placesSel.dirName;
            }
        } else {
            let uri;
            // XXX JavaScript Error: "ko.places.manager is undefined" 
            if (ko.places.manager.currentPlaceIsLocal && ko.places.manager.currentPlace) {
                uri = ko.places.getDirectory();
            } else {
                uri = ko.places.manager.lastLocalDirectoryChoice;
            }
            dir = fu.pathFromURI(uri);
        }
        return dir;
    };

    this.openRPreferences = function () {
		logger.debug("openRPreferences: start");
        let item = "PrefRItem";
        require("sdk/timers").setImmediate(() => _W.prefs_doGlobalPrefs(item, true /*=modal*/));
/*
         // workaround the bug with switching to the right panel:
         var prefFrameLoadEvent = function _prefFrameLoadEvent(event) {
         	try {
         		let prefWin = event.detail.parent;
         		//prefWin.hPrefWindow.contentFrame.contentDocument.location !== "chrome://komodor/content/pref-R/pref-R.xul";
         		if (prefWin.hPrefWindow.filteredTreeView.getCurrentSelectedId() !== item)
         			prefWin.switchToPanel(item);
         	} catch (e) {
         		logger.exception(e, "while switching to 'PrefRItem' in openRPreferences->on interval");
         	} finally {
         		_W.removeEventListener("pref-frame-load", _prefFrameLoadEvent, true);
         	}
         };
         _W.addEventListener("pref-frame-load", prefFrameLoadEvent, true);
*/
    };

    var _RTerminationCallback = (exitCode) => {
        // on Linux the process run in a terminal exits immediately, yet
        // both terminal and R are still running.
        // So need to check whether R is actually closed.
        var connected = RConn.isRConnectionUp(true);
        if (!connected) UI.addNotification("R is closed with code " + exitCode);
        _this.setRStatus(connected);
    };

    this.startR = function startR() {
        if (!Prefs.getPref("RInterface.RCommand")) {
            if (ko.dialogs.okCancel(
                    UI.translate("R interpreter is not set in " +
                        "Preferences. Would you like to do it now?"),
                    "OK", null, "R interface") == "OK")
                _this.openRPreferences();
            return;
        }
        
        var pathToR = Prefs.getPref("RInterface.pathToR");
        if (!pathToR ||
            !((fu.exists2(pathToR) === fu.TYPE_FILE) || 
            (fu.whereIs(pathToR).length !== 0))) {
            if (ko.dialogs.okCancel(
                    UI.translate("R interpreter set in Preferences is not found." +
                        "Would you like to edit R Preferences now?"),
                    "OK", null, "R interface") == "OK")
                _this.openRPreferences();
            return;
        }
		if(!ko.places || !ko.places.manager) { // Komodo is not ready
			require("sdk/timers").setTimeout(() => startR(), 512);
			return;
		}
		
		if(!RConn.serverIsUp) {
			logger.debug("startR: starting socket server.");
			RConn.restartSocketServer(null, startR);
			return;
		}
        
        var cwd = _this.getCwd(false);
        if(fu.exists2(cwd) !== fu.TYPE_DIRECTORY) {
                UI.addNotification(
                        "Cannot start R: current working directory does not exist.",
                        "r-interface", true)
                    
             return;
        }

        var rDir = fu.path("ProfD", "extensions", "komodor@komodor", "R");
        fu.write(fu.path(rDir, "_init.R"),
            "base::setwd('" + su.addslashes(cwd) +
            "')\n" + "options(" +
            "ko.port=" + RConn.getProp("koPort") +
            ", " +
            "ko.R.port=" + RConn.getProp("rPort") +
            ", " +
            "ko.host=\"localhost\")\n" +
            "..ko.repos.. <- base::getOption(\"repos\"); ..ko.repos..[[\"CRAN\"]] <- \"" +
            Prefs.getPref("CRANMirror") + "\"; " +
            "base::options(repos = ..ko.repos..); base::rm(..ko.repos..); \n",
            "utf-8"
        );
        // TODO: use RInterface.RHost

        var cmd = Prefs.getPref("RInterface.RCommand");
        var isWin = Services.koOs.name === "nt";
        var id = Prefs.getPref("RInterface.runRAs", isWin ? "r-gui" : "r-terminal");
        var env = ["KOMODOR_VER=" + require("kor/main").version];
        switch (id) {
        case "r-tkgui":
            env.push("Rid=R-tk");
            // Set DISPLAY only when not set:
            var ifEnv = Cc["@activestate.com/koEnviron;1"].createInstance(Ci.koIEnviron);
            if (!ifEnv.has("DISPLAY")) env.push("DISPLAY=:0");
            ifEnv = null;
            break;
        case "r-terminal":
            break;
        default:
        }

        var envStr = env.join("\n");
        var RProcessObserver;

        if (isWin && id == "r-terminal") {
            var runSvc = Cc['@activestate.com/koRunService;1'].getService(Ci.koIRunService);
            runSvc.Run(cmd, rDir, envStr, true, '');
            // Observe = 'run_command'; subject = 'status_message'; data = command
            RProcessObserver = new _this.ProcessObserver(cmd, false, _RTerminationCallback);
        } else {
            //var process = runSvc.RunAndNotify(cmd, rDir, env, null);
            // Observe = 'run_terminated'; subject = child; data = command
            //RProcessObserver = new _ProcessObserver(cmd, process, _RTerminationCallback);
            RProcessObserver = _this.runSystemCommand(cmd, rDir, envStr, _RTerminationCallback);
            RProcess = RProcessObserver._process;
        }
        _this.setRStatus(true);
    };

    this.runSystemCommand = function (cmd, cwd, env, terminationCallback) {
        var runSvc = Cc['@activestate.com/koRunService;1']
            .getService(Ci.koIRunService);
        var process = runSvc.RunAndNotify(cmd, cwd, env, null);
        return new _this.ProcessObserver(cmd, process, terminationCallback);
    };
    
    this.fireEvent = function(target, eventName, detail = null, bubbles = false, cancelable = false) {
        var event = new _W.CustomEvent(eventName, { detail: detail, bubbles: bubbles, cancelable: cancelable });
        target.dispatchEvent(event);
    };

    this.setRStatus = function (running, quiet) {
        if (arguments.length === 0)
            throw("Error in setRStatus: argument 'running' is required");
        running = Boolean(running);

        if (running != _RIsRunning) {
            _RIsRunning = running;
            _this.fireEvent(_W, 'r-status-change', { running: running,
                                                     quiet: Boolean(quiet) });
			logger.debug("R status changed to " + running);
            // buttons/menu items (except toolbar R button) respond to:
            _W.updateCommands('r_status_changed');
        }
    };
    
    this.setRBusy = function(busy) {
        var idle = !Boolean(busy);
        if (idle != _RIsIdle) {
            _RIsIdle = idle;
            _this.fireEvent(_W, 'r-busy-change', { idle: idle });
			logger.debug("R status changed to " + (idle ? "idle" : "busy"));
            // buttons/menu items (except toolbar R button) respond to:
            _W.updateCommands('r_is_busy_changed');
        }
    };

    this.openPkgManager = function () {
        var win = UI.getWindowRef("chrome://komodor/content/pkgman/pkgman.xul",
            "RPkgMgr", "chrome=yes,dependent" + "scrollbars=yes,status=no,close,dialog=no,resizable", true, null);
        return win;
    };
    
    // TODO define in module
    var isUrl = (s) => s.search(/^((f|ht)tps?|chrome|resource|koicon|about|file):\/{0,3}/) === 0;

    // Close r-help tab
    this.closeHelp = function () {
        var tabPanel = document.getElementById("rhelpviewbox");
        var tab = document.getElementById("rhelp_tab");
        var tabBox = tabPanel.parentNode.parentNode;

        tabPanel.hidden = tab.hidden = true;
        tabBox.selectedIndex = ((tabBox.tabs.getIndexOfItem(tab) + 2) %
            tabBox.tabs.itemCount) - 1;
        document.getElementById("rhelpview-frame")
            .setAttribute("src", "about:blank");
    };

    // returns reference to the rHelpWindow
    this.openHelp = function (location) {
        if (location) {
            try {
				//if (location.search(/[a-z\-\.]/i)) { // supposedly a keyword
					//location = RConn.evalAsync("base::cat(kor::getHelpURL(" + TODO + "))",);
				//}
                if (!isUrl(location)) location = fu.toFileURI(location);
            } catch (e) { // fallback
                if (!isUrl(location)) location = "file://" + location.replace(/\\/g, "/");
            }
        } else {
            try {
                location = RConn.eval("base::cat(kor::getHelpURL())"); // XXX: make async
            } catch (e) {
                location = Prefs.getPref('RInterface.rRemoteHelpURL') + 'doc/index.html';
            }
        }

        var rHelpHref = "chrome://komodor/content/RHelpWindow/RHelpWindow.xul";

        rHelpWin = UI.getWindowByURI(rHelpHref);
        if (!rHelpWin || rHelpWin.closed) {
            logger.debug("Starting R help with page " + location);

            // try/catch here somehow prevented from storing window
            // reference in rHelpWin. No idea why...
            rHelpWin = _W.openDialog(rHelpHref, "RHelp",
                "chrome=yes,dependent,resizable=yes," +
                "scrollbars=yes,status=no,close,dialog=no", null, location);
        } else 
            rHelpWin.go(location);

        rHelpWin.focus();
        rHelpWin.close = _this.closeHelp;
        return rHelpWin;
    };

    var koViews = require("ko/views");
    
    var _isRCurLanguage = () => true;
    var rWantsMore = false, rBrowsingFrame = false;
    var _isRmdCurLanguage = () => {
        var view = koViews.current();
        if (!view || !view.koDoc) return false;
        return view.koDoc.language === "Rmarkdown";
    };
    
    Services.obs.addObserver({ observe(subject, topic, data) {
            rWantsMore = subject.message === "more";
            _W.updateCommands('r_command_executed');
        }}, "r-command-executed", false);

    _W.addEventListener('r-evalenv-change', event => {
        rBrowsingFrame = event.detail.evalEnvName !== ".GlobalEnv";
    }, false);
     
    let controllersSet = false;
    this.setControllers = function _setControllers() {
        if (controllersSet) return;
        controllersSet = true;
        
        logger.debug("started setControllers");
        
        //Based on: chrome://komodo/content/library/controller.js
        // backwards compatibility APIs
        var xtk = _W.xtk;
        xtk.include("controller");

        const ifRRunning = 1, ifRIdle = 2, ifIsRDoc = 4, ifHasSelection = 8,
            ifIsRmdDoc = 16;
        const R = require("kor/r");
        var handlers = {
            'cmd_RPkgManagerOpen': [_this.openPkgManager, ifRIdle],
            'cmd_RHelpOpen': [_this.openHelp, ifRIdle],
            'cmd_RPreferencesOpen': [_this.openRPreferences, -1],
            'cmd_RRmdPreview': [_this.rmdPreview, ifIsRmdDoc | ifRIdle],
            
            'cmd_RFormatCodeInView': [R.formatRCodeInView, ifIsRDoc | ifRIdle],

            'cmd_RStart': [_this.startR, () => !_RIsRunning],
            'cmd_RQuit': [R.quit, ifRRunning],

            'cmd_REscape': [R.escape, () => _RIsRunning && rWantsMore],
            'cmd_RBrowseFrame': [R.endBrowse, () => _RIsRunning && rBrowsingFrame],
            'cmd_RRunAll': [() => R.send("all"), ifIsRDoc | ifRIdle],
            'cmd_RSourceAll': [() => R.source("all"), ifIsRDoc | ifRIdle],
            'cmd_RRunBlock': [() => R.send("block"), ifIsRDoc | ifRIdle],
            'cmd_RRunFunction': [() => R.send("function"), ifIsRDoc | ifRIdle],
            'cmd_RRunLine': [() => R.send("line"), ifIsRDoc | ifRIdle],
            'cmd_RRunPara': [() => R.send("para"), ifIsRDoc | ifRIdle],
            'cmd_RSourceBlock': [() => R.source("block"), ifIsRDoc | ifRIdle],
            'cmd_RSourceFunction': [() => R.source("function"), ifIsRDoc | ifRIdle],
            'cmd_RSourcePara': [() => R.source("para"), ifIsRDoc | ifRIdle],
            'cmd_RRunLineOrSelection': [R.run, ifIsRDoc | ifRIdle],
            'cmd_RSourceLineOrSelection': [() => R.source("lineorsel"),
                ifIsRDoc | ifRIdle ],
            'cmd_RRunSelection': [() => R.send("sel"),
                ifIsRDoc | ifRIdle | ifHasSelection ],
            'cmd_RSourceSelection': [() => R.source("sel"),
                ifIsRDoc | ifRIdle | ifHasSelection ],
            'cmd_viewrtoolbar': [() => ko.uilayout.toggleToolbarVisibility("RToolbar"), -1]
        };

        var _hasSelection = () => {
            var view = require("ko/views").current();
            if (!view || !view.scimoz) return false;
            return (view.scimoz.selectionEnd - view.scimoz.selectionStart) != 0;
        };

        var _test = (cmdName) => {
            var test = handlers[cmdName][1];
            if (test === -1) return true;
            if (typeof test === "function") return test();
            return (
                (((test & ifRRunning) !== ifRRunning) || _RIsRunning) &&
                (((test & ifRIdle) !== ifRIdle) || (_RIsRunning && _RIsIdle)) &&
                (((test & ifIsRDoc) !== ifIsRDoc) || _isRCurLanguage()) &&
                (((test & ifIsRmdDoc) !== ifIsRmdDoc) || _isRmdCurLanguage()) &&
                (((test & ifHasSelection) !== ifHasSelection) || _hasSelection())
           );
        };

        // From: komodo.jar/controller.js
        // The following controller is for any <command> or <broadcaster>
        // that doesn't fit into any other controller.  It is generally
        // used for commands that don't ever get disabled.

        var broadcasterController = function () {
            //"use strict";
            if (typeof _W.ko.main !== "undefined") {
                _W.ko.main.addWillCloseHandler(this.destructor, this);
            } else {
                // ko.main will not be defined in dialogs that load controller.js.
                var self = this;
                _W.addEventListener("unload", () => self.destructor(), false);
            }
        };

        // The following two lines ensure proper inheritance (see Flanagan, p. 144).
        broadcasterController.prototype = new xtk.Controller();
        broadcasterController.prototype.constructor = broadcasterController;

        broadcasterController.prototype.destructor = function () {
            _W.controllers.removeController(this);
        };

        broadcasterController.prototype.isCommandEnabled = function (cmdName) {
            if (cmdName in handlers) return _test(cmdName);
            //if (cmdName in handlers) return true;
            return false;
        };

        broadcasterController.prototype.supportsCommand = broadcasterController.prototype
            .isCommandEnabled;

        broadcasterController.prototype.doCommand = function (cmdName) {
            if (cmdName in handlers) return handlers[cmdName][0]();
            return false;
        };

        _W.controllers.appendController(new broadcasterController());

        logger.debug("Controllers has been set.");
    };

    this.places = {

        get anyRFilesSelected()
        _RIsRunning &&
        ko.places.manager.getSelectedItems().some(
            x => x.file.isLocal && x.file.ext.toLowerCase() === ".r"),

        get anyRDataFilesSelected()
        _RIsRunning &&
        ko.places.manager.getSelectedItems().some(
            x => x.file.isLocal && (x.file.ext || x.file.leafName).toLowerCase() === ".rdata"),

        sourceSelection() {
            if (!_RIsRunning) return;
            let files = ko.places.manager.getSelectedItems()
                .filter(x => (x.file.isLocal && x.file.ext.toLowerCase() == ".r"))
                .map(x => x.file.path);
            if (!files.length) return;
            let cmd = files.map(x => "base::source('" + su.addslashes(x) + "')").join("\n");
            RConn.evalAsync(cmd, () => require("kor/main").rbrowser.refresh(true), false);
        },

        loadSelection() {
            if (!_RIsRunning) return;
            let files = ko.places.manager.getSelectedItems()
                .filter(x => (x.file.isLocal &&
                    // for '.RData', .ext is ''
                    (x.file.ext || x.file.leafName).toLowerCase() == ".rdata"))
                .map(x => x.file.path);
            if (!files.length) return;
            let cmd = files.map(x => "load('" + su.addslashes(x) + "')").join("\n");
            RConn.evalAsync(cmd, () => require("kor/main").rbrowser.refresh(true), false);
        },

        setWorkingDir() {
            if (!_RIsRunning) return;

            var path;
            if (ko.places.manager._clickedOnRoot()) {
                if (!ko.places.manager.currentPlaceIsLocal) return;
                path = fu.pathFromURI(ko.places.manager.currentPlace);
            } else {
                let dir = ko.places.manager.getSelectedItem();
                if (!dir.file.isLocal || dir.type !== "folder") return;
                path = dir.file.path;
            }
            let cmd = "base::setwd('" + su.addslashes(path) + "')";
            RConn.evalAsync(cmd, () => require("kor/main").rbrowser.refresh(true), false);
        }

    }; // end this.places

    this.rmdPreview = function(beVerbose = false, showInTab = true) {
        var view = require("ko/views").current();
        if (!view || !view.koDoc) return;
        if (['Rmarkdown', 'Markdown'].indexOf(view.koDoc.language) === -1)
            return;
        var file = UI.pathWithCurrentViewContent();
        if (!file) return;
        var r = require("kor/r"); // cyclic dependency: command<=>r
        RConn.evalAsync("kor::rmdToHtml(" + r.arg(file) +
            ", verbose=" + r.arg(beVerbose) + ")",
            (output) => {
                var path = output.substr(0, output.search(/ *[\r\n]+/));
                if (!fu.exists(path)) {
                    UI.addNotification(
                        "Rmarkdown preview: no file produced",
                        "r-interface", true)
                    return;
                }
                UI.openBrowser(fu.toFileURI(path), !showInTab);
            }, false);
    };

}).apply(module.exports);