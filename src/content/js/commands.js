/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  Copyright (c) 2015-2017 Kamil Barton
 *  Copyright (c) 2009-2015, K. Barton & Ph. Grosjean (phgrosjean@sciviews.org)
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */


// require file,string,rconnection,utils (translate),pref,rbrowser

/* globals sv, ko, Components, window, document, navigator, xtk, require,
   prefs_doGlobalPrefs
   */

if (typeof (sv.command) == 'undefined') sv.command = {};

(function () { // sv.command constructor
    
    const {
        classes: Cc,
        interfaces: Ci
    } = Components;

    var logger = require("ko/logging").getLogger("komodoR");
 //   logger.setLevel(logger.DEBUG);
    
    this.RHelpWin = null; // A reference to the R Help Window
    var _this = this;
    this.RProcess = null;
    
    var _RIsRunning;
    // read only sv.command.isRRunning
    // set via sv.command.setRStatus - TODO merge?
    Object.defineProperty(_this, "isRRunning", {
       get: () => _RIsRunning,
       enumerable: true
    });

    function _getWindowByURI(uri) {
        var wm = Cc['@mozilla.org/appshell/window-mediator;1']
            .getService(Ci.nsIWindowMediator);
        var en = wm.getEnumerator("");

        if (uri) {
            var win;
            while (en.hasMoreElements()) {
                win = en.getNext();
                if (win.location.href == uri) return (win);
            }
        }
        return (null);
    }

    this.getWindowByURI = _getWindowByURI;

    //Get reference to a window, opening it if is closed
    function _getWindowRef(uri, name, features, focus) { //, ...
        var win = _getWindowByURI(uri);
        if (!win || win.closed) {
            try {
                var args = Array.apply(null, arguments);
                args = args.slice(0, 3).concat(args.slice(4));
                if (!features) args[2] = "chrome,modal,titlebar";
                win = window.openDialog.apply(null, args);
            } catch (e) {    
                logger.exception(e, "Error opening window: " + uri);
            }
        }
        if (focus) win.focus();
    }

    function _RControl_supported() {
        var currentView = ko.views.manager.currentView;
        if (!currentView || !currentView.koDoc) return (false);
        //return(_isRRunning() && currentView.koDoc.language == sv.langName);
        return currentView.koDoc.language == sv.langName;
    }

    function _RControlSelection_supported() {
        var currentView = ko.views.manager.currentView;
        if (!currentView || !currentView.scimoz) return (false);
        return (_RControl_supported() &&
            ((currentView.scimoz.selectionEnd -
                currentView.scimoz.selectionStart) != 0));
    }

    // Services.obs
    var _observerSvc = Cc['@mozilla.org/observer-service;1']
        .getService(Ci.nsIObserverService);

    function _ProcessObserver(command, process, callback) {
        this._command = command;
        this._process = process;
        this._callback = (callback || function () {});

        _observerSvc.addObserver(this, 'run_terminated', false);
        try {
            this._process.wait(0);
            this.cleanUp();
        } catch (e) {}
    }

    _ProcessObserver.prototype = {
        observe: function (child, topic, command) {
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
        cleanUp: function () {
            if (this._command) {
                _observerSvc.removeObserver(this, 'run_terminated');
                this._command = null;
            }
            if (this._process) {
                var processExitCode = this._process.wait(-1),
                    processOutput = (this._process.getStdout() || this._process.getStderr());
                this._callback(processExitCode, processOutput, this._process);
                this._process = null;
            }
        },
        kill: function () {
            if (this._command) {
                _observerSvc.removeObserver(this, 'run_terminated');
                this._command = null;
            }
            if (this._process) {
                this._process.kill(-1);
                this._process = null;
            }
        }
    };

    this.ProcessObserver = _ProcessObserver;

    this.getCwd = function (selected) {
        var dir = "";
        if (selected) {
            if (ko.places.manager.currentPlaceIsLocal) {
                var placesSel = ko.places.manager.getSelectedItem().getFile();
                dir = placesSel.isDirectory ? placesSel.path : placesSel.dirName;
            }
        } else {
            var uri;
            if (ko.places.manager.currentPlaceIsLocal) {
                uri = ko.places.getDirectory();
            } else {
                uri = ko.places.manager.lastLocalDirectoryChoice;
            }
            dir = sv.file.pathFromURI(uri);
        }
        return dir;
    };

    this.openRPreferences = function (item) {
        if (!item) item = "svPrefRItem";
        prefs_doGlobalPrefs(item, true);
        // workaround K9 bug with switching to the right panel:
        var prefWin = _getWindowByURI("chrome://komodo/content/pref/pref.xul");
        if (prefWin) prefWin.switchToPanel(item);
    };

    var _RTerminationCallback = function (exitCode) {
        // on Linux the process run in a terminal exits immediately, yet
        // both terminal and R are still running.
        // So need to check whether R is actually closed.
        var connected = sv.rconn.isRConnectionUp(true);
        if (!connected) sv.addNotification("R is closed with code " + exitCode);
        _this.setRStatus(connected);
    };

    this.startR = function () {
        var svfile = sv.file;
        var svstr = sv.string;

        if (!sv.pref.getPref("svRCommand")) {
            if (ko.dialogs.okCancel(
                    sv.translate("R interpreter is not set in " +
                        "Preferences. Would you like to do it now?"),
                    "OK", null, "R interface") == "OK")
                _this.openRPreferences();
            return;
        }

        var rDir = svfile.path("ProfD", "extensions", "komodor@komodor", "R");
        svfile.write(svfile.path(rDir, "_init.R"),
            "setwd('" + svstr.addslashes(sv.command.getCwd(false)) +
            "')\n" + "options(" +
            "ko.port=" + sv.pref.getPref("RInterface.koPort", sv.pref.defaults["RInterface.koPort"]) +
            ", " +
            "ko.R.port=" + sv.pref.getPref("RInterface.RPort", sv.pref.defaults["RInterface.RPort"]) +
            ", " +
            "ko.host=\"localhost\")\n" +
            ".ko.tmp.repos <- getOption(\"repos\"); .ko.tmp.repos[[\"CRAN\"]] <- \"" +
            sv.pref.getPref("CRANMirror") + "\"; " +
            "options(repos = .ko.tmp.repos); rm(.ko.tmp.repos); \n"
        );
        // TODO: use RInterface.RHost

        var cmd = sv.pref.getPref("svRCommand");
        var isWin = navigator.platform.indexOf("Win") === 0;
        var id = sv.pref.getPref("RInterface.runRAs", isWin ? "r-gui" : "r-terminal");
        var env = [];
        switch (id) {
        case "r-tk":
            env.push("Rid=R-tk");
            // Set DISPLAY only when not set:
            var XEnv = Cc["@activestate.com/koEnviron;1"]
                .createInstance(Ci.koIEnviron);
            if (!XEnv.has("DISPLAY")) env.push("DISPLAY=:0");
            XEnv = null;
            break;
        case "r-terminal":
            break;
        default:
        }

        var envStr = env.join("\n");
        var RProcessObserver;

        if (isWin && id == "r-terminal") {
            var runSvc = Cc['@activestate.com/koRunService;1']
                .getService(Ci.koIRunService);
            runSvc.Run(cmd, rDir, envStr, true, '');
            // Observe = 'run_command'
            // subject = 'status_message'
            // data = command
            RProcessObserver = new _ProcessObserver(cmd, false, _RTerminationCallback);
        } else {
            //var process = runSvc.RunAndNotify(cmd, rDir, env, null);
            // Observe = 'run_terminated'
            // subject = child
            // data = command
            //RProcessObserver = new _ProcessObserver(cmd, process, _RTerminationCallback);
            RProcessObserver = this.runSystemCommand(cmd, rDir, envStr,
                _RTerminationCallback);
            this.RProcess = RProcessObserver._process;
        }
        _this.setRStatus(true);
    };

    this.runSystemCommand = function (cmd, cwd, env, terminationCallback) {
        var runSvc = Cc['@activestate.com/koRunService;1']
            .getService(Ci.koIRunService);
        var process = runSvc.RunAndNotify(cmd, cwd, env, null);
        return new _this.ProcessObserver(cmd, process, terminationCallback);
    };

    this.setRStatus = function (running) {
        // Toggle status if no argument
        if (running === undefined)
            running = !_RIsRunning;
        else
            running = Boolean(running);

        if (running != _RIsRunning) {
            _RIsRunning = running;
            // Note: R toolbar button responds to:
            xtk.domutils.fireEvent(window, 'r_app_started_closed');
            // Note: all other buttons/menu items respond to:
            window.updateCommands('r_app_started_closed');
            sv.addNotification(running ? "R is running" : "R is not running", 0, 2000);
        }
    };

    this.openPkgManager = function () {
        var win = _getWindowRef("chrome://komodor/content/pkgman/pkgman.xul",
            "RPkgMgr", "chrome=yes,dependent" +
            "scrollbars=yes,status=no,close,dialog=no,resizable", true, sv);
        return win;
    };

    // sv.command.openHelp - returns reference to the RHelpWindow
    //FIXME: help in tab still buggy
    this.openHelp = function (uri) {
        var RHelpWin = _this.RHelpWin;

        // We will need special treatment in windows
        var isWin = navigator.platform.search(/Win\d+$/) === 0;

        if (uri) {
            // This should hopefully work on all platforms (it does on Win and Linux)
            // First, check if "uri" is an URI already:
            var isUri = uri.search(/^((f|ht)tps?|chrome|about|file):\/{0,3}/) === 0;
            try {
                if (!isUri) {
                    if (isWin) uri = uri.replace(/\//g, "\\");
                    uri = sv.file.toFileURI(uri);
                }
            } catch (e) {
                // fallback
                if (!isUri) uri = "file://" + uri;
            }
        } else {
            try {
                uri = sv.rconn.eval("cat(getHelpURL())");
            } catch (e) {
                uri = sv.pref.getPref('RInterface.rRemoteHelpURL') + 'doc/index.html';
            }
        }

        var rHelpXulUri = "chrome://komodor/content/RHelpWindow.xul";

        _this.RHelpWin = _getWindowByURI(rHelpXulUri);
        if (!RHelpWin || RHelpWin.closed) {
            logger.debug("Starting R help with page " + uri);

            // try/catch here somehow prevented from storing window
            // reference in RHelpWin. No idea why...
            RHelpWin = window.openDialog(rHelpXulUri, "RHelp",
                "chrome=yes,dependent,resizable=yes," +
                "scrollbars=yes,status=no,close,dialog=no", sv, uri);
        } else {
            RHelpWin.go(uri);
        }

        RHelpWin.focus();
        RHelpWin.close = _this.closeHelp;

        _this.RHelpWin = RHelpWin;
        return RHelpWin;
    };

    // Close r-help tab
    this.closeHelp = function () {
        var tabPanel = document.getElementById("rhelpviewbox");
        var tab = document.getElementById("rhelp_tab");
        var tabBox = tabPanel.parentNode.parentNode;

        tabPanel.hidden = true;
        tab.hidden = true;
        tabBox.selectedIndex = ((tabBox.tabs.getIndexOfItem(tab) + 2) %
            tabBox.tabs.itemCount) - 1;
        document.getElementById("rhelpview-frame")
            .setAttribute("src", "about:blank");
        //_this.RHelpWin.closed = true;
    };

    this.setControllers = function _setControllers() {
        //Based on: chrome://komodo/content/library/controller.js
        // backwards compatibility APIs
        if (xtk.Controller instanceof Function)
            xtk.include("controller");

        const XRRunning = 1,
            XRStopped = 2,
            XisRDoc = 4,
            XHasSelection = 8;
        var handlers = {
            'cmd_svOpenPkgManager': ["sv.command.openPkgManager();", XRRunning],
            'cmd_svOpenHelp': ["sv.command.openHelp();", XRRunning],
            'cmd_svOpenRPreferences': ["sv.command.openRPreferences();", -1],

            'cmd_svStartR': ['sv.command.startR();', XRStopped],
            'cmd_svQuitR': ['sv.r.quit();', XRRunning],

            'cmd_svREscape': ['sv.r.escape();', XRRunning],
            'cmd_svRRunAll': ['sv.r.send("all");', XisRDoc | XRRunning],
            'cmd_svRSourceAll': ['sv.r.source("all");', XisRDoc | XRRunning],
            'cmd_svRRunBlock': ['sv.r.send("block");', XisRDoc | XRRunning],
            'cmd_svRRunFunction': ['sv.r.send("function");', XisRDoc | XRRunning],
            'cmd_svRRunLine': ['sv.r.send("line");', XisRDoc | XRRunning],
            'cmd_svRRunPara': ['sv.r.send("para");', XisRDoc | XRRunning],
            'cmd_svRSourceBlock': ['sv.r.source("block");', XisRDoc | XRRunning],
            'cmd_svRSourceFunction': ['sv.r.source("function");', XisRDoc | XRRunning],
            'cmd_svRSourcePara': ['sv.r.source("para");', XisRDoc | XRRunning],
            'cmd_svRRunLineOrSelection': ['sv.r.run();', XisRDoc | XRRunning],
            'cmd_svRSourceLineOrSelection': ['sv.r.source("line/sel");', XisRDoc |
                XRRunning
            ],
            'cmd_svRRunSelection': ['sv.r.send("sel");', XisRDoc | XRRunning |
                XHasSelection
            ],
            'cmd_svRSourceSelection': ['sv.r.source("sel");', XisRDoc | XRRunning |
                XHasSelection
            ],
            'cmd_viewrtoolbar': ['ko.uilayout.toggleToolbarVisibility(\'RToolbar\')', -1]
        };

        var  _isRRunning = () => _RIsRunning;
        var _isRCurLanguage = () => true;
        //{
        //    return true;
        //    // var view = ko.views.manager.currentView;
        //    // if (!view || !view.document) return(false);
        //    // return(view.document.language == sv.langName);
        //}

        var _hasSelection = () => {
            var view = ko.views.manager.currentView;
            if (!view || !view.scimoz) return (false);
            return (view.scimoz.selectionEnd - view.scimoz.selectionStart) != 0;
        }

        var _test = (cmdName) => {
            var test = handlers[cmdName][1];
            if (test < 0) return true;
            return (
                (((test & XRRunning) != XRRunning) || _isRRunning()) && (((test &
                    XRStopped) != XRStopped) || !_isRRunning()) && (((test & XisRDoc) !=
                    XisRDoc) || _isRCurLanguage()) && (((test & XHasSelection) !=
                    XHasSelection) || _hasSelection())
            );
        }

        // From: komodo.jar/controller.js
        // The following controller is for any <command> or <broadcaster>
        // that doesn't fit into any other controller.  It is generally
        // used for commands that don't ever get disabled.

        function broadcasterController() {
            if (typeof (ko.main) != "undefined") {
                ko.main.addWillCloseHandler(this.destructor, this);
            } else {
                // ko.main will not be defined in dialogs that load controller.js.
                var self = this;
                window.addEventListener("unload", function () {
                    self.destructor();
                }, false);
            }
        }

        // The following two lines ensure proper inheritance (see Flanagan, p. 144).
        broadcasterController.prototype = new xtk.Controller();
        broadcasterController.prototype.constructor = broadcasterController;

        broadcasterController.prototype.destructor = function () {
            window.controllers.removeController(this);
        };

        broadcasterController.prototype.isCommandEnabled = function (cmdName) {
            if (cmdName in handlers) return _test(cmdName);
            //if (cmdName in handlers) return true;
            return false;
        };

        broadcasterController.prototype.supportsCommand = broadcasterController.prototype
            .isCommandEnabled;

        broadcasterController.prototype.doCommand = function (cmdName) {
            if (cmdName in handlers) return eval(handlers[cmdName][0]);
            return false;
        };

        window.controllers.appendController(new broadcasterController());

        logger.debug("Controllers has been set.");
    };

    var _str = sString => sString.QueryInterface(Ci.nsISupportsString).data;

    this.getRProc = function (property) {
        if (!property) property = "CommandLine";

        var svUtils = Cc["@komodor/svUtils;1"].createInstance(Ci.svIUtils);
        var procList = svUtils.getproc(property);

        let proc = [];
        while (procList.hasMoreElements()) proc.push(_str(procList.getNext()));
        return proc;
    };

    this.places = {

        get anyRFilesSelected()
        _RIsRunning &&
        ko.places.manager.getSelectedItems().some(
			x => x.file.isLocal && x.file.ext.toLowerCase() == ".r"),

        get anyRDataFilesSelected()
        _RIsRunning &&
        ko.places.manager.getSelectedItems().some(
            x => x.file.isLocal && (x.file.ext || x.file.leafName).toLowerCase() == ".rdata"),

        sourceSelection() {
            if (!_RIsRunning) return;
            let files = ko.places.manager.getSelectedItems()
                .filter(x => (x.file.isLocal && x.file.ext.toLowerCase() == ".r"))
                .map(x => x.file.path);
            if (!files.length) return;
            let cmd = files.map(x => "source('" + sv.string.addslashes(x) + "')").join("\n");
            sv.rconn.evalAsync(cmd, () => sv.rbrowser.refresh(true), false);
        },

        loadSelection() {
            if (!_RIsRunning) return;
            let files = ko.places.manager.getSelectedItems()
                .filter(x => (x.file.isLocal &&
                    // for '.RData', .ext is ''
                    (x.file.ext || x.file.leafName).toLowerCase() == ".rdata"))
                .map(x => x.file.path);
            if (!files.length) return;
            let cmd = files.map(x => "load('" + sv.string.addslashes(x) + "')").join("\n");
            sv.rconn.evalAsync(cmd, () => sv.rbrowser.refresh(true), false);
        },

        setWorkingDir() {
            if (!_RIsRunning) return;

            var path;
            if (ko.places.manager._clickedOnRoot()) {
                if (!ko.places.manager.currentPlaceIsLocal) return;
                path = sv.file.pathFromURI(ko.places.manager.currentPlace);
            } else {
                let dir = ko.places.manager.getSelectedItem();
                if (!dir.file.isLocal || dir.type != "folder") return;
                path = dir.file.path;
            }
            let cmd = "setwd('" + sv.string.addslashes(path) + "')";
            sv.rconn.evalAsync(cmd, () => sv.rbrowser.refresh(true), false);
        }

    }; // end this.places


}).apply(sv.command);