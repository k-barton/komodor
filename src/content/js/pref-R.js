/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *  Copyright (c) 2011-2017 Kamil Barton
 *  
 *  This code is based on SciViews-K code:
 *  Copyright (c) 2008-2015, Ph. Grosjean (phgrosjean@sciviews.org) & K. Barton
 * 
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */

/*globals parent, self, navigator, document,
   Components, unescape, escape, xtk */

var sv, ko;

var PrefR_CranMirrors = { http : [], https : [] };
var PrefR_CMSecure;

if (typeof self.xtk === "undefined")
	xtk = parent.opener.xtk;

xtk.include('domutils');

// For menulists, take the 'value' argument or text in the textbox, and append
// it as new element to the list if it is new, otherwise set as selected
function editMenulist(el, value) {
	var curValue, values = [], val;
	curValue = !value ? sv.string.trim(el.value) : value;
	if (!curValue) return;
	for (let j = 0; j < el.itemCount; ++j) {
		val = el.getItemAtIndex(j).value;
		if (val == curValue) {
			el.selectedIndex = j;
			return;
		}
		values.push(val);
	}
	el.appendItem(curValue, curValue, null);
}

// Used at startup
function menuListSetValues(attribute) {
	if (!attribute) attribute = 'values';
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

			values = sv.array.unique(values);
			var nMax = parseInt(el.getAttribute('maxValues'));
			if(nMax > 0) values = values.slice(0, nMax);
			el.setAttribute(attribute, values.join(' '));
		}
	}
}

function menulistSetValue(menuList, value, attrName, vdefault) {
	var n = menuList.itemCount;
	var item;
	for (let i = 0; i <= n; ++i) {
		item = menuList.getItemAtIndex(i);
		if (item) {
			let attr1 = item.hasAttribute(attrName) ? item.getAttribute(attrName)
            	: vdefault;
			if (attr1 == value) {
				menuList.selectedIndex = i;
				break;
			}
		}
	}
}

// List of R applications
// Constructor
function _App(id, name, path, app, required, platform) {
	this.id = id;
	this.name = name;
	this.path = path;
	this.app = app;
	this.required = required? required.split(/\s*,\s*/) : [];
	this.platform = platform? platform.split(/\s*,\s*/): [];
}

var apps = [
new _App("", "Choose...", "", "", "", "Lin,Mac,Win"),
new _App("r-terminal", "in default terminal", "x-terminal-emulator -e '%Path%'%args%", "R", "x-terminal-emulator,R", "Lin,Mac"),
new _App("r-terminal", "in console window", "\"%Path%\" %args%", "R.exe", "R", "Win"),
new _App("r-gnome-term", "in Gnome terminal", "gnome-terminal --hide-menubar --working-directory='%cwd%' -t '%title%' -x '%Path%' %args%", "R", "gnome-terminal,R", "Lin"),
new _App("r-kde-term", "in Konsole", "konsole --workdir '%cwd%' --title %title% -e \"%Path%\" %args%", "R", "konsole,R", "Lin"),
new _App("r-xfce4-term", "in XFCE terminal", "xfce4-terminal --title \"%title%\" -x \"%Path%\" %args%", "R",  "xfce4-terminal,R", "Lin"),
new _App("r-app", "R app", "open -a \"%Path%\" \"%cwd%\"", "R.app", "/Applications/R.app", "Mac"),
new _App("r-gui", "R GUI","\"%Path%\" --sdi %args%", "Rgui.exe", "Rgui", "Win"),
new _App("r-tk", "R Tk GUI", "'%Path%' --interactive --gui:Tk %args%", "R", "R", "Lin,Mac")
];

function getSelectedInterpreterPath() {
	var path = document.getElementById("RInterface.pathToR").value;
	if(path && sv.file.exists(path) == sv.file.TYPE_FILE) {
		return path;
	} else return null;
}

//var getDialogs = () => {
//    var p = parent;
//    var dialogs = ko.dialogs;
//    while (p.opener && (p = p.opener) && !dialogs.yesNo)
//        if (p.ko && p.ko.dialogs && p.ko.dialogs.yesNo)
//            dialogs = p.ko.dialogs;
//    return dialogs;
//};

var getDialogs = () => ko.dialogs;

//var getKoObject = (name, item) => {
//    var p = parent;
//    var rval = ko[name];
//    while (p.opener && (p = p.opener) && !rval[item])
//        if (p.ko && p.ko[name] && p.ko[name][item])
//            rval = p.ko[name];
//    return rval;
//};

function PrefR_OnLoad(/*event*/) {

    // Get the sv object:
	var p = parent;
	while (p.opener && (p = p.opener) && !sv) if (p.sv) {
		sv = p.sv;
		ko = p.ko;
	}
	
	if (!ko.logging || !ko.logging.getLogger) 
        ko.logging = parent.opener.require("ko/logging");


    // for Komodo != 9, show/hide elements related to "advanced" option
	// sv._versionCompare(ko.version, "9.0.0") != 0 // but no 'ko' available here
    if(!parent.document.getElementById("toggleAdvanced")) {
        let elementsToHide = document.getElementsByAttribute("hiddenPre9", "*");
        for(let i = 0; i < elementsToHide.length; ++i)
            elementsToHide[i].setAttribute("hidden", elementsToHide[i].getAttribute("hiddenPre9"));
    }


	// Note: setting temporary prefset, will be reverted to ko.prefs at closing
	prefset = parent.hPrefWindow.prefset;
	var svPrefset = sv.pref.prefset;
	sv.pref.prefset = prefset;
	sv.pref.setDefaults(); // Check if all preference values are ok, if not, restore defaults

	PrefR_CMSecure = prefset.getBooleanPref('CRANMirrorSecure');
	document.getElementById("CRANMirrorSecure").checked = PrefR_CMSecure; // ?

	var menu1 = document.getElementById("CRANMirror");
	menu1.addEventListener("focus", function(event) {
		var menu1 = event.target;
		if(!menu1.updated && menu1.itemCount == 0) {
			PrefR_UpdateCranMirrorsAsync(false);
			menu1.updated = true;
		}
	}, true);


    var menu = document.getElementById("RInterface.runRAs");
	// Remove the 'Choose...' menu option on first showing
	if(prefset.getStringPref("RInterface.runRAs") == '') {
		menu.addEventListener("popupshowing", function(event) {
			if (menu.getItemAtIndex(0).value == '') menu.removeItemAt(0);
		}, true);
	} else {
		apps.shift();
	}
    var platform = navigator.platform.substr(0, 3);
	apps = apps.filter(
	    a => (a.platform.indexOf(platform) != -1) && 
	         (!a.required.length || 
			 a.required.every(y => sv.file.whereIs(y).length != 0))
		);
		
	var tmp = {};
	for (let i in apps) tmp[apps[i].id] = apps[i];
	apps = tmp;

	menu.removeAllItems();
    for (let i in apps) menu.appendItem(apps[i].name, i, null);

	// DEBUGGING in JSShell:
	// scope(Shell.enumWins[2]) //chrome://komodo/content/pref/pref.xul
	// scope(document.getElementsByTagName("iframe")[0].contentWindow)
	// scope(Shell.enumWins[N].frames[M])
	//for(i in sv.pref.defaults) sv.pref.prefset.deletePref(i)

	//FIXME: sometimes RInterface.runRAs is blank
	PrefR_PopulateRInterpreters();

    // if (prefset.getStringPref("RInterface.pathToR") != "") {
		// // update cran mirror list (first local, then tries remote at CRAN)
		// PrefR_UpdateCranMirrorsAsync();
	// } else {
		// var el = document.getElementById("CRANMirror");
		// el.disabled = true;
		// el.tooltipText = "Select R interpreter first";
	// }
	menuListSetValues(); // Restores saved menu values

    // PrefR_OnLoad@chrome://komodor/content/js/pref-R.js:167:2
	// TODO: this raises an exception if pref('RInterface.pathToR')
	// 		 is not among the options, do some checking here
	//parent.hPrefWindow.onpageload();
	// XXX: workaround for empty preference values...
	var prefElements = document.getElementsByAttribute("pref", "true");
	for (let i = 0; i < prefElements.length; ++i)
		prefElements[i].value = sv.pref.getPref(prefElements[i].id);

    PrefR_updateCommandLine(true);
	PrefR_UpdateCranMirrorsAsync(false);

	sv.pref.prefset = svPrefset;
} //PrefR_OnLoad

//TODO: check if there is new R version installed and ask whether to switch to it.
function PrefR_PopulateRInterpreters() {
    var prefset = parent.hPrefWindow.prefset;

    var prefExecutable = prefset.getStringPref('RInterface.pathToR');

    var rs;
    var os = Components.classes['@activestate.com/koOs;1']
		.getService(Components.interfaces.koIOs);
    var menu = document.getElementById("RInterface.pathToR");

    ////////////////////////////////////
    switch (os.name) { //'posix', 'nt', 'mac', 'os2', 'ce', 'java', 'riscos'.
        case "nt":
			// TODO: sort by version:
			rs = sv.file.whereIs("Rgui").concat(sv.file.whereIs("R"));
			break;
        case "mac":
			rs = ["/Applications/R.app"];
			break;
        case "posix":
			/* falls through */
        default:
			rs = sv.file.whereIs("R");
    }

	//if(prefExecutable != "") rs.unshift(prefExecutable);

    for (let i = 0; i < rs.length; ++i) {
        rs[i] = os.path.normpath(rs[i]);
        if (sv.file.exists(rs[i]) == sv.file.TYPE_NONE)
            rs.splice(i, 1);
        }
    rs = sv.array.unique(rs); // Get rid of duplicates
	if((prefExecutable == "") || (rs.indexOf(prefExecutable) == -1)) {
		prefset.setStringPref("RInterface.pathToR", "R");
		prefExecutable = "R";
	}
	var rFound = rs.length != 0 && rs.every(Boolean);
	
	rs.unshift("R;Find on path");

	var curValue = menu.value || "R";
    menu.removeAllItems();
	for (let i = 0; i < rs.length; ++i) {
		var r = rs[i].split(";");
        menu.appendItem(r[0], r[0], r.length < 2 ? null : r[1]);
		if (curValue == r[0]) menu.selectedIndex = i;
    }

    document.getElementById("no-avail-interps-message").hidden = rFound;
	
}

//function OnPreferencePageLoading(prefset) {}
//function OnPreferencePageInitalize(prefset) {}
//function OnPreferencePageClosing(prefset, ok) {}

//language icon color 8595c0
// ko.prefs.getPref('fileicons_presets').appendString("R:R:#8595c0");

function OnPreferencePageOK(prefset) {
	var outDec = document.getElementById('RInterface.CSVDecimalSep').value;
	var outSep = document.getElementById('RInterface.CSVSep').value;

    // "Preference widget" does not save newly added values for some reason:
	prefset.setStringPref("RInterface.CSVSep", outSep);

    if (outDec == outSep) {
        parent.switchToPanel("svPrefRItem");
        getDialogs().alert(
			"Decimal separator cannot be the same as field separator.", null,
			"R interface preferences");
        return(false);
    }
	prefset.setStringPref("svRCommand", PrefR_updateCommandLine(false));
	
	var cmIdx = document.getElementById("CRANMirror").selectedIndex;
	var mirrorType = PrefR_CMSecure ? "https" : "http";
	prefset.setStringPref("CRANMirror", PrefR_CranMirrors[mirrorType][cmIdx][3]);


	if (outDec != prefset.getStringPref('RInterface.CSVDecimalSep') ||
		outSep != prefset.getStringPref('RInterface.CSVSep')) {
		sv.r.eval('options(OutDec="' + outDec + '", ' +
		'OutSep="' + outSep + '")', true);
	}

	var newClientPort = parseInt(document.getElementById('RInterface.koPort').value);
	var currentClientPort = sv.rconn.getSocketPref("RInterface.koPort");

	if (sv.rconn.serverIsUp &&
		newClientPort != currentClientPort) {
		var connected = sv.rconn.isRConnectionUp(true);

		if(getDialogs().yesNo("Server port changed (from " + currentClientPort +
							" to " + newClientPort + "), would you like to " +
							"restart it now?" +
			(connected? "You will lose the current connection to R." : ""),
			connected? "No" : "Yes",
			null, "R interface preferences") == "Yes") {
				sv.rconn.restartSocketServer();
		}
	}
	menuListGetValues();
	return true;
}

function svRDefaultInterpreterOnSelect(event) {
	var os = Components.classes['@activestate.com/koOs;1']
		.getService(Components.interfaces.koIOs);

	var menuApplication = document.getElementById("RInterface.runRAs");
    var menuInterpreters = document.getElementById("RInterface.pathToR");

	var value = menuInterpreters.value;

	// Just in case
	if((value != "R") && (sv.file.exists(value) == sv.file.TYPE_NONE)) {
		getDialogs().alert("Cannot find file: " + value, null,
			"R interface preferences");
	}

	// FIXME: On Win, if 'R' is selected, this chooses RGui:
    var exeName = os.path.basename(value);
    if (!(menuApplication.value in apps) || apps[menuApplication.value].app != exeName) {
        let i;
		for (i in apps) if (apps.hasOwnProperty(i) && apps[i].app == exeName) break;
        menuApplication.value = i;
    }

    PrefR_updateCommandLine(true);

	var el = document.getElementById("CRANMirror");
	el.tooltipText = "";
	el.disabled = false;
	PrefR_UpdateCranMirrorsAsync();
}

function PrefR_svRApplicationOnSelect(event) {
	var menuApplication = document.getElementById("RInterface.runRAs");
    var menuInterpreters = document.getElementById("RInterface.pathToR");
	if (!(menuApplication.value in apps)) return;

    var app = apps[menuApplication.value].app;
	//var sel = menuApplication.selectedItem;

	var os = Components.classes['@activestate.com/koOs;1']
		.getService(Components.interfaces.koIOs);

    if (os.path.basename(menuInterpreters.value) != app) {
        //TODO: modify to use with:
        //menulistSetValue(menuInterpreters, value, "value", null);
        var item;
        for (let i = 0; i <= menuInterpreters.itemCount; ++i) {
            item = menuInterpreters.getItemAtIndex(i);
            if (item) {
                if (os.path.basename(item.getAttribute("value")) == app) {
                    menuInterpreters.selectedIndex = i;
                    break;
                }
            }
        }
    }
    PrefR_updateCommandLine(true);
}

function PrefR_updateCommandLine(update) {
    var appId = document.getElementById("RInterface.runRAs").value;
	var appPath = document.getElementById("RInterface.pathToR").value;

     if(!appId || !appPath) return '';

    var cmdArgs = document.getElementById("RInterface.cmdArgs").value;
	var args1 = "";

   	var cwd = sv.file.path("ProfD", "extensions", "komodor@komodor", "R");

	cmdArgs = cmdArgs.replace(/\s*--[sm]di\b/, "");

	var argsPos = cmdArgs.indexOf("--args");
	if (argsPos != -1) {
		args1 += " " + sv.string.trim(cmdArgs.substring(argsPos + 6));
		cmdArgs = cmdArgs.substring(0, argsPos);
	}
	if(cmdArgs) cmdArgs = " " + cmdArgs.trim();

	args1 = sv.string.trim(args1);
	if (args1) args1 = " --args " + args1;

    var cmd = apps[appId].path;
	cmd = cmd.replace("%Path%", appPath)
		.replace("%title%", "R [Komodo]").replace("%cwd%", cwd)
		.replace("%args%", cmdArgs) + args1;

    if (update) {
        var cmdLabel = document.getElementById('R_command');
        cmdLabel.value = cmd;
    }
    return cmd;
}

function PrefR_setExecutable(path) {
    var menu = document.getElementById("RInterface.pathToR");
	var os;
    if (!path || !sv.file.exists(path)) {
		os = Components.classes['@activestate.com/koOs;1']
			.getService(Components.interfaces.koIOs);
		path = menu.value;
        path = ko.filepicker.browseForExeFile(os.path.dirname(path), os.path.basename(path),
			"Select R executable");
	}
    if (!path) return;
    path = os.path.normpath(path);

    editMenulist(menu, path);
    menu.value = path;
}

function setCranMirrorsSecure(secure) {
	PrefR_CMSecure = Boolean(secure);
	prefset.setBooleanPref('CRANMirrorSecure', PrefR_CMSecure);
	xtk.domutils.fireEvent(self, "r_cran_mirrors_updated");
}

function processCranMirrorsCSV(content) {
	if (!content) return;
	// Convert CSV string to Array:
	var arrData = CSVToArray(content);
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

function PrefR_UpdateCranMirrorsAsync(fromCran) {
	var button = document.getElementById("RefreshCRANMirrors");
	button.setAttribute("label", "Updating mirrors...");
	button.disabled = true;
	PrefR_DoUpdateCranMirrors(fromCran);
}

function OnCranMirrorChange() {
	xtk.domutils.fireEvent(self, "r_cran_mirrors_updated");
}

function OnCranMirrorsListUpdated() {
	PrefR_PopulateCranMirrors(PrefR_CMSecure);
	
	var menuList = document.getElementById("CRANMirror");
	var idx = menuList.selectedIndex;
	var item = PrefR_CranMirrors[PrefR_CMSecure ? "https" : "http"][idx];
	if (item) document.getElementById("CRANMirrorDescr").value = "Mirror host: " + item[4];

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
addEventListener("r_cran_mirrors_updated", OnCranMirrorsListUpdated, false);


// Get CRAN mirrors list - independently of R
// FIXME: if no connection it gets stuck
// FIXME: doesn't update immediately if R interpreter changed and list is empty
function PrefR_DoUpdateCranMirrors(fromCran) {
	var svFile = sv.file;

	// Get data in as CSV:
	var csvName = "CRAN_mirrors.csv";
	var path;
	var encoding = "utf-8";
	var jsonFile = svFile.path(svFile.path("PrefD", "extensions", 
		"komodor@komodor"), "CRAN_mirrors.json");
	
	var cranBaseUri = "http://cran.r-project.org/"; // https?

	if (fromCran) {
		document.getElementById("CRANMirrorDescr").value =
			"Fetching file: " + cranBaseUri + csvName + " ...";
		
		svFile.readURIAsync(cranBaseUri + csvName, encoding,
			function callback(content) {
				processCranMirrorsCSV(content, jsonFile);
				svFile.write(jsonFile, JSON.stringify(PrefR_CranMirrors), encoding);
				// DEBUG
				//var csvFile = svFile.path(svFile.path("PrefD", "extensions",
					//"komodor@komodor"), "CRAN_mirrors_" + (new Date()).toLocaleFormat("%Y%m%d%H%M") + ".csv");
				//svFile.write(csvFile, content, encoding);
				// END DEBUG
				xtk.domutils.fireEvent(self, "r_cran_mirrors_updated");
			}, function onError(err) {
				PrefR_DoUpdateCranMirrors(false);
			});
		return;
	}
	
	// First, check if there is serialized version:
	if (svFile.exists(jsonFile)) {
		PrefR_CranMirrors = JSON.parse(svFile.read(jsonFile, encoding));
		xtk.domutils.fireEvent(self, "r_cran_mirrors_updated");
	} else {
		var localPaths = [];
		var platform = navigator.platform.toLowerCase().substr(0,3);
		if (platform == "win") {
			var rHome = getSelectedInterpreterPath();
			if(!rHome) {
				getDialogs().alert("Cannot fill CRAN mirrors list without a valid R interpreter selected",
					null, "R interface preferences");
				return;
			}
			var rx = /(bin\\((x64|i386)\\)?)?R(gui|term)\.exe$/i;
			if(!rHome) {
				var rHomeArr = sv.array.unique(sv.file.whereIs("R")
					.map(function(x)
						 x.replace(rx, "")));
				localPaths = rHomeArr.map(function(x) sv.file.path(x, "doc"));
			} else {
				localPaths = [ sv.file.path(rHome.replace(rx, ""), "doc") ];
			}
		} else { // if (platform == "lin")
			localPaths.push('/usr/share/R/doc'); 	// try other paths: // mac: ????
			localPaths.push('/usr/local/share/R/doc');
		}
		var file;
		for (let i = 0; i < localPaths.length; ++i) {
			file = svFile.getLocalFile(localPaths[i], csvName);
			if (file.exists()) {
				processCranMirrorsCSV(svFile.read(file.path, encoding));
				svFile.write(jsonFile, JSON.stringify(PrefR_CranMirrors), encoding);
				xtk.domutils.fireEvent(self, "r_cran_mirrors_updated");
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
			
		xtk.domutils.fireEvent(self, "r_cran_mirrors_updated");
	}
}

function PrefR_PopulateCranMirrors(secure) {

	var menuList = document.getElementById("CRANMirror");
	var value;
	if (menuList.value) {
        value = JSON.parse(menuList.value);
		value.unshift(menuList.label);
    } else {
		let url = prefset.getString("CRANMirror");
		let mirrorType = (url.indexOf("https") === 0) ? "https" : "http";
		//var data1 = PrefR_CranMirrors[mirrorType];
		let valIdx1 = PrefR_CranMirrors[mirrorType].findIndex(function(elem) elem[3] == url);
		if (valIdx1 == -1) valIdx1 = 0;
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
	valIdx = data.findIndex(function(elem) elem[0] == value[0]);
	if (valIdx == -1)
        valIdx = data.findIndex(function(elem) elem[1] == value[1] && elem[2] == value[2]);
    if (valIdx == -1)
        valIdx = data.findIndex(function(elem) elem[1] == value[1]);
    if (valIdx == -1) valIdx = 0;
	menuList.selectedIndex = valIdx;
}


// From: http://www.bennadel.com/index.cfm?dax=blog:1504.view
function CSVToArray(strData, strDelimiter){
	strDelimiter = (strDelimiter || ",");
	var objPattern = new RegExp((
    // Delimiters.
    "(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
    // Quoted fields.
    "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
    // Standard fields.
    "([^\"\\" + strDelimiter + "\\r\\n]*))"
    ), "gi");
	var arrData = [[]];
	var arrMatches = objPattern.exec(strData);
	var strMatchedValue;
	while (arrMatches) {
		var strMatchedDelimiter = arrMatches[1];
		if (strMatchedDelimiter.length &&
			(strMatchedDelimiter != strDelimiter)) {
			arrData.push([]);
            }
		if (arrMatches[2]) {
			strMatchedValue = arrMatches[2].replace(new RegExp( "\"\"", "g" ),	"\"");
		} else {
			strMatchedValue = arrMatches[3];
		}
		arrData[arrData.length - 1].push(strMatchedValue);
		arrMatches = objPattern.exec(strData);
	}
	return(arrData);
}
