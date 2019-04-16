/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *  Copyright (c) 2011-2017 Kamil Barton
 *  
 *  This code is based on SciViews-K code:
 *  Copyright (c) 2008-2015, Ph. Grosjean (phgrosjean@sciviews.org) & K. Barton
 * 
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */

/*globals parent: true, self, navigator, document,
   Components, unescape, escape, Services
   */

/* jshint unused: false */

let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
        .getService(Components.interfaces.nsIWindowMediator);
let w = wm.getMostRecentWindow("Komodo");
var ko = w.ko;
var require = w.require;
var logger = require("ko/logging").getLogger("komodoR");

if(!w.log) w.log = require("ko/logging").getLogger("wtf");

var PrefR_CranMirrors = { http : [], https : [] }/*, PrefR_CMSecure*/;

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

if (typeof Services === "undefined") 
Cu.import("resource://gre/modules/Services.jsm");

const { arr: ArrayUtils/*, str: StringUtils*/ } = require("kor/utils");
const fileUtils = require("kor/fileutils");

var currentPrefset = null;

// List of R applications
// Constructor
function RAppSpecs(id, name, path, app, required, platform, isGui = false) {
	this.id = id;
	this.name = name;
	this.path = path;
	this.app = app;
	this.required = required? required.split(/\s*,\s*/) : [];
	this.platform = platform? platform : "";
	this.isGui = Boolean(isGui);
}

var apps = [
new RAppSpecs("", "Choose...", "", "", "", "lmw"),
new RAppSpecs("r-terminal", "in default terminal", "x-terminal-emulator -e '%Path%'%args%", "R", "x-terminal-emulator,R", "lm"),
new RAppSpecs("r-terminal", "in console window", "\"%Path%\" %args%", "R.exe", "R", "w"),
new RAppSpecs("r-xterm", "in console window", "xterm -title '%title%' -e '%Path%'%args%", "R", "R,xterm", "lm"),
new RAppSpecs("r-gnome-terminal", "in Gnome terminal", "gnome-terminal --hide-menubar --working-directory='%cwd%' -t '%title%' -x '%Path%' %args%", "R", "gnome-terminal,R", "l"),
new RAppSpecs("r-konsole", "in Konsole", "konsole --workdir '%cwd%' --title '%title%' -e \"%Path%\" %args%", "R", "konsole,R", "l"),
new RAppSpecs("r-lxterminal", "in LXTerminal", "lxterminal --title='%title%' -e \"%Path%\" %args%", "R", "lxterminal,R", "l"),
new RAppSpecs("r-xfce4-terminal", "in XFCE terminal", "xfce4-terminal --title \"%title%\" -x \"%Path%\" %args%", "R",  "xfce4-terminal,R", "l"),
new RAppSpecs("r-app", "R.app", "open -a \"%Path%\" \"%cwd%\"", "R.app", "/Applications/R.app", "m", true),
new RAppSpecs("r-gui", "R GUI","\"%Path%\" --sdi %args%", "Rgui.exe", "Rgui", "w", true),
new RAppSpecs("r-tkgui", "R Tk GUI", "'%Path%' --interactive --gui:Tk %args%", "R", "R", "lm", true)
];

var getDialogs = () => ko.dialogs;

function PrefR_OnLoad(/*event*/) {
    logger.debug("PrefR_OnLoad: " + parent.hPrefWindow.contentFrame.contentDocument.location.href);
	let myurl = "chrome://komodor/content/pref-R.xul";
	
    // workaround for Komodo bug: languages tree is empty while parent item is
    // open. switchToPanel does not work in that case.
    try {
        if(parent.hPrefWindow.contentFrame.contentDocument.location.href !== myurl) {
            logger.warn("PrefR_OnLoad: problem with switching to PrefR panel. Trying to work it around.");
            parent.hPrefWindow.onpageload();
            parent.hPrefWindow.contentFrame = parent.hPrefWindow.contentFrames[myurl];
            let ftv = parent.hPrefWindow.filteredTreeView;
            ftv.removeFilter();
            let langTreeItemIdx = ftv.getIndexById("languagesItem");
            let n = 1 + ftv.isContainerOpen(langTreeItemIdx);
            for(let i = 0; i < n; ++i) ftv.toggleOpenState(langTreeItemIdx, true);
            parent.switchToPanel("svPrefRItem");
        }
    } catch(e) {
        logger.exception(e, "PrefR_OnLoad");
    }
	parent.hPrefWindow.onpageload();
}

function getSelectedInterpreterPath() {
    let path = document.getElementById("RInterface.pathToR").value;
    if (path && fileUtils.exists(path) === fileUtils.TYPE_FILE)
        return path;
    else return null;
}

function populateRunRAs() {
	logger.debug("running populateRunRAs. apps is " + (Array.isArray(apps) ? "array" : (typeof apps)));
	if(!Array.isArray(apps)) return;
	
    var menu = document.getElementById("RInterface.runRAs");
	// Remove the 'Choose...' menu option on first showing
	if(currentPrefset.getStringPref("RInterface.runRAs") === '') {
		menu.addEventListener("popupshowing", (/*event*/) => {
			if (menu.getItemAtIndex(0).value === '') menu.removeItemAt(0);
		}, true);
	} else 
		apps.shift();

    var platform = navigator.platform.substr(0, 1).toLowerCase();
	apps = apps.filter(
	    a => (a.platform.indexOf(platform) !== -1) && 
	         (!a.required.length || 
			 a.required.every(y => fileUtils.whereIs(y).length !== 0))
		);
		
	menu.removeAllItems();
	
	var tmp = {};
	for (let i = 0; i < apps.length; ++i) {
		tmp[apps[i].id] = apps[i];
		let item = menu.appendItem(apps[i].name, apps[i].id, null);
        item.setAttribute("image", "koicon://ko-svg/chrome/komodor/skin/images/" + (apps[i].isGui ? "rgui" : "rterm") + ".svg");
        item.className = "menuitem-iconic";
	}
	apps = tmp;
	tmp = null;
}

// Used at startup
function menuListSetValues(attribute = "values") {
	var ml = document.getElementsByTagName('menulist');
	var el, values, v;
	for (let i = 0; i < ml.length; ++i) {
		el = ml[i];
		if (el.hasAttribute(attribute)) {
			values = el.getAttribute(attribute).split(/\s+/);
			el.removeAllItems(); // XXX
			for (let k = 0; k < values.length; ++k) {
                v = unescape(values[k]);
                el.appendItem(v, v, null);
			}
		}
	}
}

function processCranMirrorsCSV(content) {
    logger.debug(`processCranMirrorsCSV(content=${Boolean(content)})`);

	if (!content) return;
	// Convert CSV string to Array:
	var arrData = require("kor/csv").toArray(content);
	var colNames = arrData.shift(1);
	var colName = colNames.indexOf("Name");
	var colCountry = colNames.indexOf("Country");
	var colCity = colNames.indexOf("City");
	var colURL = colNames.indexOf("URL");
	var colHost = colNames.indexOf("Host");
	var colOK = colNames.indexOf("OK");
	var colCountryCode = colNames.indexOf("CountryCode");

	var /*name, url,*/ item;
	PrefR_CranMirrors.http.splice(0);
	PrefR_CranMirrors.https.splice(0);
	var rx = / *\[https\]$/;
	for (let i = 0; i < arrData.length; ++i) {
		item = arrData[i];
		if (item[colOK] != "1" || (item[colURL].search(/^(f|ht)tps?:\/\//) !== 0)) continue;
		var secure = arrData[i][colURL].indexOf("https") === 0;
		var which = secure ? "https" : "http";
		PrefR_CranMirrors[which].push([
			secure ? item[colName].replace(rx, "") : item[colName],
			item[colCountry],
			item[colName].indexOf(item[colCity]) == -1 ? item[colCity] : "", // no city if included in name 
			item[colURL], item[colHost], item[colCountryCode]
			]);
	}
}

// Get CRAN mirrors list - independently of R
// FIXME: if no connection it gets stuck
// FIXME: doesn't update immediately if R interpreter changed and list is empty
function doUpdateCranMirrorList(fromCran) {
    logger.debug(`doUpdateCranMirrorList(fromCran=${fromCran})`);
    
	// Get data in as CSV:
	var csvName = "CRAN_mirrors.csv", encoding = "utf-8";
	var jsonFile = fileUtils.path(fileUtils.path("PrefD", "extensions", 
		require("kor/main").extensionId), "CRAN_mirrors.json");
	
	var cranBaseUri = "http://cran.r-project.org/"; // https?

	if (fromCran) {
		document.getElementById("CRANMirrorDescr").value =
			"Fetching file: " + cranBaseUri + csvName + " ...";
		
		fileUtils.readURIAsync(cranBaseUri + csvName, encoding,
			function callback(content) {
				processCranMirrorsCSV(content, jsonFile);
				fileUtils.write(jsonFile, JSON.stringify(PrefR_CranMirrors), encoding);
				// DEBUG
				//var csvFile = fileUtils.path(fileUtils.path("PrefD", "extensions",
					//"komodor@komodor"), "CRAN_mirrors_" + (new Date()).toLocaleFormat("%Y%m%d%H%M") + ".csv");
				//fileUtils.write(csvFile, content, encoding);
				// END DEBUG
				require("kor/command").fireEvent(self, "r_cran_mirrors_updated");
			}, function onError(/*err*/) {
				doUpdateCranMirrorList(false);
			});
		return;
	}
	
	// First, check if there is serialized version:
	if (fileUtils.exists(jsonFile)) {
        logger.debug(`doUpdateCranMirrorList(fromCran=${fromCran}): reading data from jsonFile`);
		PrefR_CranMirrors = JSON.parse(fileUtils.read(jsonFile, encoding));
		require("kor/command").fireEvent(self, "r_cran_mirrors_updated");
	} else {
		let localPaths = [];
        let platform = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS.toLowerCase();
		if (platform === "winnt") {
            var rHome = getSelectedInterpreterPath();
            let rx = /(bin\\(?:(?:x64|i386)\\)?R(?:gui|term)?)\.exe$/i;
			if(!rHome || rHome === "R") {
                let rPaths = fileUtils.whereIs("R", true);
                if (rPaths.length === 0) rPaths = fileUtils.whereIs("R");
                if (rPaths.length === 0) return;
                rPaths = ArrayUtils.unique(rPaths.map(x => x.replace(rx, "")));
				localPaths = rPaths.map(x => fileUtils.path(x, "doc"));
			} else 
				localPaths = [ fileUtils.path(rHome.replace(rx, ""), "doc") ];

            logger.debug("looking for CRAN_mirrors.csv in local paths:\n" + localPaths.join("\n"));
			
		} else { // if (platform == "lin")
			localPaths.push('/usr/share/R/doc'); 	// try other paths: // mac: ????
			localPaths.push('/usr/local/share/R/doc');
		}
		var file;
		for (let i = 0; i < localPaths.length; ++i) {
			file = fileUtils.getLocalFile(localPaths[i], csvName);
			if (file.exists()) {
                logger.debug(`doUpdateCranMirrorList(fromCran=${fromCran}): reading data from ${file.path}`);
                
				processCranMirrorsCSV(fileUtils.read(file.path, encoding));
				fileUtils.write(jsonFile, JSON.stringify(PrefR_CranMirrors), encoding);
				require("kor/command").fireEvent(self, "r_cran_mirrors_updated");
				return;
			}
		}
		
		// fallback: use CRAN cloud
		var cmCloudUri = "http://cloud.r-project.org/";
		var descr = "CRAN mirror list could not be found on the system. " +
		    "Click \"Refresh\" to update from the main CRAN server.";
			
		var typeIterator = ["http", "https"].entries();
		for (let type of typeIterator)
			PrefR_CranMirrors[type].splice(0, PrefR_CranMirrors[type[1]].length, 
		   ["cloud", "", "", cmCloudUri.replace(/^[fhtps]+(?=:)/, type[1]), descr, ""]);
			
		require("kor/command").fireEvent(self, "r_cran_mirrors_updated");
	}
}

function updateCranMirrorListAsync(fromCran = false) {
	var button = document.getElementById("RefreshCRANMirrors");
	button.setAttribute("label", "Updating mirrors...");
	button.disabled = true;
	doUpdateCranMirrorList(fromCran);
}

var getSelectedCranMirrorUseSecure = () => Boolean(document.getElementById("CRANMirrorSecure").checked);

var getSelectedCranMirror = () => {
	var j = document.getElementById("CRANMirror").selectedIndex;
	var cranMirrors = PrefR_CranMirrors[getSelectedCranMirrorUseSecure() ? "https" : "http"];
	if (j < 0 || j >= cranMirrors) j = 0; 
	return cranMirrors[j];
};

var formatR_checkIfAvailable = (pathToR) => {
	var callback = (ok) => {
		document.getElementById("no-avail-formatR-message").style.visibility = (ok === true) ? "collapse" : "visible";
	};
    require("kor/main").rCliExec(pathToR, "cat(length(find.package('formatR',quiet=TRUE)))").then(x => {
        if (/^\d+$/.test(x)) callback(parseInt(x) > 0);
        else throw new Error("Response not recognized");
    }).catch(callback);
};

var formatR_install = () => {
	let cmd = `install.packages('formatR',repos='${getSelectedCranMirror()[3L]}');cat(length(find.package('formatR',quiet=TRUE)))`;
	let pathToR = getSelectedInterpreterPath();
	require("kor/main").rCliExec(pathToR, cmd).then(str => {
        let success = str.endsWith("1");
        getDialogs().alert(`R ${success ? "has installed" : "could not install"} package 'formatR'.`,
            str.substr(0, str.length - 1).trim(), "R interface preferences");
        document.getElementById("no-avail-formatR-message").style.visibility = success ? "collapse" : "visible";
	});
};


//TODO: check if there is new R version installed and ask whether to switch to it.
function populatePathToR() {

    var prefExecutable = currentPrefset.getStringPref('RInterface.pathToR');

    var rs;
    const os = Services.koOs;
    var menu = document.getElementById("RInterface.pathToR");

    switch (os.name) { //'posix', 'nt', 'mac', 'os2', 'ce', 'java', 'riscos'.
        case "nt":
			// TODO: sort by version:
			rs = fileUtils.whereIs("Rgui").concat(fileUtils.whereIs("R"));
			break;
        case "mac":
			rs = ["/Applications/R.app"];
			break;
        case "posix":
			/* falls through */
        default:
			rs = fileUtils.whereIs("R");
    }

	//if(prefExecutable != "") rs.unshift(prefExecutable);

    for (let i = 0; i < rs.length; ++i) {
        rs[i] = os.path.normpath(rs[i]);
        if (fileUtils.exists(rs[i]) === fileUtils.TYPE_NONE)
            rs.splice(i, 1);
        }
    rs = ArrayUtils.unique(rs); // Get rid of duplicates
	if((prefExecutable === "") || (rs.indexOf(prefExecutable) === -1)) {
		currentPrefset.setStringPref("RInterface.pathToR", "R");
		prefExecutable = "R";
	}
	var rFound = rs.length != 0 && rs.every(Boolean);
	
	rs.unshift("R;Find on path");

	var curValue = menu.value || "R";
    menu.removeAllItems();
	for (let i = 0; i < rs.length; ++i) {
		let r = rs[i].split(";");
        let item = menu.appendItem(r[0], r[0], r.length < 2 ? null : r[1]);
		if (curValue === r[0]) menu.selectedIndex = i;
		let isGui = r[0].endsWith("Rgui.exe") || r[0].endsWith("R.app");
		item.setAttribute("image", "koicon://ko-svg/chrome/komodor/skin/images/" + (isGui ? "rgui" : "rterm") + ".svg");
        item.className = "menuitem-iconic";
    }
    
	document.getElementById("no-avail-interps-message").hidden = rFound;
	//if (require("kor/command").isRRunning)
	document.getElementById("formatR-install-offer").style.visibility = "visible";
	
	formatR_checkIfAvailable(prefExecutable);
}

var resetToDefault = (prefName) => {
    var korPrefs = require("kor/prefs");
    if(!prefName || !korPrefs.defaults.hasOwnProperty(prefName)) return;
    var prefs = new korPrefs.PrefsetExt(currentPrefset);   
    prefs.setPref(prefName, korPrefs.defaults[prefName]);
    var control = document.getElementById(prefName);
    if(!control) return;
    control.value = prefs.getPref(prefName);
};

function OnPreferencePageInitalize(prefset) {
    logger.info("OnPreferencePageInitalize");
    currentPrefset = prefset;
    
    // for Komodo != 9, show/hide elements related to "advanced" option
    if(!parent.document.getElementById("toggleAdvanced")) {
        let elementsToHide = document.getElementsByAttribute("hiddenPre9", "*");
        for(let i = 0; i < elementsToHide.length; ++i)
            elementsToHide[i].setAttribute("hidden", elementsToHide[i].getAttribute("hiddenPre9"));
    }

    var korPrefs = require("kor/prefs");
    var prefs = new korPrefs.PrefsetExt(currentPrefset);
	prefs.setDefaults(false, korPrefs.defaults); // Check if all preference values are ok, if not, restore defaults
    korPrefs.setDefaults();
    
    //let str = Object.keys(korPrefs.defaults).map((i) => `${i} = ${prefs.getPref(i)}/ ${korPrefs.getPref(i)} (${prefs._prefset.getPrefType(i)})`);
    //ko.dialogs.alert("R preferences:", str.join("\r\n"), "Komodo-R interface");
 
    populateRunRAs();
    populatePathToR();
    
	document.getElementById("CRANMirror").addEventListener("focus", (event) => {
		var menu = event.target;
		if(!menu.updated && menu.itemCount === 0) {
			updateCranMirrorListAsync();
			menu.updated = true;
		}
	}, true);
   
   menuListSetValues(); // Restores saved menu values
}

// For menulists, take the 'value' argument or text in the textbox, and append
// it as new element to the list if it is new, otherwise set as selected
function editMenulist(el, value) {
	var curValue, values = [], val;
	curValue = !value ? el.value.trim() : value;
	if (!curValue) return;
	for (let j = 0; j < el.itemCount; ++j) {
		val = el.getItemAtIndex(j).value;
		if (val === curValue) {
			el.selectedIndex = j;
			return;
		}
		values.push(val);
	}
	el.appendItem(curValue, curValue, null);
}

// Used on closing. Store menulist items in an attribute "values"
function menuListGetValues(attribute) {
	if (!attribute) attribute = 'values';
	var ml = document.getElementsByTagName('menulist');
	var el, values;
	for (let i = 0; i < ml.length; ++i) {
		el = ml[i];
		if (el.editable && el.hasAttribute(attribute)) {
			values = [];
			for (let k = 0; k < el.itemCount; ++k) {
				values.push(escape(el.getItemAtIndex(k).value));
			}

			values = ArrayUtils.unique(values);
			var nMax = parseInt(el.getAttribute('maxValues'));
			if(nMax > 0) values = values.slice(0, nMax);
			el.setAttribute(attribute, values.join(' '));
		}
	}
}

function menulistFindIndex(menuList, callback) {
	for (let i = 0; i <= menuList.itemCount; ++i) {
		let item = menuList.getItemAtIndex(i);
		if (item && callback(item)) return i;
	}
	return -1;
}

function updateRVersionLabel(pathToR) {
	if (!pathToR) pathToR = document.getElementById("RInterface.pathToR").value;
    var label = document.getElementById("RVersionLabel");
    label.value = "...";
    if (!pathToR) return;
	require("kor/main").checkRVersion(pathToR).then(s => {
		label.value = s;
	}).catch(() => {
		label.value = "";
	});
}

function updateRCmdArgsFrom(input) {
    var cmdArgs0 = document.getElementById("RInterface.cmdArgs").value;
    var remove = input.checked == input.rcmdl.no;
    var userArgsPos = cmdArgs0.search(/\s--args\s/);
    var cmdArgs = (userArgsPos !== -1) ? cmdArgs0.substr(0, userArgsPos) : cmdArgs0;
    var rx = input.rcmdl.regExp;
    if(remove) cmdArgs = cmdArgs.replace(rx, " ");
         else if(cmdArgs.search(rx) === -1)
            cmdArgs = input.rcmdl.argName + " " + cmdArgs;
    if(userArgsPos !== -1) cmdArgs += cmdArgs0.substr(userArgsPos);
    document.getElementById("RInterface.cmdArgs").value = cmdArgs;
}

function updateOptionsFromCmdl() {
    var cmdArgs = document.getElementById("RInterface.cmdArgs").value;
    var userArgsPos = cmdArgs.search(/\s--args\s/);
    cmdArgs = (userArgsPos !== -1) ? cmdArgs.substr(0, userArgsPos) : cmdArgs;

    var inputs = document.getElementsByAttribute("rcmdlArgs", "*");
    var input;
    for(let i = 0; i < inputs.length; ++i) {
        input = inputs[i];
        input.checked = (cmdArgs.search(input.rcmdl.regExp) === -1) === input.rcmdl.no;
        // XXX: weird behaviour of test/exec, result changes every 2-nd call
        //input.checked = input.rcmdl.regExp.test(cmdArgs) != input.rcmdl.no;
    }
}

function updateRCommand(update) {
    var appId = document.getElementById("RInterface.runRAs").value;
	var appPath = document.getElementById("RInterface.pathToR").value;
    if(!appId || !appPath) return '';

    var cmdArgs = document.getElementById("RInterface.cmdArgs").value;
	var args1 = "";

   	var cwd = fileUtils.path("ProfD", "extensions", require("kor/main").extensionId, "R");

	cmdArgs = cmdArgs.replace(/\s*--[sm]di\b/, "");

	var argsPos = cmdArgs.indexOf("--args");
	if (argsPos != -1) {
		args1 += " " + cmdArgs.substring(argsPos + 6).trim();
		cmdArgs = cmdArgs.substring(0, argsPos);
	}
	if(cmdArgs) cmdArgs = " " + cmdArgs.trim();

	args1 = args1.trim();
	if (args1) args1 = " --args " + args1;

    var cmd = apps[appId].path;
	cmd = cmd.replace("%Path%", appPath)
		.replace("%title%", "R [Komodo]").replace("%cwd%", cwd)
		.replace("%args%", cmdArgs) + args1;
    
    if(update) document.getElementById('RInterface.RCommand').value = cmd;

    return cmd;
}

function onCmdlOptionsChecked(input) {
    updateRCmdArgsFrom(input);
    updateRCommand(true);
}

function onUserEditCommandLine() {
    updateOptionsFromCmdl();
    updateRCommand(true);
}

function OnPreferencePageLoading(prefset) {
    logger.debug("OnPreferencePageLoading");
    currentPrefset = prefset;

//    let boolPrefs = ['CRANMirrorSecure', 'RInterface.format.keepBlankLines',
//					 'RInterface.format.replaceAssign', 'RInterface.format.newlineBeforeBrace'];
//
//    boolPrefs.forEach((prefName) => {
//		document.getElementById(prefName).checked = currentPrefset.getBooleanPref(prefName);
//	});

	// DEBUGGING in JSShell:
	// scope(Shell.enumWins[2]) //chrome://komodo/content/pref/pref.xul
	// scope(frames[0])

  // if (prefset.getStringPref("RInterface.pathToR") != "") {
		// // update cran mirror list (first local, then tries remote at CRAN)
		// updateCranMirrorListAsync();
	// } else {
		// var el = document.getElementById("CRANMirror");
		// el.disabled = true;
		// el.tooltipText = "Select R interpreter first";
	// }
	// XXX: workaround for empty preference values...
	//var prefElements = document.getElementsByAttribute("pref", "true");
	//for (let i = 0; i < prefElements.length; ++i)
		//prefElements[i].value = prefs.getPref(prefElements[i].id);

    let cmdLabel = document.getElementById('RInterface.RCommand');
    cmdLabel.setAttribute("defaultValue", updateRCommand(false));

    var cmdArgs = document.getElementById("RInterface.cmdArgs").value;

    var inputs = document.getElementsByAttribute("rcmdlArgs", "*");
    var input, argNames, remove, rx;
    for(let i = 0; i < inputs.length; ++i) {
        input = inputs[i];
        argNames = input.getAttribute("rcmdlArgs");
        if((remove = argNames.startsWith("!"))) argNames = argNames.substr(1);
        argNames = argNames.split(/\s+/);
        rx = RegExp("(?:^|\\s)(" + argNames.map(a => (a.length == 1 ? "-" : "--") + a).join("|") + ")(?:$|\\s+)", "g");
        //input.checked = rx.test(cmdArgs) != remove; // no ===
        input.checked = (cmdArgs.search(rx) === -1) === remove;
        input.rcmdl = {
        	regExp: rx,
        	argName: (argNames[0].length == 1 ? "-" : "--") + argNames[0],
        	no: remove
        };
    }
 
	updateCranMirrorListAsync(false);
	updateRVersionLabel();
    
} //PrefR_OnLoad

//function OnPreferencePageClosing(prefset, ok) {}

function OnPreferencePageOK(prefset) {
    try {
      
    //var prefs = new (require("kor/prefs")).PrefsetExt(prefset);
    //let str = Object.keys(require("kor/prefs").defaults).map((i) => `${i} = ${prefs.getPref(i)} (${prefset.getPrefType(i)})`);
    //ko.dialogs.alert("R preferences:", str.join("\r\n"), "Komodo-R interface");
	
        var outDec = document.getElementById('RInterface.CSVDecimalSep').value;
        var outSep = document.getElementById('RInterface.CSVSep').value;
    
        // "Preference widget" does not save newly added values for some reason:
        prefset.setStringPref("RInterface.CSVSep", outSep);
    
        if (outDec === outSep) {
            parent.switchToPanel("svPrefRItem");
			document.getElementById("RInterface.CSVSep").focus();
            getDialogs().alert(
                "Decimal separator cannot be the same as field separator.", null,
                "R interface preferences");
            return false;
        }

		let CRANMirror = getSelectedCranMirror();
		if (CRANMirror) prefset.setStringPref("CRANMirror", CRANMirror[3]);
    
        const rConn = require("kor/connector"), r = require("kor/r");
    
        if (outDec !== prefset.getStringPref('RInterface.CSVDecimalSep') ||
            outSep !== prefset.getStringPref('RInterface.CSVSep')) {
            rConn.evalAsync('base::options(OutDec=' + r.arg(outDec) + ', ' +
            'OutSep=' + r.arg(outSep) + ')', null, true);
        }
    
        var newServerPort = parseInt(document.getElementById('RInterface.RPort').value);
		var newClientPort = parseInt(document.getElementById('RInterface.koPort').value);
		
		
		if(newClientPort === newServerPort) {
			parent.switchToPanel("svPrefRItem");
			document.getElementById("RInterface.RPort").focus();
            getDialogs().alert(
                "Server and client port numbers cannot be equal.", null,
                "R interface preferences");
            return false;
		}
		
        var currentClientPort = rConn.getSocketPref("RInterface.koPort");
        
        if (rConn.serverIsUp &&
            newClientPort != currentClientPort) {
            let connected = rConn.isRConnectionUp(true);
    
            if(getDialogs().yesNo("Server port changed (from " + currentClientPort +
                                " to " + newClientPort + "), would you like to " +
                                "restart it now?" +
                (connected? "You will lose the current connection to R." : ""),
                connected? "No" : "Yes",
                null, "R interface preferences") == "Yes") {
                    rConn.restartSocketServer();
            }
        }
        menuListGetValues();
        
    } catch(ex) {
        logger.exception(ex);
        return parent.ignorePrefPageOKFailure(prefset, "Saving R Interface settings failed, with message",
            ex.toString());
    }
	return true;
}

function rInterpreterOnSelect(/*event*/) {
	const os = Services.koOs;
	var menuApplication = document.getElementById("RInterface.runRAs");
    var menuPathToR = document.getElementById("RInterface.pathToR");
	var value = menuPathToR.value;

	// Just in case
	if((value !== "R") && (fileUtils.exists(value) === fileUtils.TYPE_NONE)) {
		getDialogs().alert("Cannot find file: " + value, null,
			"R interface preferences");
	}

    var exeName = os.path.basename(value);
    if (os.name === "nt" && !exeName.toLowerCase().endsWith(".exe")) exeName += ".exe"; 
    if (!(menuApplication.value in apps) || apps[menuApplication.value].app != exeName) {
        let i;
		for (i in apps) if (apps.hasOwnProperty(i) && apps[i].app === exeName) break;
        menuApplication.value = i;
    }

    updateRCommand(true);
	updateRVersionLabel(value);
	formatR_checkIfAvailable(value);

	var el = document.getElementById("CRANMirror");
	el.tooltipText = "";
	el.disabled = false;
	updateCranMirrorListAsync();
}

function rRunAsOnSelect(event) {
	var menuApplication = document.getElementById("RInterface.runRAs");
    var menuPathToR = document.getElementById("RInterface.pathToR");
	if (!(menuApplication.value in apps)) return;

    var app = apps[menuApplication.value].app;
	//var sel = menuApplication.selectedItem;

	const os = Services.koOs;

    if (os.path.basename(menuPathToR.value) !== app) {
		menuPathToR.selectedIndex = menulistFindIndex(menuPathToR,
			(item) => os.path.basename(item.getAttribute("value")) === app);
    }
    updateRCommand(true);
	updateRVersionLabel(menuPathToR.value);
}

function addCustomPathToR(path) {
    var menu = document.getElementById("RInterface.pathToR");
	var os;
    if (!path || !fileUtils.exists(path)) {
		os = Cc['@activestate.com/koOs;1'].getService(Ci.koIOs);
		path = menu.value;
        path = ko.filepicker.browseForExeFile(os.path.dirname(path), os.path.basename(path),
			"Select R executable");
	}
    if (!path) return;
    path = os.path.normpath(path);

    editMenulist(menu, path);
    menu.value = path;
    updateRVersionLabel(path);
}

function setCranMirrorsSecure(secure) {
	currentPrefset.setBooleanPref('CRANMirrorSecure', Boolean(secure));
	require("kor/command").fireEvent(self, "r_cran_mirrors_updated");
}

function OnCranMirrorChange() {
	require("kor/command").fireEvent(self, "r_cran_mirrors_updated");
}

function populateCranMirrorList(secure) {
    logger.debug("populateCranMirrorList");
    
    try {
        var menuList = document.getElementById("CRANMirror");
        var value;
        if (menuList.value) {
            value = JSON.parse(menuList.value);
            value.unshift(menuList.label);
        } else {
            let mirrorType, valIdx1;
            try {
                let url = currentPrefset.getString("CRANMirror");
                mirrorType = url.startsWith("https") ? "https" : "http";
                valIdx1 = PrefR_CranMirrors[mirrorType].findIndex(elem => elem[3] === url);
                if (valIdx1 === -1) valIdx1 = 0;
            } catch(e) {
                mirrorType = secure ? "https" : "http";
                valIdx1 = 0;
                //url = PrefR_CranMirrors[mirrorType][valIdx1][3];
            }
            if(PrefR_CranMirrors[mirrorType].length > valIdx1)
                value = PrefR_CranMirrors[mirrorType][valIdx1].slice(0, 3);
        }
        
        var data, which;
        which = secure ? "https" : "http";
        data = PrefR_CranMirrors[which];
    
        menuList.removeAllItems();
        for (let i = 0; i < data.length; ++i) { // Name, Country, City, URL, Host, cc
            let item = menuList.appendItem(data[i][0], JSON.stringify(data[i].slice(1, 3)), data[i][2]);
            item.setAttribute("image", "chrome://komodor/skin/images/flags/" + data[i][5] + ".gif");
            item.className = "menuitem-iconic";
        }
            
        if (!value) return;
        var valIdx;
        valIdx = data.findIndex((elem) => elem[0] == value[0]);
        if (valIdx == -1)
            valIdx = data.findIndex((elem) => elem[1] == value[1] && elem[2] == value[2]);
        if (valIdx == -1)
            valIdx = data.findIndex((elem) => elem[1] == value[1]);
        if (valIdx == -1) valIdx = 0;
        menuList.selectedIndex = valIdx;
    
    } catch(e) {
        logger.exception(e, "in populateCranMirrorList");
    }
   
}

function onCranMirrorListUpdated() {
	logger.debug("onCranMirrorListUpdated");
    populateCranMirrorList(getSelectedCranMirrorUseSecure());
	var item = getSelectedCranMirror();
	if (item) document.getElementById("CRANMirrorDescr").value = "Mirror host: " + item[4];

    var menuList = document.getElementById("CRANMirror");
	if (menuList.itemCount == 0 && !getSelectedInterpreterPath()) {
		menuList.disabled = true;
		menuList.tooltipText = "Select R interpreter first";
	}
	
	var button = document.getElementById("RefreshCRANMirrors");
	if (button.disabled) {
		button.setAttribute("label", "Refresh list");
		button.disabled = false;
    }
}


// TODO
function onStylesheetSelect() {
    var uri = control.value.trim();
    const fu = require("kor/fileutils");
    
    fu.pathFromURI(uri);
    
    var file = require("kor/ui").browseForFile(path, filename, null, "Stylesheets|*.css", false, false);
    control.value = fu.toFileURI(file);
}


addEventListener("load", PrefR_OnLoad, false);
addEventListener("r_cran_mirrors_updated", onCranMirrorListUpdated, false);
