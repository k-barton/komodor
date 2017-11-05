
var sv;
var rHelpBrowser;
var rHelpTopic;

function go(uri, loadFlags) {
	// These are still undefined when calling .go on load event,
	// so define them here
	rHelpBrowser = document.getElementById("rhelp-browser");
	switch (uri) {
	 case  "":
	 case "@home@":
		rHelpBrowser.goHome();
		return;
	 case "@CRAN@":
		uri = sv.pref.getPref("CRANMirror");
		if (!uri || uri.indexOf("ftp:/") === 0)
			uri = "http://cran.r-project.org/";
	}

	rHelpTopic = document.getElementById("rhelp-topic");
	// In case the window was not yet fully loaded.
	if (!rHelpTopic) {
		self.addEventListener("load", function(event) { go(uri); }, false);
		return;
	}

	if (uri) {
		rHelpTopic.value = uri;
	} else {
		uri = rHelpTopic.value;
	}
	rHelpTopic.select();

	// Try to differentiate an URL from a help topic
	var isUri = uri.search(/^((f|ht)tps?|chrome|about|file):\/{0,3}/) === 0;

	if (isUri) {
		// This looks like a URL
		rHelpBrowser.webNavigation.loadURI(uri, loadFlags, null, null, null);
	} else {
		// Look for this 'topic' web page
		sv.r.help(uri);
	}
}

function txtInput(aEvent) {
	if (aEvent.keyCode == KeyEvent.DOM_VK_RETURN) {
		if (aEvent.ctrlKey) {
			rHelpSearch(rHelpTopic.value);
		} else {
			go();
		}
	} else {
		let value = rHelpTopic.value;
		let isUri = value.search(/^((f|ht)tps?|chrome|about|file):\/{1,3}/) === 0;
		let isTopic = value.search(/[^\w\.\-]/) === -1; 
		rHelpTopic.style.color = isUri? "#000000" : "#8080ff";
		document.getElementById("rhelp-go").disabled = !isUri || !isTopic;
	}
}

function search(topic) {
	if (!topic) return;
	rHelpTopic.select();
	sv.r.search(topic);
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

function find(next, backwards) {
	//rHelpTopic.select();
	//findInDoc(rHelpTopic.value);
	var findToolbar = document.getElementById("FindToolbar");

	if (!next) {
		findToolbar.open(0); //  aMode = 0 : full search
		findToolbar._findField.value = rHelpBrowser.contentWindow.getSelection();
		findToolbar._find(findToolbar._findField.value);
		findToolbar._findField.focus();
	} else {
		findToolbar._findAgain(backwards);
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
			rHelpTopic.value = aWebProgress.DOMWindow.document.location;

			document.getElementById("cmd_stop").setAttribute("disabled", true);
			document.getElementById("cmd_stop").hidden = true;
			document.getElementById("cmd_reload").hidden = false;
			document.getElementById("cmd_go_back")
				.setAttribute("disabled", !rHelpBrowser.webNavigation.canGoBack)
			document.getElementById("cmd_go_forward")
				.setAttribute("disabled", !rHelpBrowser.webNavigation.canGoForward);
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
}

function rHelpBrowserContextOnShow(event) {
	var selText = sv.string.trim(window.content.getSelection().toString());
	var el = document.getElementById("cmd_rsearch_for");
	var elLabel;
	var nothingSelected = !selText;

	if (nothingSelected) {
		elLabel = sv.translate("No selection");
	} else {
		elLabel = sv.translate("Search R for \"%S\"",
			selText.substr(0, 10) + (selText.length > 10? "..." : ""));
	}
	el.setAttribute("label", elLabel);
	el.setAttribute("disabled", nothingSelected);
	document.getElementById("cmd_run_r_code").setAttribute("disabled", nothingSelected);

	goUpdateCommand("cmd_copy");

}

function runSelAsRCode() {
	var selText = sv.string.trim(window.content.getSelection()
	    .getRangeAt(0).toString());

	// Looks like R help page, so require package first
	win = window.content;
	doc = window.content.document;
	if (win.document.title.indexOf("R: ") == 0) {
		let docTables = doc.getElementsByTagName("table");
		if (docTables.length > 0
			&& docTables[0].summary.search(/page for (\S+) \{([\w\.]+)\}/) == 0) {
			selText = "require(" + RegExp.$2 + ")\n" + selText;
			//TODO: for remote help files, ask to install package in not available
		}
	}
	sv.r.eval(selText);
}

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
				encodeURIComponent(sv.string.trim(queryObj[i])));
	  
    rHelpBrowser.webNavigation.loadURI(
        rHelpBrowser.homePage.replace(/index.html$/, "Search?" + queryArr.join("&")),
		rHelpBrowser.webNavigation.LOAD_FLAGS_NONE, null, null, null
        );
}

function _getHomePage(browser, goTo) {
	var isWin = navigator.platform.search(/Win\d+$/) === 0;
	var res = false;
	var cmd = "cat(kor::getHelpURL())";

	res = sv.r.evalAsync(cmd, (path) => {
		path = sv.string.removeLastCRLF(path);
		// Get just the last line, get rid of the help.start's message
		path = path.substring(path.lastIndexOf("\n") + 1);
		browser.homePage = sv.helpStartURI = path;
		if (goTo) go(path);
		});
}

var browserUtils = {};

(function() {

this.purgeCache = function() {
	var cacheService = Components.classes["@mozilla.org/network/cache-service;1"]
		.getService(Components.interfaces.nsICacheService);
	cacheService.evictEntries(Components.interfaces.nsICache.STORE_ANYWHERE);
}

this.purgeHistory = function() {
	if (rHelpBrowser.docShell.sessionHistory.count)
		rHelpBrowser.docShell
			.sessionHistory.PurgeHistory(rHelpBrowser.docShell.sessionHistory.count);
}

}).apply(browserUtils);


//function onFindToolbarAttrModified(event) {
//	if (event.attrName == "hidden"
//		&& (!event.newValue || event.newValue == "true")) {
//		document.getElementById("rhelp-find").checked = !event.target.hidden;
//	}
//}

function OnLoad (event) {
	// DOMContentLoaded is fired also for HTML content
	if (event.target != self.document) return;
	var page;
	if (window.arguments) {
		let args = window.arguments;
		sv = args[0];
		if (typeof(args[1]) != "undefined") page = args[1];
	} else {
		let p = parent;
		while ((p = p.opener)) {
			if (p.sv) {
				sv = p.sv;
				break;
			}
		}
		if (!sv) {
			let wm = Components.classes['@mozilla.org/appshell/window-mediator;1']
				.getService(Components.interfaces.nsIWindowMediator);
			let win = wm.getMostRecentWindow("Komodo");
			sv = win.sv;
		}
	}

	rHelpTopic = document.getElementById("rhelp-topic");
	rHelpTopic.clickSelectsAll = true;
	rHelpBrowser = document.getElementById("rhelp-browser");
	rHelpBrowser.addProgressListener(progressListener,
	    Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT);

	var findToolbar = document.getElementById("FindToolbar");

	var observer = new MutationObserver(function(mutations) {
	   mutations.forEach((mutation) => {
		 if (findToolbar == mutation.target && mutation.attributeName == "hidden") {
			document.getElementById("rhelp-find").checked = !mutation.target.hidden;
		   }
	  });    
	});

	observer.observe(findToolbar, { attributes: true, 
	     childList: false, characterData: false });

	go(page ? page : "about:blank");
	_getHomePage(rHelpBrowser, !page);

	// Print preview does not work on a Mac, disable that command then
	var isMac = navigator.platform.search(/Mac/) === 0;
	document.getElementById("cmd_print_preview")
		.setAttribute("disabled", isMac);
	document.getElementById("rhelp-print-preview").hidden = isMac;
}

// this is fired earlier than load event, so all required variables
// will be defined
self.addEventListener("DOMContentLoaded", OnLoad, false);


// required by PrintUtils.printPreview()
//function getWebNavigation() rHelpBrowser.webNavigation;
//function getNavToolbox() document.getElementById("nav-toolbar");
//function getPPBrowser() rHelpBrowser;

function printPage() {
	//PrintUtils.print();
}

function printPreview() {
	//var enterPP = () => { document.getElementById("nav-toolbar").hidden = true };
	//var exitPP = () => { document.getElementById("nav-toolbar").hidden = false };
	//PrintUtils.printPreview(enterPP, exitPP);
	/*
	callback = {
		getSourceBrowser() => rHelpBrowser,
		getPrintPreviewBrowser() => rHelpBrowser,
		getNavToolbox() => ... //document.getElementById("nav-toolbar")
	};
	PrintUtils.printPreview(callback);
	*/
}

// modified "prefbarSavePage" from prefbar extension for Firefox
function savePage() {
	var title = window.content.document.title;
	var uri = window.content.location;
	var doc = window.content.document;
	var rchar = "_";

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
