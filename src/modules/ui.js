'use strict';

// jshint strict: global

/* globals require, module */


    //var UI = {
    //    addNotification: null,
    //    getCurrentScimoz: null,
    //    getTextRange: null,
    //    pathWithCurrentViewContent: null,
    //    fileOpen: null, ==> browseForFile
    //};

(function () { // jshint validthis: true
    
var logger = require("ko/logging").getLogger("komodoR");
    
var langName = require("kor/main").langName; 
var _this = this;
var _W = require("ko/windows").getMain();
const { Cc, Ci, Cu } = require("chrome");

var XPCOMUtils = Cu.import("resource://gre/modules/XPCOMUtils.jsm").XPCOMUtils;
var lazySvcGetter = XPCOMUtils.defineLazyServiceGetter.bind(XPCOMUtils);
  
var svc = {};
lazySvcGetter(svc, "Os", "@activestate.com/koOs;1", "koIOs");
lazySvcGetter(svc, "findSvc", "@activestate.com/koFindService;1", "koIFindService");
lazySvcGetter(svc, "sysUtils", "@activestate.com/koSysUtils;1", "koISysUtils");

var timers = require("sdk/timers");

const fileUtils = require("kor/fileutils");

//ko.widgets.getWidget("runoutput-desc-tabpanel")

this.toString = () => "[object KorUI]",

this.eOLChar = (scimoz) => ["\r\n", "\r", "\n"][scimoz.eOLMode];

var translStrings = Cu.import("resource://gre/modules/Services.jsm")
    .Services.strings
    .createBundle("chrome://komodor/locale/main.properties"); 

// Translate messages using data from chrome://komodor/locale/main.properties
this.translate = function (textId) {
    var param;
    try {
        if (arguments.length > 1) {
            param = [];
            for (let i = 1; i < arguments.length; ++i)
                param = param.concat(arguments[i]);
            return translStrings.formatStringFromName(textId, param, param.length);

        } else {
            return translStrings.GetStringFromName(textId);
        }
    } catch (e) {
        // fallback if no translation found
        if (param) { // a wannabe sprintf, just substitute %S and %nS patterns:
            let rx;
            for (let i = 0; i < param.length; ++i) {
                rx = new RegExp("%(" + (i + 1) + ")?S");
                textId = textId.replace(rx, param[i]);
            }
        }
        return (textId);
    }
};

// Display message on the status bar (default) or command output bar
var _messageTimeout, _messageWindow;
var getMessageWindow = () => {
    if (!_messageWindow) _messageWindow =
        require("ko/windows").getWidgetWindows()
        .find(w => w.name === "runoutput-desc-tabpanel");
    return _messageWindow;
};

this.message = (msg, timeout = 0) => {
    var win = getMessageWindow();
    if (!win) return;
    var runoutputDesc = win.document.getElementById("runoutput-desc");
    if (!runoutputDesc) return;
    if (!msg) msg = "";
    runoutputDesc.setAttribute("value", msg);
    timers.clearTimeout(_messageTimeout);
    if (timeout > 0) _messageTimeout = timers.setTimeout(_this.message.bind(_this, ""), timeout);
};

this.addNotification = function(msg, category = "R-interface", highlight = false) {
    require("notify/notify").send(msg, category, {
        priority: highlight ? "warning" : "info"
        });
};

// file open dialog, more customizable replacement for ko.filepicker.browseForFile
this.browseForFile = function (directory, filename, title, filter, multiple, save,
    filterIndex) {
    const nsIFilePicker = Ci.nsIFilePicker;
    var fp = Cc["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
        
    //const fileUtils = Cu.import("resource://kor/fileUtils.jsm").fileUtils;
    const fileUtils = require("kor/fileutils");

    //Dialog should get default system title
    //if (!title) title = UI.translate(save? "Save file" : "Open file");

    let mode;
    if (!save) 
        mode = multiple ? nsIFilePicker.modeOpenMultiple : nsIFilePicker.modeOpen;
    else 
        mode = nsIFilePicker.modeSave;
    
    fp.init(_W, title, mode);

    if (typeof filterIndex !== "undefined")
        fp.filterIndex = (typeof filterIndex === "object") ?
        filterIndex.value : filterIndex;

    let filters = [];

    if (filter) {
        if (typeof filter === "string") filter = filter.split(',');
        let fi;
        for (let i = 0; i < filter.length; i++) {
            fi = filter[i].split("|");
            if (fi.length === 1)
                fi[1] = fi[0];
            fp.appendFilter(fi[0], fi[1]);
            filters.push(fi[1]);
        }
    }
    fp.appendFilters(nsIFilePicker.filterAll);
    filters.push("");

    if (directory && fileUtils.exists(directory = fileUtils.path(directory))) {
        let lf = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
        lf.initWithPath(directory);
        fp.displayDirectory = lf;
    }
    if (filename) fp.defaultString = filename;

    let rv = fp.show();
    if (rv === nsIFilePicker.returnOK || rv === nsIFilePicker.returnReplace) {
        let path;
        if (multiple) {
            let files = fp.files;
            path = [];
            while (files.hasMoreElements()) {
                let file = files.getNext().QueryInterface(Ci.nsILocalFile);
                path.push(file.path);
            }
        } else
            path = fp.file.path;

        // append extension according to active filter
        if (mode === nsIFilePicker.modeSave) {
            if (!svc.Os.path.getExtension(path) && ! svc.Os.path.basename(path).startsWith(".")) 
                path += svc.Os.path.getExtension(filters[fp.filterIndex]);
        }
        if (typeof filterIndex === "object") filterIndex.value = fp.filterIndex;
        return path;
    }
    return null;
}; // browseForFile

this.getCurrentScimoz = function () {
    var view = require("ko/views").current();
    if (!view) return null;
    view.scintilla.focus();
    var scimoz = view.scimoz;
    if (!scimoz) return null;
    return scimoz;
};
 
this.getWindowByURI = function (uri) {
     var wm = Cc['@mozilla.org/appshell/window-mediator;1']
         .getService(Ci.nsIWindowMediator);
     var en = wm.getEnumerator("");

     if (uri) {
         var win;
         while (en.hasMoreElements()) {
             win = en.getNext();
             if (win.location.href === uri) return win;
         }
     }
     return null;
};

 //Get reference to a window, opening it if is closed
this.getWindowRef = function (uri, name, features, focus, ...args) { //, ...
     var win = _this.getWindowByURI(uri);
     if (!win || win.closed) {
         try {
             if (!features) features = "chrome,modal,titlebar";
             args = [uri, name, features].concat(args);
             win = _W.openDialog.apply(null, args);
         } catch (e) {
             logger.exception(e, "Error opening window: " + uri);
         }
     }
     if (focus) win.focus();
     return win;
 };

this.pathWithCurrentViewContent = function (view, isTempFile) {
    var rval = false;
    try {
        if (!view) view = require("ko/views").current();
        if (!view) return null;
        view.scintilla.focus();
        var scimoz = view.scimoz;
        if (!scimoz) return null;
        var doc = view.koDoc;
        if (!doc) return null;
        var original = doc.file && doc.file.isLocal && !doc.isUntitled && !doc.isDirty;
        // if local document is saved, return path to the original file
        if (original) {
            rval = doc.file.path;
        } else {
            rval = fileUtils.temp(doc.baseName);
            fileUtils.write(rval, scimoz.text, 'utf-8', false);
        }
        if (typeof isTempFile === "object")
            isTempFile.value = !original;
    } catch (e) {
        logger.exception(e, "pathWithCurrentViewContent");
        return null;
    }
    return rval;
};
/*
 TODO: do not use find service
pos = v.scimoz.charPosAtPosition(v.scimoz.currentPos);
v.scimoz.text.lastIndexOf("tutaj", pos);
v.scimoz.text.indexOf("tutaj", pos);

v.scimoz.text.substr(0, v.scimoz.text.lastIndexOf("tutaj", pos));
v.scimoz.text.substr(0, v.scimoz.text.indexOf("tutaj", pos));

//pchnąć w tę łódź *<index2>tutaj* jeża i óśm <pos>skrzyń *<index1>tutaj* fig
*/
  
// Select a part of text in the current buffer and return it
this.getTextRange = function (what, gotoend = false, select = false, range, includeChars) {
    var view = require("ko/views").current();
    if (!view) return "";
    view.scintilla.focus();
    var scimoz = view.scimoz, text = "", curPos = scimoz.currentPos;
    var curLine = scimoz.lineFromPosition(curPos), pStart = Math.min(scimoz.anchor, curPos),
        pEnd = Math.max(scimoz.anchor, curPos);

    // Depending on 'what', we select different parts of the file

    what = String(what).toLowerCase();
    
    if (what === "lineorsel") what = (pStart === pEnd) ? "line" : "sel";

    switch (what) {
    case "sel":
        // Simply retain current selection
        var nSelections = scimoz.selections;
        if (nSelections > 1) { // rectangular selection
            let msel = [];
            for (let i = 0; i < scimoz.selections; ++i)
                msel.push(scimoz.getTextRange(scimoz.getSelectionNStart(i), scimoz.getSelectionNEnd(i)));
            
            text = msel.join("\n");
            // TODO: What to do with multiple ranges?
            pStart = scimoz.getSelectionNStart(0);
            pEnd = scimoz.getSelectionNEnd(nSelections - 1);
        }
        break;
    case "word":
        if (pStart == pEnd) { // only return word if no selection
            let inR = view.koDoc.languageForPosition(scimoz.currentPos) === langName;

            if (!includeChars && inR) includeChars = ".";

            let wordChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_" +
                includeChars;

            let wordCharTest = (s) => (s.charCodeAt(0) > 0x80) || wordChars.indexOf(s) > -1;

            for (pStart = scimoz.positionBefore(curPos);
                (pStart > 0) && wordCharTest(scimoz.getWCharAt(pStart)); pStart = scimoz.positionBefore(
                    pStart)) {}

            // PhG: correction for infinite loop if the name is at the beginning
            // of the document
            if (pStart !== 0 || !wordCharTest(scimoz.getWCharAt(0))) pStart += 1;

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

        // save previous find settings
        let oldFindPref = {
            searchBackward: true,
            matchWord: false,
            patternType: 0
        };
        for (let i in oldFindPref)
            if (oldFindPref.hasOwnProperty(i))
                oldFindPref[i] = svc.findSvc.options[i];

        svc.findSvc.options.matchWord = false;
        svc.findSvc.options.patternType = 2;

        let pos1, pos2, pos3, pos4;
        let lineArgsStart, lineBodyStart, firstLine; //lineArgsEnd lineBodyEnd,
        let pos0 = scimoz.getLineEndPosition(curLine);
        let findRes;

        do {
            //  search for function pattern backwards:
            svc.findSvc.options.searchBackward = true;
            findRes = svc.findSvc.find("", // view.koDoc.displayPath
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
            svc.findSvc.options.searchBackward = false;
            findRes = svc.findSvc.find("", //view.koDoc.displayPath
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
            if (scimoz.getWCharAt(pos3 - 1) === "{") 
                pos4 = scimoz.braceMatch(pos3 - 1) + 1;
            else 
                pos4 = scimoz.getLineEndPosition(lineBodyStart);

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
                svc.findSvc.options[i] = oldFindPref[i];

        break;
    case "block":
        // Select all content between two bookmarks
        let mark1, mark2;
        mark1 = scimoz.markerPrevious(curLine, 64);
        if (mark1 === -1) mark1 = 0;
        mark2 = scimoz.markerNext(curLine, 64);
        if (mark2 === -1) mark2 = scimoz.lineCount - 1;

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

        for (let i = curLine; i <= scimoz.lineCount && scimoz.lineLength(i) > 0
            && scimoz.getTextRange(
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
    case "all":
        /*falls through*/
    default:
        // Take everything
        text = scimoz.text;
    }

    if (!text) text = scimoz.getTextRange(pStart, pEnd);

    if (gotoend) scimoz.gotoPos(pEnd);
    if (select && what !== "sel") scimoz.setSel(pStart, pEnd);

    if (range && typeof range === "object")
        range.value = {
            start: pStart,
            end: pEnd
        };

    return text;
}; // getTextRange

const range = (start, stop, step) => 
    Array.from({ length: (stop - start) / step }, 
    (_, i) => start + (i * step));

var getMarker = (scimoz, line) => {
    let m = scimoz.markerGet(line);
    return range(0, 32, 1).filter(i => (Math.pow(2, i) & m) != 0);
};

// TODO: get R fragment from Rmd
// TODO: find postion with style == default
// XXX: does not work for type="doc"
this.getTextRangeWithBrowseCode = function(...args) {
	var view = require("ko/views").current();
	if (!view) return "";
	view.scintilla.focus();
	var text, o = {}, linesWithMarkers, lineno;
	var scimoz = view.scimoz;
	var browserStr = "kor::koBrowseHere();";
	args[3] = o; // range
	var text = this.getTextRange.apply(this, args);
	var eol = this.eOLChar(scimoz);
	var eolLen = eol.length;
	var startline = scimoz.lineFromPosition(o.value.start);
	linesWithMarkers = range(startline, 
        scimoz.lineFromPosition(o.value.end), 1)
            .filter(x => getMarker(scimoz, x)
            .some((x) => x > 6 && x < 19 && x != 13));
    if (linesWithMarkers.length === 0) return text;
	lineno = linesWithMarkers[0] - startline;
    var p = -1;
	for (let i = 0; i < lineno; ++i) p = text.indexOf(eol, p + eolLen);
	p += eolLen;
	return text.substr(0, p) + browserStr + text.substr(p);
} // getTextRangeWithBrowseCode

this.colorPicker = {};

(function () {
    
let platform = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS.toLowerCase();

if ((platform === "winnt") || (platform === "darwin")) {

	var _colorPicker_system = function  (color) {
		if (!color) color = "#000000";
		// sysUtils.pickColor seems to be broken, does not return any value
		// which is strange, because it is only wrapper for
		// .pickColorWithPositioning,
		// Moreover, positioning does not seem to work anyway.
		var newcolor = svc.sysUtils.pickColorWithPositioning(color, -1, -1);
		//Note pickColor was fixed in Komodo 5.2.3
		if (newcolor) {
		   // TODO: add if condition for currentView
		   var scimoz = require("ko/views").current().scimoz;
		   scimoz.replaceSel(newcolor);
		   scimoz.anchor = scimoz.currentPos;
		}
	};

	this.pickColor = function () {
		var currentView = require("ko/views").current();
		if (currentView) {
			currentView.scintilla.focus();
			var color = _this.getTextRange("word", false, true, null, "#");
			try {
				color = "#" + color.match(/[0-9A-F]{6}/i)[0].toLowerCase();
			} catch(e) {
				color = "#ffffff";
			}
			_colorPicker_system(color);
		}
	};
    
} else {
    
	var _colorPicker_remove = () => {
		// remove the popup from the document. This cleans up so
		// we can change the macro code if needed
		var p = document.getElementById('popup_colorpicker');
		if (p)
			p.parentNode.removeChild(p);
	}; 

	var _colorPicker_onchange = (event, cp) => {
		var scimoz = require("ko/views").current().scimoz;
		scimoz.insertText(scimoz.currentPos, cp.color);
		// Move cursor position to end of the inserted color
		// Note: currentPos is a byte offset, so we need to correct the length
		let newCurrentPos = scimoz.currentPos + svc.sysUtils.byteLength(cp.color);
		scimoz.currentPos = newCurrentPos;
		// Move the anchor as well, so we don't have a selection
		scimoz.anchor = newCurrentPos;
		// For some reason we get the event twice, removing
		// onselect fixes the problem.  Tried to solve it
		// by canceling the event below, but it went on anyway
		cp.removeAttribute('onselect');
		cp.parentNode.hidePopup();

		event.preventDefault();
		event.stopPropagation();
		event.cancelBubble = true;
		_colorPicker_remove();
	};


	var _colorPicker_init = () => {
		_colorPicker_remove();
		let p = document.createElement('popup');
		p.setAttribute('id', 'popup_colorpicker');
		let cp = document.createElement('colorpicker');
		cp.colorChanged = _colorPicker_onchange;
		cp.setAttribute('onselect', 'this.colorChanged(event, this);');
		p.appendChild(cp);
		document.documentElement.appendChild(p);
	};

	this.pickColor = function () {
		let currentView = require("ko/views").current();
		if (currentView) {
			currentView.scintilla.focus();
			_colorPicker_init();
			let scimoz = currentView.scimoz;
			let pos = scimoz.currentPos;
			let x = scimoz.pointXFromPosition(pos);
			let y = scimoz.pointYFromPosition(pos);
			let boxObject = currentView.boxObject;
			let cp = document.getElementById('popup_colorpicker');
			cp.showPopup(currentView.scintilla,
				x + boxObject.x, y + boxObject.y,
				'colorpicker',"topleft","topleft");
		}
	};
}

}).apply(this.colorPicker);

this.openBrowser = function(uri, inRHelpWindow = false) {
    if(inRHelpWindow)
        require("kor/command").openHelp(uri)
    else {
        let kvm = require("ko/views").manager;
        let view = kvm.getViewForURI(uri, "browser");
        if(view && view.browser) {
            view.browser.webNavigation.reload(view.browser.webNavigation.LOAD_FLAGS_NONE);
            view.makeCurrent();
        } else 
            kvm.openViewAsync("browser", uri);
    }
};

   
}).apply(module.exports);

