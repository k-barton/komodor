'use strict';

/* globals require  */

(function () {
    
    var _W = require("ko/windows").getMain();
    const { Cc, Ci, Cu } = require('chrome');
    
    var logger = require("ko/logging").getLogger("kor/cmdout");
    logger.setLevel(logger.DEBUG);
    
    var XPCOMUtils = Cu.import("resource://gre/modules/XPCOMUtils.jsm").XPCOMUtils;
    var lazySvcGetter = XPCOMUtils.defineLazyServiceGetter.bind(XPCOMUtils);
    
    var svc = {};
    lazySvcGetter(svc, "Obs", "@mozilla.org/observer-service;1", "nsIObserverService");
    //lazySvcGetter(svc, "SysUtils", "@activestate.com/koSysUtils;1", "koISysUtils");
    lazySvcGetter(svc, "SmX", "@komodor/korScimozUtils;1", "korIScimozUtils");

    const timers = require("sdk/timers"), prefs = require("ko/prefs");
    
    var _this = this, ko = _W.ko, _scimoz, _outputWindow;
    var getEOLChar = (scimoz) => ["\r\n", "\r", "\n"][scimoz.eOLMode];
    var _init;
    const promptStr = { normal: ":>", continued: ":+", browse: "~>", busy: "..." };

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
    
    this.printStyled = function (str, newline = true, replace = false, lineNum = -1) {
        if (newline) str += this.eOLChar;
        svc.SmX.scimoz = this.scimoz;
        svc.SmX.printWithMarks(str, replace, lineNum); //(s, replace = False, lineNum = None)
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
        var p0;
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
        observe(prefset, prefName, data) {
            unicodeUnescape = prefset.getBooleanPref(prefName);
            //logger.debug("Preference observer: '" + prefName + "' set to " + unicodeUnescape);
        }
    };
    prefs.prefObserverService.addObserver(unicodeUnescapeObserver, uuePrefName, true);

	
    this.printResult = function(command, finalPrompt, done, commandInfo/*,
        unnnUnescape = false*/) {
        
        logger.debug("cmdout.printResult: unicodeUnescape is " + unicodeUnescape);
        
        var scimoz = _this.scimoz;
        svc.SmX.scimoz = scimoz;
        var eOLChar = _this.eOLChar;
        _this.ensureShown();
    
        finalPrompt = fixEOL(finalPrompt);
        var readOnly = scimoz.readOnly;
        scimoz.readOnly = false;
        if (!done) {
            _this.clear();
            finalPrompt += eOLChar;
            svc.SmX.appendText(fixEOL(command));
            _this.styleLines(0, scimoz.lineCount, _this.STYLE_STDIN);
        } else {
            let lineNum = scimoz.lineCount - 2;
            if (_this.getLine(lineNum) === promptStr.busy + eOLChar) {
                scimoz.targetStart = scimoz.positionFromLine(lineNum);
                scimoz.targetEnd = scimoz.positionAtChar(scimoz.textLength - 1, {});
                scimoz.replaceTarget(0, "");
                svc.SmX.printResult(commandInfo, unicodeUnescape);
            }
        }
        svc.SmX.appendText(finalPrompt);
        let lineCount = scimoz.lineCount;
        _this.styleLines(lineCount - 1, lineCount, _this.STYLE_STDIN);
        let firstVisibleLine = Math.max(scimoz.lineCount - scimoz.linesOnScreen -
            1, 0);
        scimoz.firstVisibleLine = firstVisibleLine;
        scimoz.readOnly = readOnly;
    };
    
    var _curPrompt = promptStr.normal, _command = [];
    var _waitMessageTimeout;
	
	_W.addEventListener('r-evalenv-change', (event) => {
		if(!event.detail.evalEnvName) return;
		_curPrompt = (event.detail.evalEnvName === ".GlobalEnv") ? 
			promptStr.normal : promptStr.browse;
	}, false);
    
    this.displayResults = function (result, commandInfo, executed, wantMore,
        unnnUnescape) {
        timers.clearTimeout(_waitMessageTimeout);

        var msg, print_command, finalPrompt = "";
        if(!executed)
            _command.push(commandInfo.command.trim().replace(/(\r?\n|\r)/g, "$1   "));
 
 // XXX: lastNormalPrompt i.e. not "continue"
        var prePrompt = _curPrompt === promptStr.continued ? 
			promptStr.normal : _curPrompt; //commandInfo.browserMode ? promptStr.browse : promptStr.normal;
        
        print_command = prePrompt + " " +
            _command.join(_this.eOLChar + promptStr.continued + " ") +
            _this.eOLChar;

        if (executed) {
            let newPrompt = wantMore ? promptStr.continued :
                commandInfo.browserMode ? promptStr.browse : promptStr.normal;
            
            finalPrompt = _this.eOLChar + newPrompt;
            if(!wantMore) _command.splice(0);
            _curPrompt = newPrompt;
            _this.statusBarMessage(null);
        } else {
            result = "";
            finalPrompt = promptStr.busy;
            msg = "R is working...";
            // display 'wait message' only for longer operations
            _waitMessageTimeout = timers.setTimeout(_this.statusBarMessage, 750, msg, 0, false);
        }
        _this.printResult(print_command, finalPrompt, executed, commandInfo/*,
            unnnUnescape*/);
    };
    
}).apply(module.exports);