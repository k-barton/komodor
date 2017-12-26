/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  Copyright (c) 2011-2017 Kamil Barton
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */

/*
 *  'sv.rconn' object is an interface to R implemented mostly in python
 *  		The workhorse is 'svUtils' with XPCOM interface
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

    const {
        classes: Cc,
        interfaces: Ci
    } = Components;

    // get string from nsISupportsString
    var _str = sString => sString.QueryInterface(Ci.nsISupportsString).data;

    var connector = Cc["@komodor/svUtils;1"]
        .getService(Ci.svIUtils);
        
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

    var promptStr = { normal: ":>", continued: ":+", browse: "~>" };
    
    var _curPrompt = promptStr.normal, _curCommand = "";
    var _waitMessageTimeout;

    var rxResultStripCtrlChars = /[\x02\x03\x1b]/g;
    var rxResultStripStdErr = /\x03[^\x02]*\x02/g;

    // this ID is used to identify commands from the user
    this.userCommandId = connector.uid();

    // TODO: move to somewhere else....
    this.printResult1 = function (commandInfo) {
        connector.outScimoz = sv.cmdout.scimoz;
        connector.printResult(commandInfo);
    };

    this.printResults = function (result, commandInfo, executed, wantMore) {

        window.clearTimeout(_waitMessageTimeout);

        var msg, command = commandInfo.command;
        
        command = _curCommand + _curPrompt + ' ' + command + sv.cmdout.eolChar;

        let prompt = "";
        if (executed) {
            let newPrompt = wantMore ? promptStr.continued :
                commandInfo.browserMode ? promptStr.browse : promptStr.normal;
            
            prompt = '\n' + newPrompt;
            _curCommand = wantMore ? command : '';
            _curPrompt = newPrompt;
            sv.cmdout.message(null);
        } else {
            result = '';
            prompt = '...';
            msg = 'R is working...';
            // display 'wait message' only for longer operations
            _waitMessageTimeout = window.setTimeout(sv.cmdout.message, 700, msg, 0, false);
        }
        sv.cmdout.print2(command, prompt, executed, commandInfo);
    };

    // get list of running R processes
    this.listRProcesses = function (property = "CommandLine") {
        var procList = connector.getproc(property);
        var proc = [];
        while (procList.hasMoreElements()) proc.push(_str(procList.getNext()));
        return proc;
    };
    
    
    // if stdOut, stderr is removed, else stream delimiters #002/#003 are removed   
    var REvalListener = function (callback, keep, stdOut, args) {
        if (typeof callback === "function") this.callback = callback;
        this.keep = keep;
        this.stdOut = stdOut;
        this.args = Array.apply(null, args);
    };
    
    REvalListener.prototype = {
        callback: null,
        keep: false,
        stdOut: false,
        args: null,
        onDone(result, command, mode) {
            if (this.callback) {
                let args = this.args;
                if (result) result = result.trim();
                // XXX: this is silent about connection errors
                result = result.replace(this.stdOut ? rxResultStripStdErr :
                    rxResultStripCtrlChars, '');

                args.unshift(result);
                try {
                    this.callback.apply(this, args);
                } catch (e) {
                    logger.exception(e);
                }
                //[Exception... "Illegal operation on WrappedNative prototype
                //object" nsresult: "0x8057000c (NS_ERROR_XPC_BAD_OP_ON_WN_PROTO)"]
            }
            //if (mode == "e" || mode == "json")	_this.printResults(result, command, true);
            return this.keep;
        }
    };
    
    this.handlers = {};

    
    // Evaluate in R
    this.evalAsync = function (command, callback, hidden, stdOut, ...args) { //, ...
        if(command === undefined || command == null) 
			throw new Error("'command' is null or undefined");
		// Note: to check if a variable is declared and is not undefined:
		// typeof v == "undefined" 
		//If you know the variable exists, and want to check whether there's 
		// any value stored in it:
		//v === "undefined" 
		
		var handlers = _this.handlers, keep = false, mode = ['json'];
        
        // XXX: background calls (e.g. object browser) need to have unique id.
        // but ID for user commands should be one and fixed (to allow for multiline)
        var id = callback ? connector.uid() : this.userCommandId;
        handlers[id] = new REvalListener(callback, keep, stdOut, args);

        if (hidden) mode.push('h');
        connector.evalInRNotify(command, mode.join(' '), id);
        return id;
    };

    // Evaluate in R instantaneously and return result
    // stdOut - if true, stderr stream is omitted
    this.eval = function (command, timeout = 0.5, stdOut = false) {
		if(command === undefined || command === null) 
			throw new Error("'command' is null or undefined");
		
        var res = connector.evalInR(command, 'json h', timeout);
        if (res[0] === '\x15') 
			throw new Error("(sv.rconn.eval) R command was \"" + command + "\"");
        return res.replace(stdOut ? rxResultStripStdErr : rxResultStripCtrlChars, '');
    };

    // For internal use with repeated commands (result handler is defined only once)
    // reuse result handler predefined with '.defineResultHandler'
    this.evalPredefined = function (command, handlerId, hidden, ...args) {
		if(command === undefined || command == null) 
			throw new Error("'command' is null or undefined");
		
        var handlers = _this.handlers;
        if (handlerId in handlers) {
            handlers[handlerId].args = args;
        } else {
            throw new Error("No handler for id=" + handlerId);
        }
        var mode = ['json'];
        if (hidden) mode.push('h');
        connector.evalInRNotify(command, mode.join(' '), handlerId);
    };

    this.defineResultHandler = function (id, callback, stdOut, ...args) {
        _this.handlers[id] = new REvalListener(callback, true, stdOut, args);
        return id;
    };

    this.escape = function ( /*command*/ ) _this.evalAsync("\x1b");

    this.isRConnectionUp = function (quiet) {
        var connected;
        try {
            var test = _this.eval("base::cat(" + sv.r.arg(ko.version) + ")");
            connected = test.indexOf(ko.version) !== -1;
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
            onStuff: requestHandler
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

    this._sServerObserver = {
        observe: function (subject, topic, data) {
            if (topic == 'r-server-stopped') {
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

    this.getSocketPref = function rConnGetSocketPref(name) {
        return _socketPrefs[name];
    };

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

    //this.printCommandinfo = function(cinfo) {
    //	cinfo.QueryInterface(Ci.svICommandInfo);
    //	var result, prompt, styledResult;
    //	switch (cinfo.message) {
    //		case 'Not ready':
    //			result = '...';
    //			prompt = ':+';
    //		break;
    //		case 'more':
    //		break;
    //		case 'parse-error':
    //		case 'done':
    //		default:
    //			styledResult = cinfo.result? cinfo.styledResult() : '';
    //	}
    //
    //	var scimoz = sv.cmdout.scimoz;
    //	var readOnly = scimoz.readOnly;
    //	if (styledResult) {
    //		scimoz.readOnly = false;
    //		scimoz.addStyledText(styledResult.length, styledResult);
    //		scimoz.readOnly = readOnly;
    //	}
    //}

    //
    //this.print2 = function (commandInfo, command, prompt, done) {
    //	var cmdout = sv.cmdout;
    //////////
    //	function fixEOL(str) str.replace(/(\r?\n|\r)/g, cmdout.eolChar);
    //	var styleNumCode = 22, styleNumResult = 0, styleNumErr = 23;
    ////////////
    //	var scimoz = cmdout.scimoz;
    //	var eolChar = cmdout.eolChar;
    //	cmdout.ensureShown();
    //	command = fixEOL(command);
    //	var readOnly = scimoz.readOnly;
    //	scimoz.readOnly = false;
    //	if (!done) {
    //		cmdout.clear();
    //		command = command.replace(/^ {3}(?= *\S)/gm, ":+ ");
    //		scimoz.appendText(ko.stringutils.bytelength(command), command);
    //		cmdout.styleLines(0, scimoz.lineCount, styleNumCode);
    //	} else {
    //		//alert("Done!");
    //		var lineNum = scimoz.lineCount  - 1;
    //		alert(cmdout.getLine(lineNum) + "*");
    //		if(cmdout.getLine(lineNum).trim() == '...') { //
    //			scimoz.targetStart = scimoz.positionFromLine(lineNum);
    //			scimoz.targetEnd = scimoz.textLength;
    //			scimoz.replaceTarget(0, '***');
    //			var styledResult = commandInfo.styledResult();
    //			//scimoz.addStyledText(styledResult.length, styledResult);
    //			scimoz.addStyledText(ko.stringutils.bytelength(styledResult),
    //				new String(styledResult));
    //		}
    //	}
    //	scimoz.appendText(ko.stringutils.bytelength(prompt), prompt + eolChar);
    //	var lineCount = scimoz.lineCount;
    //	//cmdout.styleLines(lineNum, lineCount - 2);
    //	cmdout.styleLines(lineCount - 2, lineCount - 1, styleNumCode);
    //
    //	var firstVisibleLine = Math.max(scimoz.lineCount - scimoz.linesOnScreen - 1, 0);
    //	scimoz.firstVisibleLine = firstVisibleLine;
    //	scimoz.readOnly = readOnly;
    //}

    var _REvalObserver = {
        observe: function (subject, topic, data) {

            // TODO: use 'subject.result' instead of 'data'
            data = subject.result;

            let wantMore = false;
            switch (topic) {
            case 'r-command-executed':
                let cid = subject.commandId;
                switch (subject.message) {
                case 'more':
                    wantMore = true;
                    break;
                case 'parse-error':
                    break; // Execute handler on parse error? I guess not.
                    //if (cid in _this.handlers && !keep)
                    //delete _this.handlers[cid];
                case 'done':
                    if (cid in _this.handlers) {
                        let keep = _this.handlers[cid]
                            .onDone(data, subject.command, subject.mode);
                        //.onDone(data.replace(/[\x02\x03]/g, ''), // strip control characters
                        if (!keep) delete _this.handlers[cid];
                    }
                    break;
                default:
                    /* falls through */
                }
                /* falls through */
            case 'r-command-sent':
                _this.lastCmdInfo = subject;
                if (subject.mode.split(' ').indexOf('h') === -1) {
                    _this.printResults(data, subject,
                        topic === 'r-command-executed', wantMore);

                    //_this.printResults(data, subject.command,
                    //topic == 'r-command-executed', wantMore);
                    // TODO: use subject.styledResult()
                }
                break;
            case 'r-command-chunk':
                //if (subject.mode == "e")
                //sv.cmdout.append(data, false);
                break;
            default:
            }
        }
    };

    //obsSvc.addObserver(_REvalObserver, "r-command-chunk", false);
    obsSvc.addObserver(_REvalObserver, "r-command-sent", false);
    obsSvc.addObserver(_REvalObserver, "r-command-executed", false);
    obsSvc.addObserver(_this._sServerObserver, 'r-server-stopped', false);

    for (let i in _socketPrefs)
        if (_socketPrefs.hasOwnProperty(i)) {
            _socketPrefs[i] = sv.pref.getPref(i);
            sv.pref.prefset.prefObserverService.addObserver(_prefObserver, i, true);
        }

    _updateSocketInfo();

    this.cleanUp = function sv_conn_debugCleanup() {
        ["r-command-sent", "r-command-executed", "r-command-chunk",
            'r-server-stopped'
        ].forEach(function (notification) {
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
                    var obsEnum = prefObsSvc.enumerateObservers(pref);
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
