/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  Copyright (c) 2011-2018 Kamil Barton
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */

/*
 *  'connector' module implements an interface to R. The workhorse is
 *      'korRConnector' with XPCOM interface.
 * .command (Read only) last command evaluated
 * .result (Read only) last result returned
 * .evalAsync(command, ...) evaluate in R, optional further arguments
 * .eval(command) - do synchronous evaluation in R, return the result
 * .startSocketServer(requestHandler) - optional 'requestHandler' is a function
 *      that handles the received data and returns a string
 * .stopSocketServer()
 * .isRConnectionUp() - test whether R is available and check connection.
 */

/* globals require */
/* jshint evil: true */

//TODO: !!! disable all eval* commands for the time of evaluation in R

var _W = require("ko/windows").getMain();

var kor = {
    get ui() require("kor/ui"),
    get r() require("kor/r"),
    get prefs() require("kor/prefs"),
    get cmdout() require("kor/cmdout"),
    get version() require("kor/main").version,
    get command() require("kor/main").command,
    get rbrowser() require("kor/main").rbrowser,
    get fireEvent() require("kor/main").fireEvent,
    get progressBar() require("kor/main").rProgressBar,
    get setProgressBar() require("kor/main").rSetProgressBar,
    get closeProgressBar() require("kor/main").rcloseProgressBar,
    envChangeEvent(env) {
        require("kor/main").fireEvent("r_evalenv_change", {evalEnvName: env});
    },
    setRProps(port, charSet) {
        require("kor/connector").updateProps(null, null, port, charSet);
    }
};


(function () {
    "use strict";

	const { Cc, Ci, Cu } = require('chrome');
	const XPCOMUtils = Cu.import("resource://gre/modules/XPCOMUtils.jsm").XPCOMUtils;
	var lazySvcGetter = XPCOMUtils.defineLazyServiceGetter.bind(XPCOMUtils);

	var svc = {};
	lazySvcGetter(svc, "Obs", "@mozilla.org/observer-service;1", "nsIObserverService");
	lazySvcGetter(svc, "RConnector", "@komodor/korRConnector;1", "korIRConnector");
	
    const fireEvent = require("kor/main").fireEvent;

    const _this = this;
    var logger = require("ko/logging").getLogger("kor/connector");
	
	var addNotification = kor.ui.addNotification/*, prefs = kor.prefs*/;
    
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

    var rxResultStripCtrlChars = /(\x1b[\x02\x03];|\x1b)/g,
        rxResultStripStdErr = /\x1b\x03;[\s\S]*?\x1b\x02;/g;

    var getUid = () => Date.now().toString(36) + Math.floor(Math.random() * 10e5).toString(36);

    // this ID is used to identify commands from the user
    // when no callback is given
    // XXX: must be different than the one defined in kor.r
    this.userCommandId = "usercommand1";

    // if 'stdOut', stderr is removed, else stream delimiters #002/#003 are removed   
    var REvalListener = function (callback, keep, autoUpdate, stdOut, args) {
        if (typeof callback === "function") this.callback = callback;
        this.keep = keep;
        this.autoUpdate = Boolean(autoUpdate);
        this.stdOut = Boolean(stdOut);
        if (!Array.isArray(args))
            throw new TypeError("in 'REvalListener': 'args' must be an Array");
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
            logger.debug("[onDone] autoUpdate=" + this.autoUpdate);
            //if(this.autoUpdate) fireEvent('r_command_executed');
            return this.keep;
        }
    };
    
    this.handlers = new Map();
    
    this.AUTOUPDATE = 1;
    this.HIDDEN = 2;
    this.REALTIME = 4;
    this.STDOUT = 8;

    this.defineResultHandler = function (id, callback, autoUpdate, stdOut, ...args) {
        _this.handlers.set(id, new REvalListener(callback, true /*keep*/,
            autoUpdate, stdOut, args));
        return id;
    };
    
    // Evaluate in R
    // 'hidden' passed as a number controls visibility, autoupdate, and 
    //    real-time mode
    // 'callback' is either a function or an id string for predefined handler
    //            or null for user command.
    // evalAsync(command, id, hidden, ...)
    // evalAsync(command, null, AUTOUPDATE | REALTIME, ...)
    // evalAsync(command, func(), true, ...)
   
    this.evalAsync = function (command, callback, flags, ...args) { //, ...
        if(command === undefined || command == null) 
			throw new Error("in 'evalAsync': 'command' is null or undefined");
        
        var autoUpdate = false, realTime = false, stdOut = false, hidden;
        if(typeof flags === "number") {
            autoUpdate = (flags & _this.AUTOUPDATE) === _this.AUTOUPDATE;
            realTime = (flags & _this.REALTIME) === _this.REALTIME;
            stdOut = (flags & _this.STDOUT) === _this.STDOUT;
            hidden = (flags & _this.HIDDEN) === _this.HIDDEN;
        } else {
            hidden = Boolean(flags);
        }
        logger.debug("evalAsync: autoUpdate=" + autoUpdate + "\nR command: " + command);
		
        // XXX: background calls (e.g. object browser) need to have unique id.
        // ID for user commands should be one and fixed (to allow for multiline)  
        var userCommand = !callback;
        var id = userCommand ? this.userCommandId : getUid();
        
        // TODO: if(userCommand) use predefined handler with callback reading
        // the output file to console
        if(typeof callback === "string") {
            id = callback;
            let handler = _this.handlers.get(id);
            if (handler) {
                handler.args = args;
                //handler.autoUpdate = autoUpdate; // should autoupdate be set here?
            } else
                throw new Error("in 'evalAsync': no handler for id=" + id);
        } else {
            _this.handlers.set(id, new REvalListener(callback, /*keep:*/ false,
                autoUpdate, stdOut, args));
        }
        svc.RConnector.evalInRNotify(command,
            /*mode:*/ (hidden ? "h " : "") + (realTime ? "r " : ""),
            id);
        return id;
    };

    // Evaluate in R instantaneously and return result
    // stdOut - if true, stderr stream is omitted
    this.eval = function (command, timeout = 0.5, stdOut = false) {
		if(command === undefined || command === null) 
			throw new Error("in 'eval': 'command' is null or undefined");
		
        var res = svc.RConnector.evalInR(command, 'h', timeout);
        if (res.startsWith('\x15\x15')) {
			logger.debug("[connector.eval] R returned " + res.substr(2));
			throw new Error("in 'eval': 'command' was \"" + command + "\"");
		}
        return res.replace(stdOut ? rxResultStripStdErr : rxResultStripCtrlChars, '');
    };

    // For internal use with repeated commands (result handler is defined only once)
    // reuse result handler predefined with '.defineResultHandler'
    this.evalPredefined = function (command, handlerId, hidden, ...args) {
		logger.info("'evalPredefined' is DEPRECATED. Use 'evalAsync' instead.");
        _this.evalAsync(command, handlerId, hidden, ...args);
    };

    this.escape = function ( /*command*/ ) _this.evalAsync("\x05\x11");

    // TODO: make async
    this.isRConnectionUp = function (quiet) {
        var connected;
        try {
            let test = _this.eval("base::cat(\"nuqneH 'u'\")", 1.5);
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
    
    //TODO: predefined handler for RLinter
    //TODO: orphaned handlers collection

    // handles koCmd requests:
    var defaultRequestHandler = function (str) {
        str = String(str).trim();
        var geval = eval; // equivalent to calling 'eval' in the global scope
        
        try {
            if (str.startsWith("{js}"))
                return String(geval(str.substring(4)));
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
			svc.Obs.addObserver(function _serverStartupCallback(subject, topic, data) {
				if (topic !== 'r-server-started') return;
				svc.Obs.removeObserver(_serverStartupCallback, topic, false);
				callback.call(null, JSON.parse(data).port);
			}, "r-server-started", false);
		}
		if (_this.serverIsUp) {
			svc.Obs.addObserver(function _serverRestarter(subject, topic) {
				if (topic !== 'r-server-stopped') return;
				svc.Obs.removeObserver(_serverRestarter, topic, false);
				_this.startSocketServer(requestHandler);
			}, "r-server-stopped", false);
			_this.stopSocketServer();
		} else
			_this.startSocketServer(requestHandler);
	};

    var _props = { host: '127.0.0.1', rPort: 8001, koPort: 7001, charSet: 'CP1252' };
	
    this.getProp = (name) => _props[name];
    
    this.updateProps = function(koPort, rHost, rPort, charSet) {
        logger.debug(`updateProps(${koPort}, ${rHost}, ${rPort}, ${charSet})`);
        if(koPort) _props.koPort = koPort;
        if(rHost) _props.host = rHost;
        if(rPort) _props.rPort = rPort;
        svc.RConnector.setSocketInfo(_props.host, _props.koPort, _props.rPort);
        if(charSet) {
            _props.charSet = charSet.toUpperCase();
            svc.RConnector.setCharSet(_props.charSet);
        }
    };

    var serverObserver = {
        observe: function (subject, topic, data) {
            logger.info("serverObserver: " + topic);
            if (topic === 'r-server-stopped') {
                 addNotification("Server stopped");
            } else if (topic === 'r-server-started') {
                let port = JSON.parse(data).port;
                if (port > 1024) {
                    addNotification("Server started at port " + port);
                    _this.updateProps(port, null, null, null);
                    _this.evalAsync("base::options(ko.port=" + port + ")", null, true);
                } else
                    logger.warn("[serverObserver] on socket start received port #" + port);
            }
        }
    };

    var executeHandlerFor = (info) => {
        var keep, autoUpdate;
        var handler = _this.handlers.get(info.id);
        if (handler) {
            logger.debug("[evalAsync] " + (handler.callback ?
                "callback length=" + handler.callback.length : "no callback"));
            autoUpdate = handler.autoUpdate;
            keep = handler.onDone.call(handler, info.result, info.command, info.mode);
            if (!keep) _this.handlers.delete(info.id);
            return autoUpdate;
        }
        return null;
    };
    
   
    var rEvalObserver = {
        observe: function (subject, topic, data) {
            // subject is a commandInfo object
            logger.debug("[rEvalObserver.observe] topic=" + topic + 
                " subject.mode=" + subject.mode);

            let wantMore = false, executed = false,
                hidden = subject.mode.contains("h"), outputFile = false;
            switch (topic) {
            case 'r-command-executed':
                executed = true;
                let autoUpdate = false;
                switch (subject.message) {
                case 'more':
                    wantMore = true;
                    executeHandlerFor(subject);
                    break;
                case 'parse-error':
                    executeHandlerFor(subject);
                    break;
                case 'file':
                    outputFile = true;
                    /* falls through */
                case 'done':
                    autoUpdate = executeHandlerFor(subject);
                    break;
                 case 'empty':
                    logger.info("Empty string received from R. Command was: " + subject.command);
                    return;
                default:
                    logger.error("in 'rEvalObserver': Unknown message type received from R: " + subject.message);
                    return;
                    /* falls through */
                }
                fireEvent('r_command_executed', { 
                    info: subject, // is a commandInfo object
                    uid: subject.uid,
                    wantMore: wantMore,
                    browserMode: subject.browserMode,
                    hidden: hidden,
                    autoUpdate: autoUpdate && !outputFile,
                    isOutputFile: outputFile,
                    fileEncoding: outputFile ? _this.getProp("charSet") : "",
                    });
                break;
            case 'r-command-sent':
                // XXX: Upon sending a hidden commands r_command_sent event is
                //      NOT fired
                if(!hidden)
                    fireEvent('r_command_sent', {
                        uid: subject.uid,
                        command: subject.command,
                        // hidden: hidden
                        });
                break;
            default:
            }
        }
    }; // rEvalObserver

    //Obs.addObserver(rEvalObserver, "r-command-chunk", false);
    svc.Obs.addObserver(rEvalObserver, "r-command-sent", false);
    svc.Obs.addObserver(rEvalObserver, "r-command-executed", false);
    svc.Obs.addObserver(serverObserver, 'r-server-stopped', false);
    svc.Obs.addObserver(serverObserver, 'r-server-started', false);

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
    };

}).apply(module.exports);
