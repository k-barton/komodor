/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *  
 */

// Fix broken margin click
function bookmarkToggleFix(modifiers, position, margin) {
    var s = this.scimoz;
    if (margin === (this.scimoz.MARGIN_SYMBOLS === undefined ? 2 : this.scimoz.MARGIN_SYMBOLS) &&
        this._mouseButton === 0) { // 1 --> 0
        // original onMarginClick uses this.scintilla.scimoz, which apparently
        // has no effect
        var lineClicked = s.lineFromPosition(position);
        var markerState = s.markerGet(lineClicked);
        if (markerState & 1 << ko.markers.MARKNUM_BOOKMARK)
            s.markerDelete(lineClicked, ko.markers.MARKNUM_BOOKMARK);
        else
            s.markerAdd(lineClicked, ko.markers.MARKNUM_BOOKMARK);
    }
}

window.addEventListener("editor_margin_clicked", (event) => {
    bookmarkToggleFix.call(event.detail.view, event.detail.modifiers,
        event.detail.position, event.detail.margin);
}, true);
