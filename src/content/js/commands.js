/* SciViews-K command functions
 * Define 'sv.command' object
 * Copyright (c) 2009-2015, K. Barton & Ph. Grosjean (phgrosjean@sciviews.org) */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
//if (typeof (sv) == 'undefined') sv = {};
if (typeof (sv.command) == 'undefined') sv.command = {};

// sv.command object constructor
(function () {
    
    const {
        classes: Cc,
        interfaces: Ci
    } = Components;

    var logger = require("ko/logging").getLogger("komodoR");
 //   logger.setLevel(logger.DEBUG);
    
    this.RHelpWin = null; // A reference to the R Help Window
    var _this = this;
    this.RProcess = null;

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

    // Private methods
    function _isRRunning() sv.r.isRunning

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

    _RterminationCallback = function (exitCode) {
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

        if (isWin && id == "r-terminal") {
            var runSvc = Cc['@activestate.com/koRunService;1']
                .getService(Ci.koIRunService);
            runSvc.Run(cmd, rDir, envStr, true, '');
            // Observe = 'run_command'
            // subject = 'status_message'
            // data = command
            RProcessObserver = new _ProcessObserver(cmd, false, _RterminationCallback);
        } else {
            //var process = runSvc.RunAndNotify(cmd, rDir, env, null);
            // Observe = 'run_terminated'
            // subject = child
            // data = command
            //RProcessObserver = new _ProcessObserver(cmd, process, _RterminationCallback);
            RProcessObserver = this.runSystemCommand(cmd, rDir, envStr,
                _RterminationCallback);
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
            running = !sv.r.isRunning;
        else
            running = Boolean(running);

        if (running != sv.r.isRunning) {
            sv.r.isRunning = running;
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

        // Temporary
        //function _isRRunning () true;
        function _isRRunning() sv.r.isRunning

        function _isRCurLanguage() {
            return true;
            // var view = ko.views.manager.currentView;
            // if (!view || !view.document) return(false);
            // return(view.document.language == sv.langName);
        }

        function _hasSelection() {
            var view = ko.views.manager.currentView;
            if (!view || !view.scimoz) return (false);
            return (view.scimoz.selectionEnd - view.scimoz.selectionStart) != 0;
        }

        function _test(cmdName) {
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

    // Set default keybindings from file
    // chrome://komodor/content/default-keybindings.kkf
    // preserving user modified ones and avoiding key conflicts
    // sfx is for platform specific keybindings
    function _setKeybindings(clearOnly, sfx) {

        if (!sfx) sfx = "";
        var kkfContent;
        try {
            kkfContent = sv.file.readURI("chrome://komodor/content/keybindings" + sfx + ".kkf");
        } catch (e) {
            return false;
        }
        if (!kkfContent) return false;

        logger.info("Setting default key bindings.");

        var kbMgr = ko.keybindings.manager;
        if (kbMgr.currentConfiguration == undefined) {
            kbMgr = new ko.keybindings.manager();
        }
        var currentConfiguration = kbMgr.currentConfiguration;

        if (!kbMgr.configurationWriteable(currentConfiguration))
            currentConfiguration = kbMgr.makeNewConfiguration(currentConfiguration + " [+R]");

        //from: gKeybindingMgr.parseConfiguration
        //var bindingRx = /[\r\n]+(# *SciViews|binding cmd_sv.*)/g;

        var bindingStr = kkfContent.match(new RegExp("^binding cmd_.*$", "gm"));
        var schemeKeys = {},
            cmdName, key, cmdNames = [];
        for (let j = 0; j < bindingStr.length; ++j) {
            try {
                [, cmdName, key] = /^binding\s+(\S+)\s+(\S+)$/.exec(bindingStr[j]);
                schemeKeys[cmdName] = key;
                cmdNames.push(cmdName);
            } catch (e) {}
        }

        // upgrade command names if needed:
        cmdNames.forEach((cmdid) => {
            let cmdOld = cmdid.replace(/^cmd_sv/, "cmd_"); // XXX: update cmd_R ==> cmd_svR
            let keyLabel = kbMgr.command2keylabel(cmdOld); // String!
            if (keyLabel) {
                // assignKey-> keysequence2keylabel produces some weird labels like F11,0 fix it here:
                let key = Array.from(kbMgr.command2key[cmdOld]); // clone array
                logger.debug("Upgrading command " + cmdOld + " to " + cmdid + ": key is " + key);
                kbMgr.clearBinding(cmdOld, "", false);
                kbMgr.assignKey(cmdid, key, "");
                kbMgr.command2key[cmdid] = key;
                kbMgr.makeKeyActive(cmdid, key);
            }
        }); // forEach
        kbMgr.saveCurrentConfiguration();

        if (clearOnly) {
            cmdNames.forEach((cmdid) => kbMgr.clearBinding(cmdid, "", false));
        } else {
            cmdNames.forEach((cmdid) => {
                let keySequence = schemeKeys[cmdid].split(/, /);
                let usedBy = kbMgr.usedBy(keySequence);
                if (!usedBy.length) {
                    kbMgr.assignKey(cmdid, keySequence, '');
                    kbMgr.makeKeyActive(cmdid, keySequence);
                    logger.debug("Assigned key sequence " + keySequence.join(", ") + " to command " +
                        cmdid);
                }
            });
        }

        //kbMgr.saveAndApply(ko.prefs);
        kbMgr.saveCurrentConfiguration();
        kbMgr.loadConfiguration(kbMgr.currentConfiguration, true);
        //delete kbMgr;
        return true;
    }

    this.setKeybindings = function (clearOnly, sfx) {
        _setKeybindings(clearOnly, sfx);
    }

    function _str(sString) sString.QueryInterface(Ci.nsISupportsString).data

    this.getRProc = function (property) {
        if (!property) property = "CommandLine";

        var svUtils = Cc["@komodor/svUtils;1"].createInstance(Ci.svIUtils);
        var procList = svUtils.getproc(property);

        proc = [];
        while (procList.hasMoreElements()) proc.push(_str(procList.getNext()));
        return proc;
    };

    this.places = {

        get anyRFilesSelected()
        sv.r.isRunning &&
        ko.places.manager.getSelectedItems().some((x) => x.file.isLocal &&
            x.file.ext.toLowerCase() == ".r"),

        get anyRDataFilesSelected()
        sv.r.isRunning &&
        ko.places.manager.getSelectedItems().some(
            (x) => x.file.isLocal && (x.file.ext || x.file.leafName).toLowerCase() == ".rdata"),

        sourceSelection: function sv_sourcePlacesSelection() {
            if (!sv.r.isRunning) return;
            var files = ko.places.manager.getSelectedItems()
                .filter((x) => (x.file.isLocal && x.file.ext.toLowerCase() == ".r"))
                .map((x) => x.file.path);
            if (!files.length) return;
            var cmd = files.map((x) => "source('" + sv.string.addslashes(x) + "')").join("\n");
            sv.rconn.evalAsync(cmd, () => sv.rbrowser.refresh(true), false);
        },

        loadSelection: function sv_loadPlacesSelection() {
            if (!sv.r.isRunning) return;
            var files = ko.places.manager.getSelectedItems()
                .filter((x) => (x.file.isLocal &&
                    // for '.RData', .ext is ''
                    (x.file.ext || x.file.leafName).toLowerCase() == ".rdata"))
                .map((x) => x.file.path);
            if (!files.length) return;
            var cmd = files.map((x) => "load('" + sv.string.addslashes(x) + "')").join("\n");
            sv.rconn.evalAsync(cmd, () => sv.rbrowser.refresh(true), false);
        },

        setWorkingDir: function sv_setPlacesSelectionAsWorkingDir() {
            if (!sv.r.isRunning) return;

            var path;
            if (ko.places.manager._clickedOnRoot()) {
                if (!ko.places.manager.currentPlaceIsLocal) return;
                path = sv.file.pathFromURI(ko.places.manager.currentPlace);
            } else {
                var dir = ko.places.manager.getSelectedItem();
                if (!dir.file.isLocal || dir.type != "folder") return;
                path = dir.file.path;
            }
            var cmd = "setwd('" + sv.string.addslashes(path) + "')";
            sv.rconn.evalAsync(cmd, function () sv.rbrowser.refresh(true), false);
        }

    };

    //}
    // TODO: move this to sv.onLoad:
    this.onLoad = function ( /*event*/ ) {
        // first run:
        var firstRunPref = "rInterface.firstRunDone";
        if (!ko.prefs.hasPref(firstRunPref) || sv.version != ko.prefs.getStringPref(firstRunPref)) {
            ko.prefs.setStringPref(firstRunPref, sv.version);
            var osName = Cc['@activestate.com/koOs;1'].getService(Ci.koIOs).name;
            if (!_setKeybindings(false, osName)) // use system specific keybindings
                _setKeybindings(false, ''); // fallback - use default
        } // end first run

        var thisWin = self;
        var onLoadIntervalId = setInterval(function () {
            if (!sv.rbrowser) return;
            thisWin.clearInterval(onLoadIntervalId);

            sv.pref.setDefaults(false);
            sv.rconn.startSocketServer();

            _this.setControllers();
            _this.setRStatus(sv.rconn.isRConnectionUp(true));

            if (sv.r.isRunning) sv.rbrowser.refresh();

            // For completions
            var cuih = ko.codeintel.CompletionUIHandler;
            if (cuih) {
                let baseURI = "chrome://komodor/skin/images/";
                //cuih.prototype.types.argument = cuih.prototype.types.interface;
                cuih.prototype.types.environment = cuih.prototype.types.namespace;
                cuih.prototype.types.file = baseURI + "cb_file.png";
                cuih.prototype.types.argument = baseURI + "cb_argument.png";
                cuih.prototype.types.grapharg = baseURI + "cb_graphical_argument.png";
                cuih.prototype.types.dataset = baseURI + "cb_data.png";
            }
        }, 1000);
        _observerSvc.removeObserver(_this.onLoad, "komodo-ui-started");
    };

    // "komodo-post-startup" event in Komodo 9 only. 
    //addEventListener("komodo-post-startup", _this.onLoad, false);
    _observerSvc.addObserver(_this.onLoad, "komodo-ui-started", false);

    // Just in case, run a clean-up before quitting Komodo:
    function svCleanup() sv.rconn.stopSocketServer()

    ko.main.addWillCloseHandler(svCleanup);

    function ObserveR() {
        var el = document.getElementById('cmd_svRStarted');
        if (_isRRunning()) el.setAttribute("checked", "true");
        else el.removeAttribute("checked");
    }
    addEventListener("r_app_started_closed", ObserveR, false);

}).apply(sv.command);