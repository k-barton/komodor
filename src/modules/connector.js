/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  Copyright (c) 2011-2018 Kamil Barton
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */

/*
 *  'connector' module implements an interface to R. The workhorse is 'korRConnector' with XPCOM interface.
 * .command (Read only) last command evaluated
 * .result (Read only) last result returned
 * .evalAsync(command, ...) evaluate in R, optional further arguments
 * .eval(command) - do synchronous evaluation in R, return the result
 * .startSocketServer(requestHandler) - optional 'requestHandler' is a function that
 * 		handles the received data and returns a string
 * .stopSocketServer()
 * .isRConnectionUp() - test whether R is available and check connection.
 */

/* globals require */
/* jshint evil: true */

// XXX make modes: user, user-progressive (via file) and internal 

var _W = require("ko/windows").getMain();

var kor = {
    get ui() require("kor/ui"),
    get r() require("kor/r"),
    get prefs() require("kor/prefs"),
    get cmdout() require("kor/cmdout"),
    get version() require("kor/main").version,
    get command() require("kor/main").command,
    get rbrowser() require("kor/main").rbrowser,
    get fireEvent() require("kor/main").fireEvent
};


(function () {
    "use strict";

	const { Cc, Ci, Cu } = require('chrome');
	const XPCOMUtils = Cu.import("resource://gre/modules/XPCOMUtils.jsm").XPCOMUtils;
	var lazySvcGetter = XPCOMUtils.defineLazyServiceGetter.bind(XPCOMUtils);

	var svc = {};
	lazySvcGetter(svc, "Obs", "@mozilla.org/observer-service;1", "nsIObserverService");
	lazySvcGetter(svc, "RConnector", "@komodor/korRConnector;1", "korIRConnector");
	
    var _this = this;
    var logger = require("ko/logging").getLogger("komodoR");
    logger.setLevel(logger.DEBUG);
	
	var addNotification = kor.ui.addNotification, prefs = kor.prefs;

    Object.defineProperties(this, {
        command: {
            get() svc.RConnector.lastCommand
        },
        result: {
            get() svc.RConnector.lastResult
        },
        toString : { value: () => "[object KorConnector]", enumerable: false},
        rConnector: { get() svc.RConnector }
        });

    var rxResultStripCtrlChars = /[\x02\x03\x1b]/g,
        rxResultStripStdErr = /\x03[^\x02]*\x02/g;

    var getUid = () => Date.now().toString(36) + Math.floor(Math.random() * 10e5).toString(36);

    // this ID is used to identify commands from the user
    this.userCommandId = "usr_cmd";

    // if stdOut, stderr is removed, else stream delimiters #002/#003 are removed   
    var REvalListener = function (callback, keep, autoUpdate, stdOut, args) {
        if (typeof callback === "function") this.callback = callback;
        this.keep = keep;
        this.autoUpdate = autoUpdate;
        this.stdOut = stdOut;
        if (!Array.isArray(args)) throw new TypeError("in 'REvalListener': 'args' must be an Array");
        this.args = args;
    };
    
    REvalListener.prototype = {
        callback: null,
        keep: false,
        stdOut: false,
        autoUpdate: false,
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
                    logger.exception(e, "in 'REvalListener.onDone': while invoking callback");
                }
            }
            logger.debug("onDone: autoUpdate=" + this.autoUpdate);
            if(this.autoUpdate) require("kor/main").fireEvent('r-command-executed');
            return this.keep;
        }
    };
    
    this.handlers = new Map();
    
    this.AUTOUPDATE = 1;
    this.HIDDEN = 2;
    
    // Evaluate in R
    this.evalAsync = function (command, callback, hidden, stdOut, ...args) { //, ...
        if(command === undefined || command == null) 
			throw new Error("in 'evalAsync': 'command' is null or undefined");
        
        let autoUpdate = false;
        if(typeof hidden === "number") {
            autoUpdate = (hidden & _this.AUTOUPDATE) === _this.AUTOUPDATE;
            hidden = (hidden & _this.HIDDEN) === _this.HIDDEN;
        } else hidden = Boolean(hidden);
        
        logger.debug("evalAsync: autoUpdate=" + autoUpdate);
		
        // XXX: background calls (e.g. object browser) need to have unique id.
        // ID for user commands should be one and fixed (to allow for multiline)
        var id = callback ? getUid() : this.userCommandId;
         _this.handlers.set(id, new REvalListener(callback, /*keep:*/ false,
            /*autoUpdate*/ autoUpdate, stdOut, args));

        svc.RConnector.evalInRNotify(command, /*mode:*/ "json " + (hidden ? "h " : ""), id);
        return id;
    };

    // Evaluate in R instantaneously and return result
    // stdOut - if true, stderr stream is omitted
    this.eval = function (command, timeout = 0.5, stdOut = false) {
		if(command === undefined || command === null) 
			throw new Error("in 'eval': 'command' is null or undefined");
		
        var res = svc.RConnector.evalInR(command, 'json h', timeout);
        if (res.startsWith('\x15')) {
			logger.debug("in connector.eval: R returned " + res);
			throw new Error("in 'eval': 'command' was \"" + command + "\"");
		}
        return res.replace(stdOut ? rxResultStripStdErr : rxResultStripCtrlChars, '');
    };

    // For internal use with repeated commands (result handler is defined only once)
    // reuse result handler predefined with '.defineResultHandler'
    this.evalPredefined = function (command, handlerId, hidden, ...args) {
		if(command === undefined || command === null) 
			throw new Error("in 'evalPredefined': 'command' is null or undefined");
		
        if (_this.handlers.has(handlerId))
             _this.handlers.get(handlerId).args = args;
        else
            throw new Error("in 'evalPredefined': no handler for id=" + handlerId);
        
        svc.RConnector.evalInRNotify(command, "json " + (hidden ? "h " : ""), handlerId);
    };

    this.defineResultHandler = function (id, callback, autoUpdate, stdOut, ...args) {
        _this.handlers.set(id, new REvalListener(callback, true, autoUpdate, stdOut, args));
        return id;
    };

    this.escape = function ( /*command*/ ) _this.evalAsync("\x1b");

    // TODO: make async
    this.isRConnectionUp = function (quiet) {
        var connected;
        try {
            let test = _this.eval("base::cat(\"nuqneH 'u'\")", 1.0);
            connected = test.contains("nuqneH 'u'");
        } catch (e) {
            connected = false;
        }
        if (!quiet)
             addNotification("R connection test result: " + 
             (connected ? "success" : "cannot connect") + 
             ".");
      
        return connected;
    };

    //_this.setObserver(rCallback, "r-command-executed");

    // handles koCmd requests:
    var defaultRequestHandler = function (str) {
        str = String(str).trim();
        try {
            if (str.startsWith("{js}")) {
                let geval = eval; // equivalent to calling eval in the global scope
                return String(geval(str.substring(4)));
            }
        } catch (e) {
            logger.info("Error while evaluating koCmd request: \n\"" +
                        str + "\":\n" + e);
            return e.message;
        }
        return "Received: {" + str + "}";
    };

	Object.defineProperty(this, 'serverIsUp', {
		get() svc.RConnector.serverIsUp(),
		enumerable: true
	  });

    this.startSocketServer = function (requestHandler) {
        if (!requestHandler) requestHandler = defaultRequestHandler;
        var port = svc.RConnector.startSocketServer({onDone: requestHandler});
        if (!port)
            addNotification('Server could not be started');
        return port;
    };

    this.stopSocketServer = () => svc.RConnector.stopSocketServer();

	this.restartSocketServer = function (requestHandler, callback) {
		if (callback) {
			svc.Obs.addObserver(function _serverStartupCallback(subject, topic) {
				if (topic !== 'r-server-started') return;
				svc.Obs.removeObserver(_serverStartupCallback, "r-server-started", false);
				callback.call(null, subject.QueryInterface(Ci.nsISupportsPRInt32));
			}, "r-server-started", false);
		}
		if (_this.serverIsUp) {
			svc.Obs.addObserver(function _serverRestarter(subject, topic) {
				if (topic !== 'r-server-stopped') return;
				svc.Obs.removeObserver(_serverRestarter, "r-server-stopped", false);
				_this.startSocketServer(requestHandler);
			}, "r-server-stopped", false);
			_this.stopSocketServer();
		} else
			_this.startSocketServer(requestHandler);
	};

    var serverObserver = {
        observe: function (subject, topic, data) {
            logger.info("serverObserver: " + topic);
            if (topic === 'r-server-stopped') {
                 addNotification("Server stopped");
            } else if (topic === 'r-server-started') {
                let port = subject.QueryInterface(Ci.nsISupportsPRInt32).data;
                if (port > 1024) {
                    addNotification("Server started at port " + port);
                    prefs.setPref("RInterface.koPort", port, true, true);
                    _this.evalAsync("base::options(ko.port=" + port + ")", null, true);
                } else
                    logger.warn("serverObserver: on socket start received port #" + port);
                
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
        svc.RConnector.setSocketInfo(_socketPrefs["RInterface.RHost"],
            parseInt(_socketPrefs["RInterface.koPort"]), false);
        svc.RConnector.setSocketInfo(_socketPrefs["RInterface.RHost"],
            parseInt(_socketPrefs["RInterface.RPort"]), true);
    }

    var _prefObserver = {
        observe: function (subject, topic, data) {
            _socketPrefs[topic] = prefs.getPref(topic);
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
                        
                        //logger.debug("rEvalObserver. handler for " + subject.commandId + "=" + handler);

                        let keep = _this.handlers.get(subject.commandId)
                            .onDone.call(handler, subject.result, subject.command, subject.mode);
                        //.onDone(data.replace(/[\x02\x03]/g, ''), // strip control characters
                        if (!keep) _this.handlers.delete(subject.commandId);
                    }
                    break;
                 case 'empty':
                    logger.info("Received empty string from R. Command was: " + subject.command);
                    return;
                default:
                    /* falls through */
                }
                /* falls through */
            case 'r-command-sent':
                //_this.lastCmdInfo = subject; // object not extensible
                if (subject.mode.search(/\bh\b/) === -1) 
                    require("kor/cmdout").displayResults(subject.result, subject, executed, wantMore);
                    // TODO? use subject.styledResult()
                break;
            case 'r-command-chunk':
                //if (subject.mode == "e") require("kor/cmdout").append(subject.result, false);
                break;
            default:
            }
        }
    };

    //Obs.addObserver(rEvalObserver, "r-command-chunk", false);
    svc.Obs.addObserver(rEvalObserver, "r-command-sent", false);
    svc.Obs.addObserver(rEvalObserver, "r-command-executed", false);
    svc.Obs.addObserver(serverObserver, 'r-server-stopped', false);
    svc.Obs.addObserver(serverObserver, 'r-server-started', false);

    for (let i in _socketPrefs)
        if (_socketPrefs.hasOwnProperty(i)) {
            _socketPrefs[i] = prefs.getPref(i);
            prefs.prefset.prefObserverService.addObserver(_prefObserver, i, true);
        }

    _updateSocketInfo();

    this.cleanUp = function () {
        ["r-command-sent", "r-command-executed", "r-command-chunk",
            'r-server-stopped'
        ].forEach((notification) => {
            try {
                var obsEnum = svc.Obs.enumerateObservers(notification);
                while (obsEnum.hasMoreElements()) {
                    let observer = obsEnum.getNext();
                    observer.QueryInterface(Ci.nsIObserver);
                    svc.Obs.removeObserver(observer, notification, false);
                }
            } catch (e) {}
        });

        var prefObsSvc = prefs.prefset.prefObserverService;
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
                    logger.exception(e, "while running 'cleanUp'");
                }
            }
    };

}).apply(module.exports);
