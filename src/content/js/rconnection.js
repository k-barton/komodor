/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  Copyright (c) 2011-2018 Kamil Barton
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */

/*
 *  'sv.rconn' object is an interface to R implemented mostly in python
 *  		The workhorse is 'korRConnector' with XPCOM interface
 * .command (Read only) last command evaluated
 * .result (Read only) last result returned
 * .listRProcesses(property) get information on currently running R processes
 * 		(property is one of 'Handle','ProcessId' or 'CommandLine'
 * .evalAsync(command, ...) evaluate in R, optional further arguments (see below)
 * .eval(command) - do synchronous evaluation in R, and return the result
 * .startSocketServer(requestHandler) - optional 'requestHandler' is a function that
 * 		handles the received data and returns a string
 * .stopSocketServer()
 * .isRConnectionUp(checkProc) - test whether R is available, check connection and
 * 		optionally look up running processes
 *  sv.rconn.svuSvc.lastCommandInfo.result.replace(/\r\n/g, "\\r\\n")
 */

// requires sv.utils (sv.cmdout), sv.pref
 
/* globals sv, ko, require, Components */
/* jshint evil: true */


sv.rconn = {};

(function () {
    var _this = this;

    var logger = require("ko/logging").getLogger("komodoR");
    logger.setLevel(logger.DEBUG);

    const {
        classes: Cc,
        interfaces: Ci
    } = Components;

    // get string from nsISupportsString
    var _str = sString => sString.QueryInterface(Ci.nsISupportsString).data;

    var connector = Cc["@komodor/korRConnector;1"].getService(Ci.korIRConnector);
        
    var obsSvc = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);

    this.rConnector = connector;

    //var observers = {};
    //var obsCallback = function() { sv.cmdout.append("test")};
    Object.defineProperties(this, {
        command: {
            get: () => connector.lastCommand
        },
        result: {
            get: () => connector.lastResult
        }});

    var rxResultStripCtrlChars = /[\x02\x03\x1b]/g,
        rxResultStripStdErr = /\x03[^\x02]*\x02/g;

    var getUid = () => Date.now().toString(36) + Math.floor(Math.random() * 10e5).toString(36);

    // this ID is used to identify commands from the user
    this.userCommandId = "usr_cmd";

    // if stdOut, stderr is removed, else stream delimiters #002/#003 are removed   
    var REvalListener = function (callback, keep, stdOut, args) {
        if (typeof callback === "function") this.callback = callback;
        this.keep = keep;
        this.stdOut = stdOut;
        if (!Array.isArray(args)) throw new TypeError("'args' must be an Array");
        this.args = args;
    };
    
    REvalListener.prototype = {
        callback: null,
        keep: false,
        stdOut: false,
        args: [],
        thisArg: null,
        onDone(result, command, mode) {
            if (this.callback) {
                let args = this.args;
                if (result) result = result.trim();
                // XXX: this is silent about connection errors
                result = result.replace(this.stdOut ? rxResultStripStdErr :
                    rxResultStripCtrlChars, '');

                args.unshift(result);
                try {
                    this.callback.apply(this.thisArg, args); // XXX pass thisArg from eval*
                } catch (e) {
                    logger.exception(e, "applying callback in REvalListener.onDone");
                }
            }
            return this.keep;
        }
    };
    
    this.handlers = new Map();
    
    // Evaluate in R
    this.evalAsync = function (command, callback, hidden, stdOut, ...args) { //, ...
        if(command === undefined || command == null) 
			throw new Error("'command' is null or undefined");
		
        // XXX: background calls (e.g. object browser) need to have unique id.
        // ID for user commands should be one and fixed (to allow for multiline)
        var id = callback ? getUid() : this.userCommandId;
         _this.handlers.set(id, new REvalListener(callback, /*keep:*/ false, stdOut, args));

        connector.evalInRNotify(command, /*mode:*/ "json " + (hidden ? "h " : ""), id);
        return id;
    };

    // Evaluate in R instantaneously and return result
    // stdOut - if true, stderr stream is omitted
    this.eval = function (command, timeout = 0.5, stdOut = false) {
		if(command === undefined || command === null) 
			throw new Error("'command' is null or undefined");
		
        var res = connector.evalInR(command, 'json h', timeout);
        if (res.startsWith('\x15')) 
			throw new Error("in sv.rconn.eval: R command was \"" + command + "\"");
        return res.replace(stdOut ? rxResultStripStdErr : rxResultStripCtrlChars, '');
    };

    // For internal use with repeated commands (result handler is defined only once)
    // reuse result handler predefined with '.defineResultHandler'
    this.evalPredefined = function (command, handlerId, hidden, ...args) {
		if(command === undefined || command === null) 
			throw new Error("'command' is null or undefined");
		
        if (_this.handlers.has(handlerId))
             _this.handlers.get(handlerId).args = args;
        else
            throw new Error("No handler for id=" + handlerId);
        
        connector.evalInRNotify(command, "json " + (hidden ? "h " : ""), handlerId);
    };

    this.defineResultHandler = function (id, callback, stdOut, ...args) {
        _this.handlers.set(id, new REvalListener(callback, true, stdOut, args));
        return id;
    };

    this.escape = function ( /*command*/ ) _this.evalAsync("\x1b");

    this.isRConnectionUp = function (quiet) {
        var connected;
        try {
            let test = _this.eval("base::cat(" + sv.r.arg(ko.version) + ")");
            connected = test.contains(ko.version);
        } catch (e) {
            connected = false;
        }
        if (!quiet)
             sv.addNotification("R connection test result: " + 
             (connected ? "success" : "cannot connect") + 
             ".");
      
        return connected;
    };

    //_this.setObserver(rCallbackChunk, "r-command-chunk");
    //_this.setObserver(rCallback, "r-command-executed");

    // handles koCmd requests:
    var defaultRequestHandler = function (str) {
        str = str.trim();
        try {
            if (str.startsWith("{js}")) 
                return eval(str.substring(4));
        } catch (e) {
            logger.exception(e, "koCmd request was: \n" + str);
            return e.message;
        }
        return "Received: [" + str + "]"; // echo
    };

	Object.defineProperty(this, 'serverIsUp', {
		get: function() connector.serverIsUp(),
		enumerable: true
	  });

    this.startSocketServer = function (requestHandler) {
        if (!requestHandler) requestHandler = defaultRequestHandler;
        var port = connector.startSocketServer({
            onDone: requestHandler
        });

        if (!port) {
            sv.addNotification('Server could not be started');
        } else if (port > 0) {
            sv.addNotification('Server started at port ' + port);
            sv.pref.setPref("RInterface.koPort", port, true, true);
            _this.evalAsync("base::options(ko.port=" + port + ")", null, true);
        }
        return port;
    };

    this.stopSocketServer = function () connector.stopSocketServer();

    this.restartSocketServer = function (requestHandler) {
        if (_this.serverIsUp) {
            _this._sServerDoRestart = true;
            _this.stopSocketServer();
        } else {
            _this.startSocketServer(requestHandler);
        }
    };

    var serverObserver = {
        observe: function (subject, topic, data) {
            if (topic === 'r-server-stopped') {
                if (_this._sServerDoRestart) {
                    _this.startSocketServer(); // TODO: use requestHandler
                    _this._sServerDoRestart = false;
                }
                sv.addNotification("Server stopped");
            }
        }
    };

    var _socketPrefs = {
        "RInterface.RPort": null,
        "RInterface.RHost": null,
        "RInterface.koPort": null
    };

    this.getSocketPref = (name) => _socketPrefs[name];

    function _updateSocketInfo() {
        connector.setSocketInfo(_socketPrefs["RInterface.RHost"],
            parseInt(_socketPrefs["RInterface.koPort"]), false);
        connector.setSocketInfo(_socketPrefs["RInterface.RHost"],
            parseInt(_socketPrefs["RInterface.RPort"]), true);
    }

    var _prefObserver = {
        observe: function (subject, topic, data) {
            _socketPrefs[topic] = sv.pref.getPref(topic);
            _updateSocketInfo();
        }
    };

    var rEvalObserver = {
        observe: function (subject, topic, data) {
            logger.debug("rEvalObserver.observe - " + topic);

            let wantMore = false, executed = false;
            switch (topic) {
            case 'r-command-executed':
                executed = true;
                switch (subject.message) {
                case 'more':
                    wantMore = true;
                    break;
                case 'parse-error':
                    break; // Currently no handlers for parse error 
                case 'done':
                    if (_this.handlers.has(subject.commandId)) {

                        let handler = _this.handlers.get(subject.commandId);
                        
                        logger.debug("rEvalObserver. handler for " + subject.commandId + "=" + handler);

                        let keep = _this.handlers.get(subject.commandId)
                            .onDone.call(handler, subject.result, subject.command, subject.mode);
                        //.onDone(data.replace(/[\x02\x03]/g, ''), // strip control characters
                        if (!keep) _this.handlers.delete(subject.commandId);
                    }
                    break;
                default:
                    /* falls through */
                }
                /* falls through */
            case 'r-command-sent':
                _this.lastCmdInfo = subject;
                if (subject.mode.search(/\bh\b/) === -1) 
                    sv.cmdout.displayResults(subject.result, subject, executed, wantMore);
                    // TODO? use subject.styledResult()
                break;
            case 'r-command-chunk':
                //if (subject.mode == "e") sv.cmdout.append(subject.result, false);
                break;
            default:
            }
        }
    };

    //obsSvc.addObserver(rEvalObserver, "r-command-chunk", false);
    obsSvc.addObserver(rEvalObserver, "r-command-sent", false);
    obsSvc.addObserver(rEvalObserver, "r-command-executed", false);
    obsSvc.addObserver(serverObserver, 'r-server-stopped', false);

    for (let i in _socketPrefs)
        if (_socketPrefs.hasOwnProperty(i)) {
            _socketPrefs[i] = sv.pref.getPref(i);
            sv.pref.prefset.prefObserverService.addObserver(_prefObserver, i, true);
        }

    _updateSocketInfo();

    this.cleanUp = function sv_conn_debugCleanup() {
        ["r-command-sent", "r-command-executed", "r-command-chunk",
            'r-server-stopped'
        ].forEach((notification) => {
            try {
                var obsEnum = obsSvc.enumerateObservers(notification);
                while (obsEnum.hasMoreElements()) {
                    let observer = obsEnum.getNext();
                    observer.QueryInterface(Ci.nsIObserver);
                    obsSvc.removeObserver(observer, notification, false);
                }
            } catch (e) {}
        });

        var prefObsSvc = sv.pref.prefset.prefObserverService;
        for (let pref in _socketPrefs)
            if (_socketPrefs.hasOwnProperty(pref)) {
                try {
                    let obsEnum = prefObsSvc.enumerateObservers(pref);
                    while (obsEnum.hasMoreElements()) {
                        let observer = obsEnum.getNext();
                        observer.QueryInterface(Ci.nsIObserver);
                        prefObsSvc.removeObserver(observer, pref, true);
                    }
                } catch (e) {
                    logger.exception(e, "while cleaning up 'sv.rconn'");
                }
            }
    };

}).apply(sv.rconn);
