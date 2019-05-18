
/* globals require, self, Components, KeyEvent, internalSave, goUpdateCommand */

var _w = Components.classes["@mozilla.org/appshell/window-mediator;1"]
	.getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("Komodo");

var gBrowser, gAddressBar, gButtons = {};

var rxHelpTopic_ = /^ *[\w\.\-]+ *$/,
	rxURL_ = /^(((f|ht)tps?|chrome|resource|koicon|file|less):\/\/|about:)/,
	rxMaybeURI_ = new RegExp(
   "(((f|ht)tps?|chrome|resource|koicon|file|less)://|about:)?" +  // SCHEME
	"([a-z0-9+!*(),;?&=$_\\.-]+(:[a-z0-9+!*(),;?&=$_\\.-]+)?@)?" + // User and Pass
	"([a-z0-9\\-\\.]*)\\.(([a-z]{2,4})|([0-9]{1,3}\\.([0-9]{1,3})\\.([0-9]{1,3})))" + // Host or IP
	"(:[0-9]{2,5})?");
var isURL = (s) => rxURL_.test(s);
var mayBeURI = (s) => rxMaybeURI_.test(s);
var isHelpTopic = (s) => rxHelpTopic_.test(s);
var isLocalFile = (s) => _w.Services.koOsPath.isfile(s);

if(typeof require === "undefined")
	var require = _w.require;

const R = require("kor/r"), UI = require("kor/ui"), Fu = require("kor/fileutils");

var logger = require("ko/logging").getLogger("komodoR");

var loadURI = (uri, browser, flags) => {
	var wn = browser.webNavigation;
	if(!flags) flags = wn.LOAD_FLAGS_NONE;
    browser.stop(wn.STOP_ALL);
	if(uri === wn.currentURI.spec) wn.reload(flags);
	else wn.loadURI(uri, flags, null, null, null);
};

function openCurrentURInMainWindow() {
	UI.openBrowser(gBrowser.webNavigation.document.location);
}

// TODO: implement protocols: rdoc & rdoc-search
function go(uri, loadFlags) {
	logger.debug("RHelpWindow:go " + uri);

	// These are still undefined when calling 'go' on load event,
	// so define them here:
	gAddressBar = document.getElementById("rhelp-topic");
	// In case the window was not yet fully loaded.
	if (!gAddressBar) {
		self.addEventListener("load", (event) => { go(uri); }, false);
		return;
	}
	if(!gBrowser) gBrowser = document.getElementById("rhelp-browser");

	if(!uri) uri = gAddressBar.value.trim();
	
	switch (uri) {
	 case  "":
	 case "@home@":
		gBrowser.goHome();
		return;
	 case "@CRAN@":
		uri = require("kor/prefs").getPref("CRANMirror");
		if (!uri || uri.startsWith("ftp:/"))
			uri = require("kor/prefs").defaults["CRANMirror"];
	}

	gAddressBar.value = uri;
	gAddressBar.select();
 
    if(isLocalFile(uri)) uri = Fu.toFileURI(uri);
    if (isURL(uri))  // This looks like a URL
		loadURI(uri, gBrowser, loadFlags);
    else if (mayBeURI(uri))  // This looks like a URL without protocol
		loadURI("https://" + uri, gBrowser, loadFlags);
	else if(isHelpTopic(uri)) // Look for this 'topic' web page
		R.help(uri);
	else
		search(uri);
}

// viewZoomOverlay.js uses this
function getBrowser() gBrowser


// display formatted search results in a help window
function rHelpSearch(topic) {
	if (!topic)	return;
    var queryObj = {pattern: topic, 
        fieldsAlias: 1, fieldsTitle: 1, fieldsConcept: 1, 
        ignoreCase: 1, typesHelp: 1, typesVignette: 1, typesDemo: 1};
    
    var queryArr = [];
    for(let i in queryObj)
		if(queryObj.hasOwnProperty(i))
			queryArr.push(i.replace(/([A-Z])/g, (_, s) => "." +
				s.toLowerCase()) + "=" + 
				encodeURIComponent(queryObj[i]).trim());
	  
    loadURI(gBrowser.homePage.replace(/index.html$/,
		"Search?" + queryArr.join("&")),
			gBrowser, null);
}


function txtInput(aEvent) {
	if (aEvent.keyCode === KeyEvent.DOM_VK_RETURN) {
		if (aEvent.ctrlKey)
			rHelpSearch(gAddressBar.value);
		else
			go();
	} else {
		let value = gAddressBar.value;
		let valueIsTopic = isHelpTopic(value);
		let valueIsFullURL = isURL(value); 
        let valueIsURI = valueIsFullURL || mayBeURI(value); // match without protocol,
        let valueIsFileName = !valueIsURI && isLocalFile(value);
        
		gButtons.go.disabled = !valueIsURI && !valueIsFileName;
        gButtons.doc.disabled = !valueIsTopic || valueIsFullURL || valueIsFileName;
        gButtons.search.disabled = !valueIsTopic || valueIsFullURL || valueIsFileName;
		gAddressBar.classList[valueIsURI ? "add" : "remove" ]("addressIsURL");
	}
}

function search(topic) {
	if (!topic) return;
	gAddressBar.select();
	R.search(topic);
}

function find(next, backwards) {
	//gAddressBar.select();
	var findToolbar = document.getElementById("FindToolbar");
	if (!next) {
		findToolbar.open(0); //  aMode = 0 : full search
		findToolbar._findField.value = gBrowser.contentWindow.getSelection();
		findToolbar._find(findToolbar._findField.value);
		findToolbar._findField.focus();
	} else
		findToolbar._findAgain(backwards);
}

function onFindCommand(event) {
	var button = event.target;
	if (!button.checked) {
		find();
	} else {
		var findToolbar = document.getElementById("FindToolbar");
		findToolbar.close();
	}
}

// Browser progress listener: so far used only to change title and location text
// From: https://developer.mozilla.org/en/Code_snippets/Progress_Listeners
var progressListener = {
	QueryInterface: function(aIID) 	{
		if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
			aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
			aIID.equals(Components.interfaces.nsISupports)) return(this);
	    throw(Components.results.NS_NOINTERFACE);
	},

	onStateChange: function(aWebProgress, aRequest, aFlag, aStatus) {
		// If you use myListener for more than one tab/window, use
		// aWebProgress.DOMWindow to obtain the tab/window which
		// triggers the state change

		if (aFlag & Components.interfaces.nsIWebProgressListener.STATE_START) {
			// This fires when the load event is initiated
			document.getElementById("cmd_stop").setAttribute("disabled", false);
			document.getElementById("cmd_stop").hidden = false;
			document.getElementById("cmd_reload").hidden = true;
		}

		if (aFlag & Components.interfaces.nsIWebProgressListener.STATE_STOP) {
			// This fires when the load finishes
			self.document.title = aWebProgress.DOMWindow.document.title;
			gAddressBar.value = aWebProgress.DOMWindow.document.location;

			document.getElementById("cmd_stop").setAttribute("disabled", true);
			document.getElementById("cmd_stop").hidden = true;
			document.getElementById("cmd_reload").hidden = false;
			document.getElementById("cmd_go_back")
				.setAttribute("disabled", !gBrowser.webNavigation.canGoBack);
			document.getElementById("cmd_go_forward")
				.setAttribute("disabled", !gBrowser.webNavigation.canGoForward);
		}
	},

	onLocationChange: function(aProgress, aRequest, aURI){
		// This fires when the location bar changes; i.e load event is
		// confirmed or when the user switches tabs. If you use
		// myListener for more than one tab/window, use
		// aProgress.DOMWindow to obtain the tab/window which triggered
		//the change.

		// This redirects result page from html search form to rHelpSearch results:
		//FIXME: on the results page, when .goBack is invoked, page will be redirected again
		if (aProgress.DOMWindow.document.location.href
		    .search(/search\/SearchEngine\.html\?.*SEARCHTERM=([a-z0-9+%]*)(?=&|$)/) != -1) {
			rHelpSearch(RegExp.$1);
		}
	},

	// For definitions of the remaining functions see XULPlanet.com
	onProgressChange: function(aWebProgress, aRequest, curSelf,
		maxSelf, curTot, maxTot) { },
	onStatusChange: function(aWebProgress, aRequest, aStatus,
		aMessage) { },
	onSecurityChange: function(aWebProgress, aRequest, aState) { }
};

var getSelection = () => window.content.getSelection().toString().trim(); 

function rHelpBrowserContextOnShow(event) {
	var selText = getSelection();
	var el = document.getElementById("cmd_rsearch_for");
	var elLabel;
	var nothingSelected = !selText;

	if (nothingSelected) {
		elLabel = UI.translate("No selection");
	} else {
		elLabel = UI.translate("Search R for \"%S\"",
			selText.substr(0, 10) + (selText.length > 10? "..." : ""));
	}
	el.setAttribute("label", elLabel);
	el.setAttribute("disabled", nothingSelected);
	document.getElementById("cmd_run_r_code").setAttribute("disabled", nothingSelected);
    
    var searchTerm = selText.match(/^[\w\.-_]+/);
    
    el = document.getElementById("cmd_rhelp_for");
    if(searchTerm === null) {
        el.setAttribute("disabled", true);
        el.setAttribute("label", UI.translate("R Help for selection"));
    } else {
        el.setAttribute("disabled", false);
        el.setAttribute("label", UI.translate("R Help for \"%S\"", searchTerm));
    }
	goUpdateCommand("cmd_copy");
}

function runSelAsRCode() {
	var selText = String(window.content.getSelection().getRangeAt(0)).trim();

	// Looks like R help page, so require package first
	let win = window.content;
	let doc = window.content.document;
	if (win.document.title.indexOf("R: ") == 0) {
		let docTables = doc.getElementsByTagName("table");
		if (docTables.length > 0 &&
			docTables[0].summary.search(/page for (\S+) \{([\w\.]+)\}/) == 0) {
			selText = "base::require(" + RegExp.$2 + ")\n" + selText;
			//TODO: for remote help files, ask to install package in not available
		}
	}
	R.evalUserCmd(selText);
}

function _getHomePage(browser, goTo) {
	var cmd = "base::cat(kor::getHelpURL())";
	require("kor/connector").evalAsync(cmd, (path) => {
		path = path.replace(/[\n\r]{1,2}$/, ""); //remove trailing CRLF
		// Get just the last line, get rid of the help.start's message
		path = path.substring(path.lastIndexOf("\n") + 1);
		browser.homePage = path;
		if (goTo) go(path);
	}, true);
}

var browserUtils = {};

(function() {

this.purgeCache = function() {
	var cacheService = Components.classes["@mozilla.org/network/cache-service;1"]
		.getService(Components.interfaces.nsICacheService);
	cacheService.evictEntries(Components.interfaces.nsICache.STORE_ANYWHERE);
};

this.purgeHistory = function() {
	if (gBrowser.docShell.sessionHistory.count)
		gBrowser.docShell
			.sessionHistory.PurgeHistory(gBrowser.docShell.sessionHistory.count);
};

}).apply(browserUtils);


//function onFindToolbarAttrModified(event) {
//	if (event.attrName == "hidden"
//		&& (!event.newValue || event.newValue == "true")) {
//		document.getElementById("rhelp-find").checked = !event.target.hidden;
//	}
//}

function OnLoad(event) {
    try {
        logger.debug("RHelpWindow:onLoad");

        // DOMContentLoaded is fired also for HTML content
        if (event.target !== self.document) return;
        var page;
        if (window.arguments) {
            let args = window.arguments;
            if (typeof args[1] !== "undefined") page = args[1];
        }

        gAddressBar = document.getElementById("rhelp-topic");
        gAddressBar.clickSelectsAll = true;
        gBrowser = document.getElementById("rhelp-browser");
        gBrowser.addProgressListener(progressListener,
            Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
		
		gButtons.go = document.getElementById("rhelp-navigate-go");
		gButtons.doc = document.getElementById("rhelp-navigate-doc");
        gButtons.search = document.getElementById("rhelp-navigate-search");

        var findToolbar = document.getElementById("FindToolbar");

        var observer = new MutationObserver(function(mutations) {
            mutations.forEach((mutation) => {
                if (findToolbar == mutation.target && mutation.attributeName ==
                    "hidden") {
                    document.getElementById("rhelp-find").checked =
						!mutation.target.hidden;
                }
            });
        });

        observer.observe(findToolbar, {
            attributes: true,
            childList: false,
            characterData: false
        });

        go(page ? page : "about:blank");
        _getHomePage(gBrowser, !page);

        // Print preview does not work on a Mac, disable that command then
        //var isMac = navigator.platform.search(/Mac/) === 0;
        //document.getElementById("cmd_print_preview")
        //   .setAttribute("disabled", isMac);
        //document.getElementById("rhelp-print-preview").hidden = isMac;

    } catch (ex) {
        logger.exception(ex, "RHelpWindow:onLoad");
    }

}

// this is fired earlier than load event, so all required variables
// will be defined
self.addEventListener("DOMContentLoaded", OnLoad, false);


// required by PrintUtils.printPreview()
//function getWebNavigation() gBrowser.webNavigation;
//function getNavToolbox() document.getElementById("nav-toolbar");
//function getPPBrowser() gBrowser;

function printPage() {
	//PrintUtils.print();
}

function printPreview() {
	//var enterPP = () => { document.getElementById("nav-toolbar").hidden = true };
	//var exitPP = () => { document.getElementById("nav-toolbar").hidden = false };
	//PrintUtils.printPreview(enterPP, exitPP);
	/*
	callback = {
		getSourceBrowser() => gBrowser,
		getPrintPreviewBrowser() => gBrowser,
		getNavToolbox() => ... //document.getElementById("nav-toolbar")
	};
	PrintUtils.printPreview(callback);
	*/
}

// modified "prefbarSavePage" from prefbar extension for Firefox
function savePage() {
	//var title = window.content.document.title;
	var uri = window.content.location;
	var doc = window.content.document;
	//var rchar = "_";

	// We want to use cached data because the document is currently visible.
	var dispHeader = null;
	try {
		dispHeader =
			doc.defaultView
			.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
			.getInterface(Components.interfaces.nsIDOMWindowUtils)
			.getDocumentMetadata("content-disposition");
	} catch (ex) {
		// Failure to get a content-disposition is ok
	}

	internalSave(uri, doc, null, dispHeader,
				 doc.contentType, false, null, null);
}
