'use strict';

/* globals Cc, Ci, Cu, require, Components    */


//if (typeof require !== "function") {
//    _W = Components.classes["@mozilla.org/appshell/window-mediator;1"]
//        .getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("Komodo");
//    var require = _W.require;
//} else {
//}

//var CmdOut = {};
//if (typeof module === "object") {
//    module.exports = CmdOut;
//} else {
//    this.EXPORTED_SYMBOLS = ["CmdOut"]; // jshint ignore: line
//}

(function () {
    
    var _W = require("ko/windows").getMain();
    const { Cc, Ci, Cu } = require('chrome');
    
    var XPCOMUtils = Cu.import("resource://gre/modules/XPCOMUtils.jsm").XPCOMUtils;
    var lazySvcGetter = XPCOMUtils.defineLazyServiceGetter.bind(XPCOMUtils);
    
    var svc = {};
    lazySvcGetter(svc, "Obs", "@mozilla.org/observer-service;1", "nsIObserverService");
    //lazySvcGetter(svc, "SysUtils", "@activestate.com/koSysUtils;1", "koISysUtils");
    lazySvcGetter(svc, "SmX", "@komodor/korScimozUtils;1", "korIScimozUtils");

    var _this = this, ko = _W.ko, _scimoz, _outputWindow;
    var getEOLChar = (scimoz) => ["\r\n", "\r", "\n"][scimoz.eOLMode];
    var _init;
    
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
        width: { get() {
            let w = _this.outputWindow.clientWidth - 25 /* ~scrollbar*/;
            if (_this.scimoz.getMarginWidthN(2) > 0)
                w -= _this.scimoz.textWidth(_this.scimoz.STYLE_LINENUMBER, "9999");
            
            return Math.floor(w / _this.scimoz.textWidth(_this.scimoz.STYLE_DEFAULT, "X")) - 1;
        
        }, enumerable: true },
        eOLChar: { get() getEOLChar(_this.scimoz), enumerable: true },
        toString: { value() "[object KorCmdout]" }
    });
    
    
    var fixEOL = str => String(str).replace(/(\r?\n|\r)/g, _this.eOLChar);

	Object.defineProperties(this, {
          STYLE_STDIN: { value: 22, enumerable: true }, 
          STYLE_STDOUT: { value: 0, enumerable: true }, 
          STYLE_STDERR: { value: 23, enumerable: true }
    });


    _init = () => {
        var scimoz = _this.scimoz;

        //Get color from the color scheme: stdin, stdout, stderr
        let prefset = Cc["@activestate.com/koPrefService;1"].getService(Ci.koIPrefService).prefs;
        let schemeName = prefset.getStringPref('editor-scheme');
        let currentScheme = Cc['@activestate.com/koScintillaSchemeService;1']
            .getService().getScheme(schemeName);

        let _hexstr2rgb = (hex)  => {
            let colorref = parseInt(hex.substr(1), 16);
            return (colorref >> 16 & 255) | (colorref & 65280) | ((colorref & 255) << 16);
        };
        let styleSetFore = (style, clr) => {
            scimoz.styleSetFore(_this[style], _hexstr2rgb(currentScheme.getFore("", clr)));
        };

        styleSetFore("STYLE_STDIN", "stdin");
        styleSetFore("STYLE_STDERR", "stderr");
        styleSetFore("STYLE_STDOUT", "stdout");
    };

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
    
    this.replaceLine = function (lineNum, text, eol) {
        var scimoz = this.scimoz;
        text = text.toString();

        scimoz.targetStart = scimoz.positionFromLine(lineNum);
        scimoz.targetEnd = scimoz.getLineEndPosition(lineNum) +
            (eol ? this.eOLChar.length : 0);
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

    var timers = require("sdk/timers");
 
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
    
    var promptStr = { normal: ":>", continued: ":+", browse: "~>", busy: "..." };
	

    this.printResult = function (command, finalPrompt, done, commandInfo) {
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
                svc.SmX.printResult(commandInfo);
            }
        }
        svc.SmX.appendText(finalPrompt);
        let lineCount = scimoz.lineCount;
        _this.styleLines(lineCount - 1, lineCount, _this.STYLE_STDIN);
        let firstVisibleLine = Math.max(scimoz.lineCount - scimoz.linesOnScreen - 1, 0);
        scimoz.firstVisibleLine = firstVisibleLine;
        scimoz.readOnly = readOnly;
    };
    
    let _curPrompt = promptStr.normal, _command = [];
    let _waitMessageTimeout;
    
    this.displayResults = function (result, commandInfo, executed, wantMore) {
        timers.clearTimeout(_waitMessageTimeout);

        let msg, print_command, finalPrompt = "";
        if(!executed)
            _command.push(commandInfo.command.trim().replace(/(\r?\n|\r)/g, "$1   "));
 
 // XXX: lastNormalPrompt i.e. not "continue"
        let prePrompt = _curPrompt === promptStr.continued ? 
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
        _this.printResult(print_command, finalPrompt, executed, commandInfo);
    };
    
    
}).apply(module.exports);