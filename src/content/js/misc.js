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
(function () {

var os_prefix = window.navigator.platform.substring(0, 3).toLowerCase();

if ((os_prefix == "win") || (os_prefix == "mac")) {

	var _colorPicker_system = function  (color) {
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
	};

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
	};

} else {

	var _colorPicker_onchange = function (event, cp) {
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
	};

	var _colorPicker_remove = function () {
		// remove the popup from the document. This cleans up so
		// we can change the macro code if needed
		var p = document.getElementById('popup_colorpicker');
		if (p)
			p.parentNode.removeChild(p);
	};

	var _colorPicker_init = function () {
		_colorPicker_remove();
		var p = document.createElement('popup');
		p.setAttribute('id', 'popup_colorpicker');
		var cp = document.createElement('colorpicker');
		cp.colorChanged = _colorPicker_onchange;
		cp.setAttribute('onselect', 'this.colorChanged(event, this);');
		p.appendChild(cp);
		document.documentElement.appendChild(p);
	};

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
	};
}

}).apply(sv.misc.colorPicker);


sv.misc.getKomodoVersion = function() {
	if (ko.version) return ko.version;
	return Components.classes["@activestate.com/koInfoService;1"]
		.getService(Components.interfaces.koIInfoService).version;
};

// Fix broken margin click
(function() {
	// Fixed bookmark-toggling
	function bookmarkToggleFix(modifiers, position, margin) {
		var s = this.scimoz;
		if (margin == (this.scimoz.MARGIN_SYMBOLS === undefined ? 2 : this.scimoz.MARGIN_SYMBOLS) &&
			this._mouseButton == 0) { // 1 --> 0
			// original onMarginClick uses this.scintilla.scimoz, which apparently
			// has no effect
			var lineClicked = s.lineFromPosition(position);
			var markerState = s.markerGet(lineClicked);
			if (markerState & 1 << ko.markers.MARKNUM_BOOKMARK) {
				s.markerDelete(lineClicked, ko.markers.MARKNUM_BOOKMARK);
			} else {
				s.markerAdd(lineClicked, ko.markers.MARKNUM_BOOKMARK);
			}
		}
	}

	// TODO: Komodo 9 dispatches an event "editor_margin_clicked"
	if(sv._versionCompare(sv.misc.getKomodoVersion(), "9") >= 0) {
		window.addEventListener("editor_margin_clicked", function marginClickListener(event) {
			bookmarkToggleFix.call(event.detail.view, event.detail.modifiers,
								   event.detail.position, event.detail.margin);
		}, true);
	} else {
		// XXX: REMOVE Ko7 & Ko8
		var onMarginClick = function (modifiers, position, margin) {
			var mouseButton = this._mouseButton;
			//XXX this.getPrototypeOf();
			var res = this.__proto__.onMarginClick.call(this, modifiers, position, margin);
			this._mouseButton = mouseButton;
			bookmarkToggleFix.call(this, modifiers, position, margin);
			this._mouseButton = -1;
			return res;
		};

		var addMarginClickHandler = function (view) {
			if (view.cancelable !== undefined) // view is Event object
				view = ko.views.manager.currentView;
			if(!view || view.onMarginClick == onMarginClick) return;
			view.onMarginClick = onMarginClick;
		};

		window.addEventListener("view_opened", addMarginClickHandler, true);
		var _observerSvc = Components.classes['@mozilla.org/observer-service;1']
			.getService(Components.interfaces.nsIObserverService);

		var onLoad = function() {
			var views = ko.views.manager.getAllViews();
			for (var i = 0; i < views.length; ++i) {
				var view = views[i];
				sv.cmdout.append("view: " + view.koDoc.displayPath);
				addMarginClickHandler(view);
			}
			_observerSvc.removeObserver(onLoad, "komodo-ui-started");
			_observerSvc = null;
		};
		_observerSvc.addObserver(onLoad, "komodo-ui-started", false);
	}

}).apply();

