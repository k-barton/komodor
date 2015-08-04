// Define the 'sv.misc' namespace
sv.misc = {};


sv.misc.colorPicker = {};
/*
 * JavaScript macro to provide a basic color picker for hexadecimal colors.
 *
 * Version: 1.0
 *
 * Authored by: David Ascher
 * Modified by: Shane Caraveo
 *              Todd Whiteman
 *              Philippe Grosjean
 *              Kamil Barton
 */
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
		   // TODO: add if condition for currentView
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

	function _colorPicker_onchaange (event, cp) {
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

// TODO: Komodo 9 defines own onMarginClick
function marginClickViewChangedObserver(event) {
	var view = event.originalTarget;
	if(view) view.onMarginClick = sv.misc.onMarginClick;
}
//window.addEventListener("current_view_changed", marginClickViewChangedObserver, false);
