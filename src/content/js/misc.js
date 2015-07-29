// SciViews-K miscellaneous functions
// Define the 'sv.misc' namespace
// Copyright (c) 2008-2010, Ph. Grosjean (phgrosjean@sciviews.org) & K. Barton
// License: MPL 1.1/GPL 2.0/LGPL 2.1
////////////////////////////////////////////////////////////////////////////////
// sv.misc.sessionData(data);       // Create/open a .csv dataset from session
// sv.misc.sessionScript(script);   // Create/open a .R script from session
// sv.misc.sessionReport(rep);      // Create/open a .odt report from session
// sv.misc.closeAllOthers();        // Close all buffer except current one
// sv.misc.colorPicker.pickColor(); // Invoke a color picker dialog box
// sv.misc.moveLineDown();          // Move current line down
// sv.misc.moveLineUp();            // Move current line up
// sv.misc.searchBySel();           // Search next using current selection
// sv.misc.showConfig();            // Show Komodo configuration page
// sv.misc.swapQuotes();            // Swap single/double quotes in selection
// sv.misc.pathToClipboard();       // Copy file path to clipboard
// sv.misc.unixPathToClipboard();   // Copy UNIX file path to clipboard
// sv.misc.timeStamp();             // Stamp text with current date/time
////////////////////////////////////////////////////////////////////////////////

// Define the 'sv.misc' namespace
if (typeof(sv.misc) == "undefined") sv.misc = {};

/*
 * JavaScript macro to provide a basic color picker for hexadecimal colors.
 * Assign a useful keybinding to this macro and ka-zam, funky color picking!
 *
 * Version: 1.0
 *
 * Authored by: David Ascher
 * Modified by: Shane Caraveo
 *              Todd Whiteman
 *              Philippe Grosjean
 *              Kamil Barton
 */
sv.misc.colorPicker = {};

(function() {

var os_prefix = window.navigator.platform.substring(0, 3).toLowerCase();

if ((os_prefix == "win") || (os_prefix == "mac")) {

	function _colorPicker_system (color) {
		var sysUtils = Components.classes['@activestate.com/koSysUtils;1'].
			getService(Components.interfaces.koISysUtils);
		if (!color) color = "#000000";
		// sysUtils.pickColor seems to be broken, does not return any value
		// which is strange, because it is only wrapper for
		// .pickColorWithPositioning,
		// Moreover, positioning does not seem to work anyway.
		var newcolor = sysUtils.pickColorWithPositioning(color, -1, -1);
		//Note pickColor was fixed in Komodo 5.2.3

		if (newcolor) {
		   var scimoz = ko.views.manager.currentView.scimoz;
		   scimoz.replaceSel(newcolor);
		   scimoz.anchor = scimoz.currentPos;
		}
	}

	this.pickColor = function () {
		var currentView = ko.views.manager.currentView;
		if (currentView) {
			currentView.scintilla.focus();
			var color = sv.getTextRange("word", false, true, null, "#");
			try {
				color = "#" + color.match(/[0-9A-F]{6}/i)[0].toLowerCase();
			} catch(e) {
				color = "#ffffff";
			}
			_colorPicker_system(color);
		}
	}

} else {

	function _colorPicker_onchange (event, cp) {
		var scimoz = ko.views.manager.currentView.scimoz;
		scimoz.insertText(scimoz.currentPos, cp.color);
		// Move cursor position to end of the inserted color
		// Note: currentPos is a byte offset, so we need to correct the length
		var newCurrentPos = scimoz.currentPos +
			ko.stringutils.bytelength(cp.color);
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
	}

	function _colorPicker_remove () {
		// remove the popup from the document. This cleans up so
		// we can change the macro code if needed
		var p = document.getElementById('popup_colorpicker');
		if (p)
			p.parentNode.removeChild(p);
	}

	function _colorPicker_init () {
		_colorPicker_remove();
		var p = document.createElement('popup');
		p.setAttribute('id', 'popup_colorpicker');
		var cp = document.createElement('colorpicker');
		cp.colorChanged = _colorPicker_onchange;
		cp.setAttribute('onselect', 'this.colorChanged(event, this);');
		p.appendChild(cp);
		document.documentElement.appendChild(p);
	}

	this.pickColor = function () {
		var currentView = ko.views.manager.currentView;
		if (currentView) {
			currentView.scintilla.focus();
			_colorPicker_init();
			var scimoz = currentView.scimoz;
			var pos = scimoz.currentPos;
			var x = scimoz.pointXFromPosition(pos);
			var y = scimoz.pointYFromPosition(pos);
			var boxObject = currentView.boxObject;
			var cp = document.getElementById('popup_colorpicker');
			cp.showPopup(currentView.scintilla,
				x + boxObject.x, y + boxObject.y,
				'colorpicker',"topleft","topleft");
		}
	}
}

}).apply(sv.misc.colorPicker);

// Move Line Down, adapted by Ph. Grosjean from code by "mircho"
sv.misc.moveLineDown = function () {
    var currentView = ko.views.manager.currentView;
    if (currentView) {
        currentView.scintilla.focus();
        var ke = currentView.scimoz;
        var currentLine = ke.lineFromPosition(ke.currentPos);
        // Check if we are not at the last line
        if (currentLine < (ke.lineCount - 1)) {
            ke.lineDown();
            ke.lineTranspose();
        }
    }
}

// Move Line Up, adapted by Ph. Grosjean from code by "mircho"
sv.misc.moveLineUp = function () {
    var currentView = ko.views.manager.currentView;
    if (currentView) {
        currentView.scintilla.focus();
        var ke = currentView.scimoz;
        var currentLine = ke.lineFromPosition(ke.currentPos);
        // Check if we are not at the first line
        if (currentLine > 0) {
            ke.lineTranspose();
            ke.lineUp();
        }
    }
}

// Search next using current selection
sv.misc.searchBySel = function () {
    var currentView = ko.views.manager.currentView;
    if (currentView) {
        currentView.scintilla.focus();
        var ke = currentView.scimoz;
        var searchText = ke.selText;
        if (!searchText.length) {
            // Use last pattern used
            searchText = ko.mru.get("find-patternMru");
        }

        // Search with last user find preferences
        var findSvc = Components.classes["@activestate.com/koFindService;1"]
            .getService(Components.interfaces.koIFindService);
        var context = Components.classes["@activestate.com/koFindContext;1"]
            .createInstance(Components.interfaces.koIFindContext);
        context.type = findSvc.options.preferredContextType;
        Find_FindNext(window, context, searchText);
    }
}

// Show current Komodo configuration page
sv.misc.showConfig = function () {
    try {
        ko.open.URI('about:config','browser');
    } catch(e) {
        sv.logger.exception(e, "sv.misc.showConfig() error");
    }
}

// Swap quotes by 'Nicto', adapted in SciViews-K by Ph. Grosjean
sv.misc.swapQuotes = function() {
    try {
        var currentView = ko.views.manager.currentView;
        if (currentView) {
            currentView.scintilla.focus();
            var scimoz = currentView.scimoz;
            scimoz.beginUndoAction();

            // Retain these so we can reset the selection after the replacement
            var curAnchor = scimoz.anchor;
            var curPos = scimoz.currentPos;

            // Replace the currently selected text
            scimoz.replaceSel (
                // Find all single and double quote characters
                scimoz.selText.replace( /[\'\"]/g, function (value) {
                    // Return whatever the value isn't
                    return(value == '"' ? "'" : '"');
                })
            );

            // Reset the selection
            scimoz.setSel(curAnchor, curPos);
        }
    } catch (e) {
        sv.logger.exception(e, "sv.misc.swapQuotes() error");
    } finally {
        ko.views.manager.currentView.scimoz.endUndoAction();
    }
}

// Copy the path of current file to the clipboard
sv.misc.pathToClipboard = function (unix) {
    var ch = Components.classes["@mozilla.org/widget/clipboardhelper;1"].
        getService(Components.interfaces.nsIClipboardHelper);
    try {
        var path = ko.views.manager.currentView.koDoc.file.path;
		if (unix) path = path.replace(/\\/g, "/");
		ch.copyString(path);
    } catch(e) {
        sv.alert("Copy path to clipboard",
            "Unable to copy file path to clipboard (unsaved file?)")
    }
}

// Copy UNIX version (using '/' as sep) path of current file to the clipboard
sv.misc.unixPathToClipboard = function () sv.misc.pathToClipboard(true);

// Stamp the current text with date - time
sv.misc.timeStamp = function (format) {
    try {
        var ke = ko.views.manager.currentView.scimoz;

		// Adapted from setDateFormatExample() in
		// chrome://komodo/content/pref/pref-intl.js
		var timeSvc = Components.classes["@activestate.com/koTime;1"]
			.getService(Components.interfaces.koITime);
		var secsNow = timeSvc.time();
		var timeTupleNow = timeSvc.localtime(secsNow, new Object());
		if (!format) format = sv.pref.getPref("defaultDateFormat");
		var timeStr = timeSvc.strftime(format, timeTupleNow.length, timeTupleNow);
		ke.replaceSel(timeStr);
    } catch(e) {
        sv.logger.exception(e, "sv.misc.timeStamp() error");
    }
}

// Custom margin click behaviour
sv.misc.onMarginClick = function sv_onMarginClick(modifiers, position, margin) {
    var s = this.scimoz;
    var lineClicked = s.lineFromPosition(position);
    if (margin == 1) {
        if (s.getFoldLevel(lineClicked) & s.SC_FOLDLEVELHEADERFLAG) {
            if (s.getFoldExpanded(lineClicked)) {
                var level = s.getFoldLevel(lineClicked);
                var lineMaxSubord = s.getLastChild(lineClicked, level);
                var currentLine = s.lineFromPosition(s.currentPos);
                if (currentLine > lineClicked &&
                    currentLine <= lineMaxSubord) {
                    var pos = s.positionFromLine(lineClicked);
                    s.selectionStart = pos;
                    s.selectionEnd = pos;
                    s.currentPos = pos;
                }
            }
            s.toggleFold(lineClicked);
        }
    } else if (margin == 2 && this._mouseButton == 0) { // changed from 1 to 0
        var markerState = this.scintilla.scimoz.markerGet(lineClicked);
        if (markerState & 1 << ko.markers.MARKNUM_BOOKMARK) {
            this.scimoz.markerDelete(lineClicked, ko.markers.MARKNUM_BOOKMARK);
        } else {
            this.scimoz.markerAdd(lineClicked, ko.markers.MARKNUM_BOOKMARK);
        }
    }
    this._mouseButton = -1;
}


function marginClickViewChangedObserver(event) {
	var view = event.originalTarget;
	if(view) view.onMarginClick = sv.misc.onMarginClick;
}
window.addEventListener("current_view_changed", marginClickViewChangedObserver, false);
