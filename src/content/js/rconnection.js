// 'sv.rconn' object is an interface to R implemented mostly in python
// 		The workhorse is 'svUtils' with XPCOM interface

//.command (Read only) last command evaluated
//.result (Read only) last result returned
//.listRProcesses(property) get information on currently running R processes
//		(property is one of 'Handle','ProcessId' or 'CommandLine'
//.eval(command, ...) evaluate in R, optional further arguments (see below)
//.evalAtOnce(command) - do 'quick' evaluation in R, and
//		return the result
//.startSocketServer(requestHandler) - optional 'requestHandler' is a function that
//		handles the received data and returns a string
//.stopSocketServer()
//.testRAvailability(checkProc) - test whether R is available, check connection and
//		optionally look up running processes

// sv.rconn.svuSvc.lastCommandInfo.result.replace(/\r\n/g, "\\r\\n")
//==============================================================================

sv.rconn = {};

try { // DEBUG
	sv.rconn.cleanUp();
	sv.rconn.cleanUp();
} catch(e) {}

(function() {
var _this = this;

// get string from nsISupportsString
function _str(sString) sString.QueryInterface(Components
	.interfaces.nsISupportsString).data;

var _svuSvc = Components.classes["@komodor/svUtils;1"]
	.getService(Components.interfaces.svIUtils);
var _obsSvc = Components.classes["@mozilla.org/observer-service;1"]
    .getService(Components.interfaces.nsIObserverService);


this.svuSvc = _svuSvc;

//var observers = {};
//var obsCallback = function() { sv.cmdout.append("test")};

this.__defineGetter__ ('command', function () _svuSvc.lastCommand);
this.__defineGetter__ ('result', function () _svuSvc.lastResult);

var _curPrompt = ':>';
var _curCommand = "";
var _waitMessageTimeout;

var rxResultStripCtrlChars = /[\x02\x03\x1b]/g;
var rxResultStripStdErr = /\x03[^\x02]*\x02/g;


// this ID is used to identify commands from the user
this.userCommandId = _svuSvc.uid();

// TODO: move to somewhere else....
this.printResult1 = function(commandInfo) {
	_svuSvc.outScimoz = sv.cmdout.scimoz;
	_svuSvc.printResult(commandInfo);
}


this.printResults = function(result, commandInfo, executed, wantMore) {
	var msg;
	var command = commandInfo.command;
	command = _curCommand + _curPrompt + ' ' + command + sv.cmdout.eolChar;
	window.clearTimeout(_waitMessageTimeout);

	var prompt = '';
	if (executed) {
		var newPrompt = wantMore? ':+' : ':>';
		prompt = '\n' + newPrompt;
		_curCommand = wantMore? command : '';
		_curPrompt = newPrompt;
		sv.cmdout.message(null);
	} else {
		result = '';
		prompt = '...';
		msg = 'R is calculating...';
		// display 'wait message' only for longer operations
		_waitMessageTimeout = window.setTimeout(sv.cmdout.message, 700, msg, 0, false);
	}
	sv.cmdout.print2(command, prompt, executed, commandInfo);
}


// get list of running R processes
this.listRProcesses = function(property) {
	if (!property) property = "CommandLine";
	var procList = _svuSvc.getproc(property);
	var proc = [];
	while(procList.hasMoreElements()) proc.push(_str(procList.getNext()));
	return proc;
}

// Evaluate in R
this.eval = function(command, callback, hidden, stdOut) { //, ...
	var handlers = _this.handlers, keep = false;
	var args = Array.apply(null, arguments);

	// XXX: background calls (e.g. object browser) need to have unique id.
	// but ID for user commands should be one and fixed (to allow for multiline)
	var id = callback? _svuSvc.uid() : this.userCommandId;
	args.splice(0, 4);
	handlers[id] = new _REvalListener(callback, keep, stdOut, args);
	var mode = ['json']; if (hidden) mode.push('h');
	_svuSvc.evalInRNotify(command, mode.join(' '), id);
	return id;
}

// Evaluate in R instantaneously and return result
// stdOut - if true, stderr stream is omitted
this.evalAtOnce = function(command, timeout, stdOut) {
	if(timeout === undefined) timeout = .5;
	if(stdOut === undefined) stdOut = false;
	var res = _svuSvc.evalInR(command, 'json h', timeout);
	if(res[0] == '\x15') throw(new Error("Command was: " + command));
	return res.replace(stdOut ? rxResultStripStdErr : rxResultStripCtrlChars, '');
}

// For internal use with repeated commands (result handler is defined only once)
// reuse result handler predefined with '.defineResultHandler'
this.evalPredefined = function(command, handlerId, hidden) {
	var handlers = _this.handlers;
	var args = Array.apply(null, arguments);
	if(handlerId in handlers) {
		args.splice(0, 3); // remove first 3 items
		handlers[handlerId].args = args;
	} else {
		throw(new Error("No handler with id: " + handlerId));
	}
	var mode = ['json']; if (hidden) mode.push('h');
	_svuSvc.evalInRNotify(command, mode.join(' '), handlerId);
}

this.defineResultHandler = function(id, callback, stdOut) {
	var handlers = _this.handlers;
	var args = Array.apply(null, arguments);
	args.splice(0, 3); // remove first three arguments
	handlers[id] = new _REvalListener(callback, true, stdOut, args);
	return id;
}

this.escape = function(command) _this.eval("\x1b");

//this.testRAvailability = function(checkProc) {
//	var result = _this.evalAtOnce("cat(1)").trim();
//	var connectionUp = result == "1";
//	var rProcess = checkProc? _this.getRProc() : undefined;
//	var rProcessCount = (rProcess == undefined)? -1 : rProcess.length;
//	ret = '';
//	if(!connectionUp) {
//		ret += "Cannot connect to R";
//		if (rProcessCount > 0) {
//			ret += ", but there " + ((rProcessCount > 1)? "are " + rProcessCount
//				+ " R processes": "is one R process") + " running.";
//			result += "\n\nR processes currently running:\n" + rProcess.join("\n");
//		} else if (rProcessCount == 0) {
//			ret += ",  R is not running.";
//		}
//	} else {
//		result = null;
//		ret += "Connection with R successful.";
//	}
//	//ko.dialogs.alert(ret, result, "R connection test");
//	sv.cmdout.append("R connection test:\n" + ret);
//	return connectionUp;
//}

this.testRAvailability = function(checkProc) {
	var connectionUp;
	try {
		var result = _this.evalAtOnce("cat('" + ko.version + "')");
		connectionUp = result.indexOf(ko.version) != -1;
	} catch(e) {
		connectionUp = false;
	}
	var ret = connectionUp? "Connection with R successful." :
		"Cannot connect to R.";
	sv.addNotification("R connection test: " + ret, 0, 1000);
	return connectionUp;
}

//_this.setObserver(rCallbackChunk, "r-command-chunk");
//_this.setObserver(rCallback, "r-command-executed");

// handles koCmd requests:
var defaultRequestHandler = function(str) {
	str = str.trim();
	//sv.cmdout.append("JS request handler:" + str);
	try {
		if (str.indexOf("<<<js>>>") == 0) {
			var result = eval(str.substring(8));
			//sv.cmdout.append("JS request handler result:" + result);
			return result;
		}
		 //else if(str.indexOf("<<<rjsonp>>>") == 0)
			//return sv.rjson.eval(str.substring(12));
	} catch(e) {
		return e.message;
	}
	return "Received: [" + str + "]"; // echo
}

this.__defineGetter__ ('serverIsUp', function () _svuSvc.serverIsUp() );

    //var defaultOpts = {
    //    id: false,
    //    icon: null,
    //    duration: 4000,
    //    from: null, // or ob: {x: 0,y: 0, center: false}
    //    priority: "notification",
    //    classlist: "",
    //    panel: true, /* Whether to add this to the notification panel */
    //    command: false
    //}
	
this.startSocketServer = function(requestHandler) {
	if(!requestHandler) requestHandler = defaultRequestHandler;
	var port = _svuSvc.startSocketServer({onStuff: requestHandler});

	if (!port) {
		sv.addNotification('Server could not be started');
	} else if (port > 0) {
		sv.addNotification('Server started at port ' + port);
		sv.pref.setPref("sciviews.ko.port", port, true, true);
		_this.eval("options(ko.port=" + port + ")", null, true);
		//setTimeout(function() {
			//try {
				//_this.evalAtOnce("options(ko.port=" + port + ")");
			//} catch(e) { }
		//}, 1000);
	}
	return port;
}

var sServerDoRestart = false;

this.stopSocketServer = function() _svuSvc.stopSocketServer();

this.restartSocketServer = function(requestHandler) {
	if (_this.serverIsUp) {
		_this._sServerDoRestart = true;
		_this.stopSocketServer();
	} else {
		_this.startSocketServer(requestHandler);
	}
}

this._sServerObserver = { observe: function(subject, topic, data) {
	if (topic == 'r-server-stopped') {
		if (_this._sServerDoRestart) {
			_this.startSocketServer(); // TODO: use requestHandler
			_this._sServerDoRestart = false;
		}
		sv.addNotification("Server stopped");
	}
}}

var _socketPrefs = {
    "sciviews.r.port": null,
	"sciviews.r.host": null,
    "sciviews.ko.port": null
};

this.socketPrefs = function rConnSocketPrefs(name) {
	return _socketPrefs[name];
};


function _updateSocketInfo() {
	_svuSvc.setSocketInfo(_socketPrefs["sciviews.r.host"],
		parseInt(_socketPrefs["sciviews.ko.port"]), false);
	_svuSvc.setSocketInfo(_socketPrefs["sciviews.r.host"],
		parseInt(_socketPrefs["sciviews.r.port"]), true);
}

var _prefObserver = {
	observe: function(subject, topic, data) {
		_socketPrefs[topic] = sv.pref.getPref(topic);
		_updateSocketInfo();
}}

this.handlers = {};

var _REvalListener = function(callback, keep, stdOut, args) {
	if (typeof callback == "function") this.callback = callback;
	this.keep = keep;
	this.stdOut = stdOut;
	this.args = Array.apply(null, args);
}
_REvalListener.prototype = {
	callback: null,
	keep: false,
	stdOut: false,
	args: null,
	onDone: function(result, command, mode) {
		if (this.callback) {
			args = this.args;
			if(result) result = result.trim();
			// XXX: this is silent about connection errors
			result = result.replace(this.stdOut ? rxResultStripStdErr :
									rxResultStripCtrlChars, '');

			args.unshift(result);
			try{
				this.callback.apply(this, args);
			} catch(e) {
				sv.logger.exception(e);
			}
			//[Exception... "Illegal operation on WrappedNative prototype
			//object" nsresult: "0x8057000c (NS_ERROR_XPC_BAD_OP_ON_WN_PROTO)"]
		}
		//if (mode == "e" || mode == "json")	_this.printResults(result, command, true);
		return this.keep;
	}
}

//this.printCommandinfo = function(cinfo) {
//	cinfo.QueryInterface(Components.interfaces.svICommandInfo);
//	var result, prompt, styledResult;
//	switch (cinfo.message) {
//		case 'Not ready':
//			result = '...';
//			prompt = ':+';
//		break;
//		case 'Want more':
//		break;
//		case 'Parse error':
//		case 'Done':
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
//			//cmdout.styleLines(lineNum, lineCount - 2);
//	cmdout.styleLines(lineCount - 2, lineCount - 1, styleNumCode);
//
//	var firstVisibleLine = Math.max(scimoz.lineCount - scimoz.linesOnScreen - 1, 0);
//	scimoz.firstVisibleLine = firstVisibleLine;
//	scimoz.readOnly = readOnly;
//}

var _REvalObserver = {
	observe: function(subject, topic, data) {

		// TODO: use 'subject.result' instead of 'data'
		data = subject.result;

		var wantMore = false;
		switch(topic) {
			case 'r-command-executed':
				var cid = subject.commandId;
				switch(subject.message) {
				case 'Want more':
					wantMore = true;
					break;
				case 'Parse error':
					break; // Exec handler on parse error? I guess not.
					if (cid in _this.handlers && !keep)
						delete _this.handlers[cid];
				case 'Done':
					if (cid in _this.handlers) {
						var keep = _this.handlers[cid]
							.onDone(data, subject.command, subject.mode);
							//.onDone(data.replace(/[\x02\x03]/g, ''), // strip control characters
						if(!keep) delete _this.handlers[cid];
					}
					break;
				default:
				}
			case 'r-command-sent':
				sv.lastCmdInfo = subject;
				if (subject.mode.split(' ').indexOf('h') == -1) {
					_this.printResults(data, subject,
						topic == 'r-command-executed', wantMore);

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
}

//_obsSvc.addObserver(_REvalObserver, "r-command-chunk", false);
_obsSvc.addObserver(_REvalObserver, "r-command-sent", false);
_obsSvc.addObserver(_REvalObserver, "r-command-executed", false);
_obsSvc.addObserver(_this._sServerObserver, 'r-server-stopped', false);

//_obsSvc.removeObserver(_REvalObserver, "r-command-executed", false);
for(var i in _socketPrefs) {
	_socketPrefs[i] = sv.pref.getPref(i);
	sv.pref.prefset.prefObserverService.addObserver(_prefObserver, i, true);
}

_updateSocketInfo();
this.cleanUp = function sv_conn_debugCleanup() {
	["r-command-sent", "r-command-executed", "r-command-chunk",
	 'r-server-stopped'].forEach(function(notification) {
		try {
			var obsEnum = _obsSvc.enumerateObservers(notification);
			while (obsEnum.hasMoreElements()) {
				var observer = obsEnum.getNext();
				observer.QueryInterface(Components.interfaces.nsIObserver);
				_obsSvc.removeObserver(observer, notification, false);
			}
		} catch(e) {}
	})

	var prefObsSvc = sv.pref.prefset.prefObserverService;
	for(var pref in _socketPrefs) {
		try {
			var obsEnum = prefObsSvc.enumerateObservers(pref);
			while (obsEnum.hasMoreElements()) {
				var observer = obsEnum.getNext();
				observer.QueryInterface(Components.interfaces.nsIObserver);
				prefObsSvc.removeObserver(observer, pref, true);
			}
		} catch(e) { 	alert(e); }
	}
}


}).apply(sv.rconn);

//sv.r.evalAsync = function(cmd, procfun, context) {
//	var args = Array.apply(null, arguments)
//	args.splice(2,  0, true, null, false)
//	sv.rconn.eval.apply(sv.rconn, args)
//}
//sv.r.eval = function(cmd) sv.rconn.eval.call(sv.rconn, cmd)
//sv.r.evalHidden = function(cmd, earlyExit) sv.rconn.eval.call(sv.rconn, cmd)
//

// seems to be no problem with encoding (!!?)
//sv.rconn.eval("cat('pchn¹æ w tê ³ódŸ je¿a i óœm skrzyñ fig')") // Note this is CP1250 encoding
