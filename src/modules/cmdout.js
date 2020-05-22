'use strict';

/* globals require, module  */

(function () {
    
    var _W = require("ko/windows").getMain();
    const { Cc, Ci, Cu } = require('chrome');
    
    var logger = require("ko/logging").getLogger("kor/cmdout");
    
    var XPCOMUtils = Cu.import("resource://gre/modules/XPCOMUtils.jsm").XPCOMUtils;
    var lazySvcGetter = XPCOMUtils.defineLazyServiceGetter.bind(XPCOMUtils);
    
    var svc = {};
    lazySvcGetter(svc, "Obs", "@mozilla.org/observer-service;1", "nsIObserverService");
    //lazySvcGetter(svc, "SysUtils", "@activestate.com/koSysUtils;1", "koISysUtils");
    lazySvcGetter(svc, "SmX", "@komodor/korScimozUtils;1", "korIScimozUtils");

    //Cc["@komodor/korScimozUtils;1"].getService(Ci.korIScimozUtils);

    
    const timers = require("sdk/timers"), prefs = require("ko/prefs");
    
    var _this = this, ko = _W.ko, _scimoz, _outputWindow;
    var getEOLChar = (scimoz) => ["\r\n", "\r", "\n"][scimoz.eOLMode];
    var _init;
    const promptStr = { normal: ":>", continued: ":+", browse: "~>"};

	Object.defineProperties(this, {
          STYLE_STDIN: { value: 22, enumerable: true }, 
          STYLE_STDOUT: { value: 0, enumerable: true }, 
          STYLE_STDERR: { value: 1, enumerable: true } // was 23
    });
    
    _init = () => {
        var scimoz = _this.scimoz;

        //Get color from the color scheme: stdin, stdout, stderr
        //var prefset = Cc["@activestate.com/koPrefService;1"].getService(Ci.koIPrefService).prefs;
        var schemeName = prefs.getStringPref('editor-scheme');
        var currentScheme = Cc['@activestate.com/koScintillaSchemeService;1']
            .getService().getScheme(schemeName);

        var _hexstr2rgb = (hex)  => {
            var colorref = parseInt(hex.substr(1), 16);
            return (colorref >> 16 & 255) | (colorref & 65280) | ((colorref & 255) << 16);
        };
        var styleSetFore = (style, clr) => {
            scimoz.styleSetFore(_this[style], _hexstr2rgb(currentScheme.getFore("", clr)));
        };

        styleSetFore("STYLE_STDIN", "stdin");
        styleSetFore("STYLE_STDERR", "stderr");
        styleSetFore("STYLE_STDOUT", "stdout");
    };
    
    Object.defineProperties(this, {
        outputWindow: {
            get() {
                if (typeof _outputWindow !== "object")
                    _outputWindow = ko.widgets.getWidget("runoutput-desc-tabpanel")
                        .contentDocument.getElementById("runoutput-scintilla");
                return _outputWindow;
            }   
        },
        scimoz: {
            get() {
                try {
                   // _scimoz.QueryInterface(Ci.ISciMoz);
                   typeof _scimoz.SC_CHARSET_DEFAULT === "number"; // jshint ignore: line
                } catch (e) {
                    _scimoz = _this.outputWindow.scimoz;
                    _init();
                }
                return _scimoz;
            },
            enumerable: true
        },
        // TODO: wrap at 'edgeColumn'
        width: {
            get() {
            let w = _this.outputWindow.clientWidth - 25 /* ~scrollbar*/;
            if (_this.scimoz.getMarginWidthN(2) > 0)
                w -= _this.scimoz.textWidth(_this.scimoz.STYLE_LINENUMBER, "9999");
            
            return Math.floor(w / _this.scimoz.textWidth(_this.scimoz.STYLE_DEFAULT, "X")) - 1;
        
        }, enumerable: true },
        eOLChar: { get() getEOLChar(_this.scimoz), enumerable: true },
        toString: { value() "[object KorCmdout]" }
    });
    
    var fixEOL = str => String(str).replace(/(\r?\n|\r)/g, _this.eOLChar);

    svc.Obs.addObserver({
        observe: _init
    }, 'scheme-changed', false);

    this.print = function (str) {
        this.clear();
        this.append(str, true, false);
    };
    
    this.ensureShown = function () {
        ko.widgets.getPaneAt('workspace_bottom_area').collapsed = false;
        ko.uilayout.ensureTabShown("runoutput-desc-tabpanel", false);
    };
    
    this.replaceLine = function (text, lineNum = null, eol = true) {
        var scimoz = this.scimoz;
        text = text.toString();
        if(lineNum === null)
            lineNum = scimoz.lineCount - 1;
        
        var readOnly = scimoz.readOnly;
        try {
            scimoz.targetStart = scimoz.positionFromLine(lineNum);
            scimoz.targetEnd = scimoz.getLineEndPosition(lineNum) +
                (eol ? _this.eOLChar.length : 0);
            scimoz.replaceTarget(text.length, text);
        } catch (e) {
            Cu.reportError("in CmdOut.replaceLine(...): \n" + e);
        } finally {
            scimoz.readOnly = readOnly;
        }
    };

    this.replace = function (text, lineNum = null) {
        var p0, scimoz = this.scimoz;
        if(lineNum === null) lineNum = scimoz.lineCount - 1;
        scimoz.targetStart = p0 = scimoz.positionFromLine(lineNum);
        scimoz.targetEnd = p0 + text.length;
        scimoz.replaceTarget(text.length, text);
    };    

    this.append = function (str, newline = true, scrollToStart = false) {
        var scimoz = this.scimoz;
        svc.SmX.scimoz = scimoz;
        this.ensureShown();
        str = fixEOL(str.toString());
        var lineCountBefore = scimoz.lineCount;
        if (newline) str += this.eOLChar;
        var readOnly = scimoz.readOnly;
        try {
            scimoz.readOnly = false;
            svc.SmX.appendText(str);
        } catch (e) {
            Cu.reportError("in CmdOut.append(...): \n" + e);
        } finally {
            scimoz.readOnly = readOnly;
        }

        var firstVisibleLine;
        if (!scrollToStart) 
            firstVisibleLine = Math.max(scimoz.lineCount - scimoz.linesOnScreen, 0);
        else
            firstVisibleLine = Math.min(lineCountBefore - 1, scimoz.lineCount - scimoz.linesOnScreen);
        
        scimoz.firstVisibleLine = firstVisibleLine;
    };

    this.getLine = function(lineNumber) {
        var scimoz = this.scimoz, lineCount = scimoz.lineCount;
        if (lineNumber === undefined) lineNumber = lineCount - 1;
        while (lineNumber < 0) lineNumber = lineCount + lineNumber;
        var oLine = {};
        scimoz.getLine(lineNumber, oLine);
        return oLine.value;
    };

    this.styleLines = function (startLine, endLine, styleNum) {
        _init();
        let scimoz = _this.scimoz;

        if (startLine === null) startLine = 0;
        if (endLine === null) endLine = scimoz.lineCount;
        let styleMask = (1 << scimoz.styleBits) - 1;
        let readOnly = scimoz.readOnly;
        scimoz.readOnly = false;

        // all lines in the provided style
        let startPos = scimoz.positionFromLine(startLine);
        let endPos = scimoz.getLineEndPosition(endLine - 1) + _this.eOLChar.length;
        scimoz.startStyling(startPos, styleMask);
        scimoz.setStyling(endPos - startPos, styleNum);
        scimoz.readOnly = readOnly;
    };

    // Clear text in the Output Command pane
    this.clear = function () {
        var scimoz = _this.scimoz;
        var readOnly = scimoz.readOnly;
        try {
            scimoz.readOnly = false;
            scimoz.clearAll();
        } finally {
            scimoz.readOnly = readOnly;
        }
    };

    this.printStyled = function (str, newline = true, replace = false, lineNum = -1) {
        if (newline) str += _this.eOLChar;
        svc.SmX.printWithMarks(str, replace, lineNum); //(s, replace = False, lineNum = None)
    };
     
    this.printLines = function (text, nl = true) {
        svc.SmX.scimoz = _this.scimoz;
        const rx = /(\r\n|\r|\n)/g;
        var p = 0, pend, line, a;
        while ((a = rx.exec(text)) !== null) {
            pend = rx.lastIndex;
            line = text.substring(p, pend - a[0].length);
            //print((nl ? "LF" : "CR") + ": " + line);
            _this.printStyled(line, nl, !nl, nl ? null : -2);
            p = pend;
            nl = a[0] !== "\r";
        }
        if(p < text.length) {
            line = text.substring(p, text.length);
            _this.printStyled(line, false, !nl, nl ? null : -2);
        }
        return nl;
    };
    
    var _waitMessageTimeout;
        
    svc.Obs.addObserver({
        observe: (subject, topic, data) => {
            logger.debug("finished monitoring of " + data);
            try {
                var file = require("kor/fileutils").getLocalFile(data);
                //if(file.exists()) file.fileSize = 0;
                if(file.exists()) file.remove(true);
            } catch(e) {
            }
            //_this.printResult2(false, false, true);
            queuedPrint();
            timers.clearTimeout(_waitMessageTimeout);
            _this.statusBarMessage(null);
        }
    }, "file-reading-finished", false);

    this.monitorFile = function(filename, encoding) {
        if(svc.SmX.scimoz === null) svc.SmX.scimoz = _this.scimoz;
        logger.debug("[monitorFile] filename=" + filename + ", encoding=" + encoding);
        svc.SmX.fileToConsole(filename, encoding, /*notify=*/ true);
    };
    
    // Display message on the status bar (default) or command output bar
    this.statusBarMessage = function cmdout_sbmsg(msg, timeout, highlight) {
		_this.ensureShown();
        var win = (_W.frames["runoutput-desc-tabpanel"]) ?
            _W.frames["runoutput-desc-tabpanel"] : _W;
        var runoutputDesc = win.document.getElementById("runoutput-desc");
        if (msg === null) msg = "";
        runoutputDesc.parentNode.style.backgroundColor = (highlight && msg) ? "highlight" : "";
        runoutputDesc.style.color = "rgb(0, 0, 0)";
        runoutputDesc.setAttribute("value", msg);
        timers.clearTimeout(runoutputDesc.timeout);
        if (timeout > 0) runoutputDesc.timeout =
            timers.setTimeout(() => cmdout_sbmsg('', 0), timeout);
    };

    const uuePrefName = "RInterface.unicodeUnescape";
    if(!prefs.hasBooleanPref(uuePrefName))
        prefs.setBooleanPref(uuePrefName, false);
    var unicodeUnescape = prefs.getBooleanPref(uuePrefName);
    var unicodeUnescapeObserver = {
        observe(prefset, prefName/*, data*/) {
            unicodeUnescape = prefset.getBooleanPref(prefName);
            //logger.debug("Preference observer: '" + prefName + "' set to " + unicodeUnescape);
        }
    };
    prefs.prefObserverService.addObserver(unicodeUnescapeObserver, uuePrefName, true);
    
    var currentPrompt = promptStr.normal;
    var browserMode = false, newCommand = true;

    this.onEvalEnvChange = function(event) {
		if(!event.detail.evalEnvName) return;
        browserMode = event.detail.evalEnvName !== ".GlobalEnv";
		currentPrompt = browserMode ? promptStr.normal : promptStr.browse;
        logger.debug("[onEvalEnvChange]" + "currentPrompt=" + currentPrompt);
	};
	
    // XXX append '+> ' without newline
    this.printCommand2 = function(text) {
        if(svc.SmX.scimoz === null) svc.SmX.scimoz = _this.scimoz;
        var readOnly = _this.scimoz.readOnly;
        _this.scimoz.readOnly = false;
        _this.ensureShown();
        if(newCommand) _this.clear();
        var prettyText =
        (newCommand ? (browserMode ? promptStr.browse : promptStr.normal) + " " : "") +
        text.trim().replace(/(\r?\n|\r)/g, _this.eOLChar + "   ") +
        _this.eOLChar;
        var lastLineBefore = _this.scimoz.lineFromPosition(_this.scimoz.length);
        _this.scimoz.appendText(prettyText);
        _this.styleLines(lastLineBefore,
            _this.scimoz.lineFromPosition(_this.scimoz.length),
            _this.STYLE_STDIN);
        _this.scimoz.readOnly = readOnly;

    };
    
    // text or commandInfo object
    this.printResult2 = function(info, wantMore, done) {
        var scimoz = _this.scimoz;
        if(svc.SmX.scimoz === null) svc.SmX.scimoz = scimoz;
        var readOnly = scimoz.readOnly;
        scimoz.readOnly = false;
        _this.ensureShown();

        var lastLineBefore;
        if(wantMore) {
            lastLineBefore = scimoz.lineFromPosition(scimoz.length);
            scimoz.appendText(promptStr.continued + " ");
            _this.styleLines(lastLineBefore, lastLineBefore + 1,
                _this.STYLE_STDIN);
        } else {
            //scimoz.appendText(text);
            if(info) svc.SmX.printResult(info, unicodeUnescape); // NB only .result is needed
            if (done) {
                lastLineBefore = scimoz.lineFromPosition(scimoz.length);
                let column = scimoz.length - scimoz.positionFromLine(scimoz.lineFromPosition(scimoz.length));
                let endsWithNL = column === 0;
                if(!endsWithNL) ++lastLineBefore;
                scimoz.appendText(
                    (!endsWithNL ? _this.eOLChar : "") +
                    (browserMode ? promptStr.browse : promptStr.normal) +
                    _this.eOLChar);
                _this.styleLines(lastLineBefore,
                    scimoz.lineFromPosition(scimoz.length),
                    _this.STYLE_STDIN);
            }
        }
        scimoz.readOnly = readOnly;
    };

    var consoleIdle = true;
    var printQueue = [];
    var queuedPrint = function(newItem) {
        //logger.debug("[queuedPrint]" + " items in queue=" + printQueue.length);
        //logger.debug("[queuedPrint]" + " console idle? " + consoleIdle);
        if(newItem) {
            printQueue.push(newItem);
            if(!consoleIdle) return;
        } else { // == file reading finished, continue with queue
            //logger.debug("[queuedPrint]" + " file read.");
            //logger.debug("[queuedPrint]" + " console is BUSY");
            consoleIdle = false;
            _this.printResult2(false, false, true);
        }
        consoleIdle = false;
        var item;
        while((item = printQueue.shift())) {
             if(typeof item.wantMore === "boolean") { // test if it is a result
                //logger.debug("[queuedPrint]" + " result: " + (item.isOutputFile? "from file" : "immediate"));
                newCommand = ! item.wantMore;
                if(item.isOutputFile) {
                    _this.monitorFile(item.info.result.trim(), item.fileEncoding);
                    return;
                } else {
                    _this.printResult2(item.info, item.wantMore, true);
                    timers.clearTimeout(_waitMessageTimeout);
                    _this.statusBarMessage(null);
                }
                //browserMode = event.detail.browserMode;           
            } else { // a command
                //logger.debug("[queuedPrint]" + " command was: "+ item.command);
                _this.printCommand2(item.command);
                // display 'wait message' only for longer operations
                timers.clearTimeout(_waitMessageTimeout);
                _waitMessageTimeout = timers.setTimeout(_this.statusBarMessage, 750,
                   "R is working...", 0, false); 
            }
        }
        //logger.debug("[queuedPrint]" + " console is IDLE");
        consoleIdle = true;
    };
   
    
    this.onRCommandSubmitted = function(event) {
        logger.debug("[onRCommandSubmitted]");
        queuedPrint(event.detail);
        // // XXX  r_command_sent event is not fired for hidden commands
        // //if(event.detail.hidden) return;
        // _this.printCommand2(event.detail.command);
        // // display 'wait message' only for longer operations
        // timers.clearTimeout(_waitMessageTimeout);
        // _waitMessageTimeout = timers.setTimeout(_this.statusBarMessage, 750,
           // "R is working...", 0, false);   
    };
    
    this.onRResultReturned = function(event) {
        logger.debug("[onRResultReturned]");
        if(event.detail.hidden) return;
        queuedPrint(event.detail);
        
        // newCommand = ! event.detail.wantMore;
        // if(event.detail.isOutputFile) {
            // _this.monitorFile(event.detail.info.result.trim(), event.detail.fileEncoding);
        // } else {
            // //_this.printResult2(event.detail.info.result, event.detail.wantMore, true);
            // _this.printResult2(event.detail.info, event.detail.wantMore, true);
            // timers.clearTimeout(_waitMessageTimeout);
            // _this.statusBarMessage(null);
        // }
        //browserMode = event.detail.browserMode;
    };

    // Note: the listeners are added in init.js    
    
}).apply(module.exports);