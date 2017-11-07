/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  This code is based on SciViews-K general functions, which are
 *  copyright (c) 2008-2010 by Ph. Grosjean (phgrosjean@sciviews.org)
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */

/* globals sv, ko, Components, window, AddonManager, Services, require, document */

// requires: sv.file, sv.rconn

sv._versionCompare = (v1, v2) => 
	Components.classes["@mozilla.org/xpcom/version-comparator;1"]
		.getService(Components.interfaces.nsIVersionComparator)
		.compare(v1, v2);


//(TODO: move the functions below to sv.utils or such)
// generate unique id
sv.uid = function (n) {
    if (!n) n = 1;
    let rval = "";
    for (let i = 0; i < n; ++i)
        rval += Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    return rval;
};

sv.alert = function (header, text) {
    // DEPRECATED
    ko.dialogs.alert(header, text, "R interface");
};

sv._getCurrentScimoz = function () {
    var view = ko.views.manager.currentView;
    if (!view) return null;
    view.setFocus();
    var scimoz = view.scimoz;
    if (!scimoz) return null;
    return scimoz;
};

// Select a part of text in the current buffer and return it
sv.getTextRange = function (what, gotoend, select, range, includeChars) {
    sv._getCurrentScimoz();
    var view = ko.views.manager.currentView;
    if (!view) return "";
    view.setFocus();
    var scimoz = view.scimoz;
    var text = "";
    var curPos = scimoz.currentPos;
    var curLine = scimoz.lineFromPosition(curPos);

    var pStart = Math.min(scimoz.anchor, curPos);
    var pEnd = Math.max(scimoz.anchor, curPos);

    // Depending on 'what', we select different parts of the file
    // By default, we keep current selection

    if (what == "line/sel") what = (pStart == pEnd) ? "line" : "sel";

    switch (what) {
    case "sel":
        // Simply retain current selection
        var nSelections = scimoz.selections;
        if (nSelections > 1) { // rectangular selection
            var msel = [];
            for (var i = 0; i < scimoz.selections; ++i) {
                msel.push(scimoz.getTextRange(scimoz.getSelectionNStart(i), scimoz.getSelectionNEnd(i)));
            }
            text = msel.join("\n");
            // TODO: What to do with multiple ranges?
            pStart = scimoz.getSelectionNStart(0);
            pEnd = scimoz.getSelectionNEnd(nSelections - 1);
        }
        break;
    case "word":
        if (pStart == pEnd) { // only return word if no selection
            var inR = view.koDoc.languageForPosition(scimoz.currentPos) == sv.langName;

            if (!includeChars && inR) includeChars = ".";

            var wordChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_" +
                includeChars;

            var wordCharTest = function (s)(s.charCodeAt(0) > 0x80) || wordChars.indexOf(s) > -1;

            for (pStart = scimoz.positionBefore(curPos);
                (pStart > 0) && wordCharTest(scimoz.getWCharAt(pStart)); pStart = scimoz.positionBefore(
                    pStart)) {}

            // PhG: correction for infinite loop if the name is at the beginning
            // of the document
            if (pStart != 0 | !wordCharTest(scimoz.getWCharAt(0))) pStart += 1;

            for (pEnd = scimoz.currentPos; (pEnd < scimoz.length) && wordCharTest(scimoz.getWCharAt(pEnd));
				pEnd = scimoz.positionAfter(
                    pEnd)) {}
        }
        break;
    case "function":
        // tricky one: select an entire R function
        // this should work even with extremely messy coded ones.

        // function declaration pattern:
        let funcRegExStr = "\\S+\\s*(<-|=)\\s*function\\s*\\(";
        //var funcRegExStr = "\\b(([`'\\\"])(.+)\\2|([\w\u0100-\uFFFF\\.]+))\\s*(<-|=)\\s*function\\s*\\(";

        let findSvc = Components.classes['@activestate.com/koFindService;1']
            .getService(Components.interfaces.koIFindService);

        // save previous find settings
        var oldFindPref = {
            searchBackward: true,
            matchWord: false,
            patternType: 0
        };
        for (let i in oldFindPref)
            if (oldFindPref.hasOwnProperty(i))
                oldFindPref[i] = findSvc.options[i];

        findSvc.options.matchWord = false;
        findSvc.options.patternType = 2;

        let pos1, pos2, pos3, pos4;
        let lineArgsStart, lineBodyStart, firstLine; //lineArgsEnd lineBodyEnd,
        let pos0 = scimoz.getLineEndPosition(curLine);
        let findRes;

        do {
            //  search for function pattern backwards:
            findSvc.options.searchBackward = true;
            findRes = findSvc.find("", // view.koDoc.displayPath
                scimoz.text, funcRegExStr,
                scimoz.charPosAtPosition(pos0), 0); //start, end
            if (!findRes) break;

            // function declaration start:
            pos0 = scimoz.positionAtChar(0, findRes.start);
            // opening brace of function declaration
            pos1 = scimoz.positionAtChar(0, findRes.end);
            // closing brace of function declaration
            pos2 = scimoz.braceMatch(pos1 - 1); //+ 1;

            // find first character following the closing brace
            findSvc.options.searchBackward = false;
            findRes = findSvc.find("", //view.koDoc.displayPath
                scimoz.text, "\\S",
                scimoz.charPosAtPosition(pos2) + 1,
                scimoz.charPosAtPosition(scimoz.length));
            if (!findRes) break;

            //  beginning of the function body:
            pos3 = scimoz.positionAtChar(0, findRes.end);

            lineArgsStart = scimoz.lineFromPosition(pos1);
            lineBodyStart = scimoz.lineFromPosition(pos3);

            // get first line of the folding block:
            firstLine = (scimoz.getFoldParent(lineBodyStart) !=
                lineArgsStart) ? lineBodyStart : lineArgsStart;

            // get end of the function body
            if (scimoz.getWCharAt(pos3 - 1) == "{") {
                pos4 = scimoz.braceMatch(pos3 - 1) + 1;
            } else {
                pos4 = scimoz.getLineEndPosition(lineBodyStart);
            }

            // repeat if selected function does not embrace cursor position and if
            // there are possibly any functions enclosing it:
        } while (pos4 < curPos && scimoz.getFoldParent(lineArgsStart) != -1);

        if (pos4 >= curPos) {
            pStart = pos0;
            pEnd = pos4;
        }

        // restore previous find settings
        for (let i in oldFindPref)
            if (oldFindPref.hasOwnProperty(i))
                findSvc.options[i] = oldFindPref[i];

        break;
    case "block":
        // Select all content between two bookmarks
        let mark1, mark2;
        mark1 = scimoz.markerPrevious(curLine, 64);
        if (mark1 == -1) mark1 = 0;
        mark2 = scimoz.markerNext(curLine, 64);
        if (mark2 == -1) mark2 = scimoz.lineCount - 1;

        pStart = scimoz.positionFromLine(mark1);
        pEnd = scimoz.getLineEndPosition(mark2);

        break;
    case "para":
        // Select the entire paragraph
        // go up from curLine until
        for (let i = curLine; i >= 0 && scimoz.lineLength(i) > 0 && scimoz.getTextRange(
                pStart = scimoz.positionFromLine(
                    i),
                scimoz.getLineEndPosition(i)).trim() != "";
            --i) {}

        for (let i = curLine; i <= scimoz.lineCount && scimoz.lineLength(i) > 0 && scimoz
            .getTextRange(
                scimoz.positionFromLine(i),
                pEnd = scimoz.getLineEndPosition(i)).trim() != "";
            ++i) {}

        break;
    case "line":
        // Select whole current line
        pStart = scimoz.positionFromLine(curLine);
        pEnd = scimoz.getLineEndPosition(curLine);
        break;
    case "linetobegin":
        // Select line content from beginning to anchor
        pStart = scimoz.positionFromLine(curLine);
        break;
    case "linetoend":
        // Select line from anchor to end of line
        pEnd = scimoz.getLineEndPosition(curLine);
        break;
    case "end":
        // take text from current line to the end
        pStart = scimoz.positionFromLine(curLine);
        pEnd = scimoz.textLength;
        break;
    case "codefrag":
        // This is used by calltip and completion. Returns all text backwards from current
        // position to the beginning of the current folding level
        pStart = scimoz.positionFromLine(scimoz.getFoldParent(curLine));
        break;
    case "all":
        /*falls through*/
    default:
        // Take everything
        text = scimoz.text;
    }

    if (!text) text = scimoz.getTextRange(pStart, pEnd);

    if (gotoend) scimoz.gotoPos(pEnd);
    if (select && what != "sel") scimoz.setSel(pStart, pEnd);

    if (range != undefined && (typeof range == "object"))
        range.value = {
            start: pStart,
            end: pEnd
        };

    return text;
}; // getTextRange

// file open dialog, more customizable replacement for ko.filepicker.browseForFile
// TODO: rename to 'browseForFile' for consistency
sv.fileOpen = function (directory, filename, title, filter, multiple, save,
    filterIndex) {
    const nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fp = Components.classes["@mozilla.org/filepicker;1"]
        .createInstance(nsIFilePicker);

    //Dialog should get default system title
    //if (!title) title = sv.translate(save? "Save file" : "Open file");

    let mode;
    if (!save) {
        mode = multiple ? nsIFilePicker.modeOpenMultiple : nsIFilePicker.modeOpen;
    } else {
        mode = nsIFilePicker.modeSave;
    }

    fp.init(window, title, mode);

    if (typeof (filterIndex) != "undefined")
        fp.filterIndex = (typeof (filterIndex) == "object") ?
        filterIndex.value : filterIndex;

    let filters = [];

    if (filter) {
        if (typeof (filter) == "string") filter = filter.split(',');
        let fi;
        for (let i = 0; i < filter.length; i++) {
            fi = filter[i].split("|");
            if (fi.length == 1)
                fi[1] = fi[0];
            fp.appendFilter(fi[0], fi[1]);
            filters.push(fi[1]);
        }
    }
    fp.appendFilters(nsIFilePicker.filterAll);
    filters.push("");

    if (directory && sv.file.exists(directory = sv.file.path(directory))) {
        let lf = Components.classes["@mozilla.org/file/local;1"]
            .createInstance(Components.interfaces.nsILocalFile);
        lf.initWithPath(directory);
        fp.displayDirectory = lf;
    }
    if (filename) fp.defaultString = filename;

    let rv = fp.show();
    if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
        let path;
        if (multiple) {
            let files = fp.files;
            path = [];
            while (files.hasMoreElements()) {
                let file = files.getNext().QueryInterface(Components.interfaces.nsILocalFile);
                path.push(file.path);
            }
        } else {
            path = fp.file.path;
        }

        // append extension according to active filter
        if (mode == nsIFilePicker.modeSave) {
            //let os = Components.classes['@activestate.com/koOs;1'].getService(Components.interfaces.koIOs);
            let os = Services.koOs;
            if (!os.path.getExtension(path)) {
                path += os.path.getExtension(filters[fp.filterIndex]);
            }
        }
        if (typeof filterIndex == "object") filterIndex.value = fp.filterIndex;
        return path;
    }
    return null;
};

// translate messages using data from chrome://komodor/locale/main.properties
sv.translate = function (textId) {
    var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
        .getService(Components.interfaces.nsIStringBundleService)
        .createBundle("chrome://komodor/locale/main.properties");
    var param;

    try {
        if (arguments.length > 1) {
            param = [];

            for (let i = 1; i < arguments.length; ++i)
                param = param.concat(arguments[i]);
            return (bundle.formatStringFromName(textId, param, param.length));

        } else {
            //return(strbundle.getString(textId));
            return (bundle.GetStringFromName(textId));
        }
    } catch (e) {
        // fallback if no translation found
        if (param) { // a wannabe sprintf, just substitute %S and %nS patterns:
            var rx;
            for (let i = 0; i < param.length; ++i) {
                rx = new RegExp("%(" + (i + 1) + ")?S");
                textId = textId.replace(rx, param[i]);
            }
        }
        return (textId);
    }
};

//// Control the command output tab ////////////////////////////////////////////
if (typeof (sv.cmdout) == 'undefined') sv.cmdout = {};

sv.cmdout = {};
(function () {

    var _this = this;

    var logger = require("ko/logging").getLogger("komodoR");

    Object.defineProperty(this, 'eolChar', {
        get: () => ["\r\n", "\n", "\r"][_this.scimoz.eOLMode]
    });

    Object.defineProperty(this, 'scimoz', {
        get: function () {
            if (ko.widgets.getWidget) { // Komodo 9
                return ko.widgets.getWidget("runoutput-desc-tabpanel")
                    .contentDocument.getElementById("runoutput-scintilla").scimoz;
            }
            if (window.frames["runoutput-desc-tabpanel"]) { // Komodo 7
                return window.frames["runoutput-desc-tabpanel"]
                    .document.getElementById("runoutput-scintilla").scimoz;
            }
            return undefined;
        }
    });

    var _rgb = (...args) => {
        var color = (args.length == 3) ? args : args[0];
        return color[0] | (color[1] << 8) | (color[2] << 16);
    };

    var _hexstr2rgb = (hex)  => {
        var colorref = parseInt(hex.substr(1), 16);
        return _rgb(colorref >> 16 & 255, colorref >> 8 & 255, colorref & 255);
    };

    var styleNumCode = 22,
        styleNumResult = 0,
        styleNumErr = 23;

    this.STYLENUM_STDIN = styleNumCode;
    this.STYLENUM_STDOUT = styleNumResult;
    this.STYLENUM_STDERR = styleNumErr;

    var fixEOL = str => str.replace(/(\r?\n|\r)/g, _this.eolChar);

    var initialized = false; ///

    function _init() {
        var scimoz = _this.scimoz;

        var colorForeErr, colorForeCode, colorForeResult;

        //Get color from the color scheme: stdin, stdout, stderr
        //var schemeName = sv.pref.getPref('editor-scheme');
        // sv.pref may be not loaded yet
        var prefset = Components.classes["@activestate.com/koPrefService;1"]
            .getService(Components.interfaces.koIPrefService).prefs;
        var schemeName = prefset.getStringPref('editor-scheme');
        var currentScheme = Components.classes['@activestate.com/koScintillaSchemeService;1']
            .getService().getScheme(schemeName);

        //TODO: comment styling
        colorForeCode = _hexstr2rgb(currentScheme.getFore('', 'stdin'));
        colorForeResult = _hexstr2rgb(currentScheme.getFore('', 'stdout'));
        colorForeErr = _hexstr2rgb(currentScheme.getFore('', 'stderr'));

        scimoz.styleSetFore(styleNumCode, colorForeCode);
        scimoz.styleSetFore(styleNumErr, colorForeErr);
        scimoz.styleSetFore(styleNumResult, colorForeResult);
    }

    
    //var observerSvc = Components.classes["@mozilla.org/observer-service;1"]
        //.getService(Components.interfaces.nsIObserverService);
        
    let observerSvc = Services.obs;

    observerSvc.addObserver({
        observe: _init
    }, 'scheme-changed', false);

    this.print = function (str) {
        _this.clear();
        _this.append(str, true, false);
    };

    this.ensureShown = function () {
        // this is deprecated in Komodo9 (see message of the function):
        // ko.uilayout.ensureOutputPaneShown();

        if (ko.widgets.getPaneAt) {
            ko.widgets.getPaneAt('workspace_bottom_area').collapsed = false;
        } else {
            ko.widgets._panes.workspace_bottom_area.collapsed = false;
            //document.getElementById("workspace_bottom_area").collapsed = false;
        }

        if (document.getElementById("runoutput_tab") == null)
            ko.uilayout.ensureTabShown("runoutput-desc-tabpanel", false);
        else ko.uilayout.ensureTabShown("runoutput_tab", false);
    };

    this.print2 = function (command, prompt, done, commandInfo) {
        var scimoz = _this.scimoz;
        var eolChar = _this.eolChar;
        _this.ensureShown();

        prompt = fixEOL(prompt);
        var readOnly = scimoz.readOnly;
        scimoz.readOnly = false;
        if (!done) {
            _this.clear();
            command = fixEOL(command.toString()).replace(/^ {3}(?= *\S)/gm, ":+ "); // + eolChar;
            prompt += eolChar;
            scimoz.appendText(ko.stringutils.bytelength(command), command);
            this.styleLines(0, scimoz.lineCount, styleNumCode);
        } else {
            var lineNum = scimoz.lineCount - 2;
            if (this.getLine(lineNum) == '...' + eolChar) {
                scimoz.targetStart = scimoz.positionFromLine(lineNum);
                scimoz.targetEnd = scimoz.positionAtChar(scimoz.textLength - 1, {});
                scimoz.replaceTarget(0, '');
                sv.rconn.printResult1(commandInfo);
            }
        }
        scimoz.appendText(ko.stringutils.bytelength(prompt), prompt);
        var lineCount = scimoz.lineCount;
        this.styleLines(lineCount - 1, lineCount, styleNumCode);
        var firstVisibleLine = Math.max(scimoz.lineCount - scimoz.linesOnScreen - 1, 0);
        scimoz.firstVisibleLine = firstVisibleLine;
        scimoz.readOnly = readOnly;
    };

    this.replaceLine = function (lineNum, text, eol) {
        var scimoz = _this.scimoz;
        var eolChar = _this.eolChar;
        text = text.toString();

        scimoz.targetStart = scimoz.positionFromLine(lineNum);
        scimoz.targetEnd = scimoz.getLineEndPosition(lineNum) +
            (eol ? eolChar.length : 0);
        scimoz.replaceTarget(text.length, text);
    };

    this.append = function (str, newline, scrollToStart) {
        var scimoz = _this.scimoz;
        var eolChar = _this.eolChar;
        _this.ensureShown();
        if (scrollToStart === undefined) scrollToStart = false;
        str = fixEOL(str.toString());
        var lineCountBefore = scimoz.lineCount;
        if (newline || newline === undefined) str += eolChar;
        var readOnly = scimoz.readOnly;
        try {
            scimoz.readOnly = false;
            scimoz.appendText(ko.stringutils.bytelength(str), str);
        } catch (e) {
            logger.exception(e, "in sv.cmdout.append");
        } finally {
            scimoz.readOnly = readOnly;
        }

        var firstVisibleLine;
        if (!scrollToStart) {
            firstVisibleLine = Math.max(scimoz.lineCount - scimoz.linesOnScreen, 0);
        } else {
            firstVisibleLine = Math.min(lineCountBefore - 1, scimoz.lineCount - scimoz.linesOnScreen);
        }
        scimoz.firstVisibleLine = firstVisibleLine;

    };

    this.getLine = function (lineNumber) {
        var scimoz = _this.scimoz;
        var lineCount = scimoz.lineCount;
        if (lineNumber === undefined) lineNumber = lineCount - 1;
        while (lineNumber < 0) lineNumber = lineCount + lineNumber;
        var oLine = {};
        scimoz.getLine(lineNumber, oLine);
        return oLine.value;
    };

    this.styleLines = function (startLine, endLine, styleNum) {
        _init();
        let scimoz = _this.scimoz;
        let eolChar = _this.eolChar;

        if (startLine === undefined) startLine = 0;
        if (endLine === undefined) endLine = scimoz.lineCount;
        let styleMask = (1 << scimoz.styleBits) - 1;
        let readOnly = scimoz.readOnly;
        scimoz.readOnly = false;

        // all lines in the provided style
        let startPos = scimoz.positionFromLine(startLine);
        let endPos = scimoz.getLineEndPosition(endLine - 1) + eolChar.length;
        scimoz.startStyling(startPos, styleMask);
        scimoz.setStyling(endPos - startPos, styleNum);
        scimoz.readOnly = readOnly;
    };

    // Clear text in the Output Command pane
    this.clear = function (all) {
        var scimoz = _this.scimoz;

        if (all) _this.message();
        var readOnly = scimoz.readOnly;
        try {
            scimoz.readOnly = false;
            scimoz.clearAll();
        } finally {
            scimoz.readOnly = readOnly;
        }

    };

    // Display message on the status bar (default) or command output bar
    this.message = function (msg, timeout, highlight) {
		// DEPRECATED: replace with addNotification
		_this.ensureShown();
        var win = (window.frames["runoutput-desc-tabpanel"]) ?
            window.frames["runoutput-desc-tabpanel"] : window;
        var runoutputDesc = win.document.getElementById('runoutput-desc');
        if (msg === null) msg = "";
        runoutputDesc.parentNode.style.backgroundColor =
            (highlight && msg) ? "highlight" : "";
        runoutputDesc.style.color = "rgb(0, 0, 0)";
        runoutputDesc.setAttribute("value", msg);
        window.clearTimeout(runoutputDesc.timeout);
        if (timeout > 0) runoutputDesc.timeout = window
            .setTimeout(() => sv.cmdout.message('', 0), timeout);
    };

}).apply(sv.cmdout);

if (true || typeof require == "undefined") {
    sv.addNotification = (msg, severity, timeout) => {
        var sm = Components.classes["@activestate.com/koStatusMessage;1"]
            .createInstance(Components.interfaces.koIStatusMessage);
        sm.category = "komodor";
        sm.msg = msg;
        sm.log = true;
        sm.severity = severity | Components.interfaces.koINotification.SEVERITY_INFO;
        sm.timeout = timeout | 2000;
        ko.notifications.addNotification(sm);
    };
} else {
    sv.addNotification = (msg, severity, timeout) => {
        require("notify/notify").addMessage(msg, "komodor", timeout | 2000, false, false, true);
    };
}
