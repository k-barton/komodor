
/* jslint unused: false */
/*globals document, Components, self */
let wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
   .getService(Components.interfaces.nsIWindowMediator);
let w = wm.getMostRecentWindow("Komodo");
var require = w.require, ko = w.ko;
var logger = require("ko/logging").getLogger("komodoR");
var pmDeck;
var rconn = require("kor/connector");

const UI = require("kor/ui");
const R = require("kor/r");
const Prefs = require("kor/prefs");

function _notify(message, msgid, type, buttons) {
	var image, priority;
	var nb = document.getElementById("rPkgManNotificationBox");
	var iconBaseURI = "chrome://global/skin/icons/";
	switch(type) {
		case 'question':
			image = 'question-24.png';
			priority = nb.PRIORITY_WARNING_MEDIUM;
			break;
		case 'error':
			image = 'error-24.png';
			priority = nb.PRIORITY_CRITICAL_MEDIUM;
			break;
		case 'warning':
			image = 'warning-24.png';
			priority = nb.PRIORITY_WARNING_MEDIUM;
			break;
		default:
			image = 'information-24.png';
			priority = nb.PRIORITY_INFO_MEDIUM;
	}
	//if(!buttons) {
	//	buttons = [{
	//		label: 'Ok',
	//		accessKey: 'O',
	//		popup: null,
	//		callback: function(e) nb.currentNotification.close()
	//	}];
	//}
	nb.appendNotification(message, msgid, iconBaseURI + image, priority, buttons);
}

function closeBusyNotification() {
	var nb = document.getElementById("rPkgManNotificationBox");
	var nfcBusy = nb.getNotificationWithValue("r-is-busy");
	if(nfcBusy) nfcBusy.close();
}

function pkgManInstall(pkg, ask) {
	ask = ', ask='  + (ask? 'TRUE' : 'FALSE') + ', installDeps=' +
		(ask? 'FALSE' :  'TRUE');
	var cmd = "cat(kor::stringize(kor::pkgManInstallPackages" +
		'("' + pkg + '"' + ask + ')))';
	logger.debug(cmd);
	rconn.evalPredefined(cmd, "pkgman-install", true, pkg);
}

function _installHandler(res, pkg) {
	closeBusyNotification();
	var response = JSON.parse(res);
	if (response == null) {
		_notify('wtf' + res, "install-wtf", "info");
		return;
	} else if (response.status == "question") {
		var buttons = [{
			label: 'Ok',
			accessKey: 'O',
			callback: n => {
				let cmd = 'cat(kor::stringize(kor::pkgManInstallPackages("' + pkg +
					'", ask=FALSE, installDeps=TRUE)))';
				logger.debug(cmd);
				rconn.evalPredefined(cmd, "pkgman-update-info", true, "installed");
				_notify('R is now busy installing the requested packages. ' +
						'No output will be shown in Komodo before the operation finishes.',
						'r-is-busy', 'info');
				//rconn.evalAsync(cmd, updateInfo, true, true, "installed");
				n.close();
			}
		}, {
			label: 'Cancel', accessKey: 'C',
			callback: n => n.close()
		} ];
		_notify(response.message, "install-query", "question", buttons);
	} else if (response.status == "done") {
		ko.dialogs.alert("R said:", response.message, document.title);
	}
}

function pkgManRemove(pkg) {
	var cmd = 'cat(kor::stringize(kor::pkgManRemovePackage("' + pkg + '")))';
	//rconn.evalAsync(cmd, updateInfo, true, true, "removed");
	logger.debug(cmd);
	rconn.evalPredefined(cmd, "pkgman-update-info", true, "removed");
}

function pkgManDetach(pkg) {
	var cmd = 'cat(kor::stringize(kor::pkgManDetachPackage("' + pkg + '")))';
	//rconn.evalAsync(cmd, updateInfo, true, true, "detached");
	logger.debug(cmd);
	rconn.evalPredefined(cmd, "pkgman-update-info", true, "detached");

}

function pkgManUpgrade(pkg) {
	var cmd = 'cat(kor::stringize(kor::pkgManInstallPackages("' + pkg + '", ask=FALSE)))';
	logger.debug(cmd);
	rconn.evalPredefined(cmd, "pkgman-update-info", true, "installed");
	_notify('R is now busy installing the requested packages. ' +
		'No output will be shown in Komodo before the operation finishes.',
		'r-is-busy', 'info');
}

function getDescriptionFor(el) {
	var cmd = 'kor::pkgManGetDescription(' + R.arg(el.label) + ')';
	logger.debug(cmd);
	rconn.evalAsync(cmd, (desc, el) => { el.desc = desc; }, true, true, el);
}

function setCranMirror(url) {
	if(!url) url = Prefs.getPref("CRANMirror").trim();
	try {
		let cmd = "kor::pkgManSetCRANMirror(\"" + url + "\")";
		logger.debug(cmd);
		rconn.evalAsync(cmd, null, true);
		Prefs.setPref("CRANMirror", url);
		Prefs.setPref("CRANMirrorSecure", url.substr(0, 6).toLowerCase().startsWith("https:"));
	} catch(e) {
		return;
	}
	var selectedCranMirror = document.getElementById('selectedCranMirror');
	if(selectedCranMirror) selectedCranMirror.value = url;
}

function populateCranMirrorsList(rOutput) {
	//var lines = rOutput.split(/[\r\n]+/);
	var mirror = Prefs.getPref("CRANMirror").trim();
	var rl = document.getElementById("rCRANMirrorsList");

	var res = require("kor/csv").parse(rOutput, ';', 0, false, ['name', 'url', 'countryCode' ]);

	while(rl.itemCount) rl.removeItemAt(0);
	var item, sel = -1;

	for(let i = 0, l = res.length; i < l; ++i){
		item = res[i];
		var row = document.createElement('listitem');
		row.setAttribute('value',  item.url);
		var cell = document.createElement('listcell');
		cell.setAttribute('label',  item.name);
		cell.setAttribute('image', "chrome://komodor/skin/images/flags/" +
						  item.countryCode + ".gif");
		cell.className = "listcell-iconic";
		row.appendChild(cell);
		cell = document.createElement('listcell');
		cell.setAttribute('label', item.url);
		row.appendChild(cell);
		if(item.url.indexOf(mirror) > -1) sel = i;
		rl.appendChild(row);
	}
	document.getElementById("rCRANMirrorsLoadBox").loaded = true;

	var it = rl.getItemAtIndex(sel);
	rl.scrollToIndex(sel);
	rl.ensureIndexIsVisible( sel);
	//rl.timedSelect(it , 10);
	rl.selectItem(it);
}

function getCranMirrors() {
	var cmd = "kor::pkgManGetMirrors()";
	logger.debug(cmd);
	rconn.evalAsync(cmd, populateCranMirrorsList, true, true);
}

function makePkgItem(name, version, repositoryName, installedVersion, status, installed, old,
		loaded) {
	var item = document.createElement("richlistitem");
	item.setAttribute("label", name);
	item.setAttribute("version", version);
	item.setAttribute("repos", repositoryName);
	if(installedVersion) item.setAttribute("installedVersion", installedVersion);
	if(status) item.setAttribute("status", status);
	if(installed) item.setAttribute("installed", installed);
	if(old) {
		item.setAttribute("old", old);
		item.setAttribute("versionTooltip", "Newer version is available.");
	}
	if(loaded) item.setAttribute("loaded", loaded);
	return item;
}

function populateUpdateablePkgs(rOutput) {
	if (!rOutput || rOutput == 'NULL') return;
	document.getElementById("rUpdateableLoadBox").loaded = true;
	var rl = document.getElementById("rUpdateableList");
	var res = require("kor/csv").parse(rOutput, ';;', 0, true,
		['package', 'libPath', 'version', 'rVersion', 'reposVersion', 'repos' ]);

	while(rl.itemCount) rl.removeItemAt(0);
	var item;
	for(let i = 0, l = res.length; i < l; ++i){
		item = res[i];
		rl.appendChild(makePkgItem(item.package, item.reposVersion, item.repos,
			item.version, "old", true, true, false));
	}
}

function getUpdateable() {
	var cmd = "kor::pkgManGetUpdateable()";
	logger.debug(cmd);
	rconn.evalAsync(cmd, populateUpdateablePkgs, true, true);
}


function populateInstalledPkgs(rOutput) {
	if (!rOutput || rOutput == 'NULL') return;

	document.getElementById("rPackageLoadBox").loaded = true;
	var rl = document.getElementById("rPackageList");

	var res = require("kor/csv").parse(rOutput, '\x1e', 0, false, ['name', 'version',
		'description', 'loaded' ]);

	var selectedIndex, selectedItem, selectedLabel;
	selectedIndex = rl.selectedIndex;
	selectedItem = rl.getSelectedItem(0);
	if(selectedItem != null) selectedLabel = selectedItem.label;
	var loadedPkgs = [];

	while(rl.itemCount) rl.removeItemAt(0);
	for(let i = 0, l = res.length; i < l; ++i){
		let item = res[i];
		let isLoaded = item.loaded.indexOf('TRUE') == 0;
		if(isLoaded) loadedPkgs.push(item.name);
		rl.appendChild(makePkgItem(item.name, item.version, "", null, null,
			true, null, isLoaded));
	}

	if(selectedIndex != -1) {
		for (let i = 0, l = rl.itemCount; i < l; ++i)
			if(rl.getItemAtIndex(i).label == selectedLabel) {
				rl.selectedIndex = i;
				break;
			}
	}
	// update also available packages list (set 'loaded')
	var rla = document.getElementById("rAvailablePackageList");
	for (let i = 0, l = rla.itemCount; i < l; ++i) {
		let item = rla.getItemAtIndex(i);
		if(loadedPkgs.indexOf(item.label) != -1)
			item.setAttribute("loaded", true);
		else item.removeAttribute("loaded");
	}
}

function getInstalledPkgs() {
	var cmd = "kor::pkgManGetInstalled(sep='\\x1e')";
	logger.debug(cmd);
	rconn.evalAsync(cmd, populateInstalledPkgs, true, true);
}


function updateInfo(res, what) {
// add to installed / reload installed
// update items in Available
// remove from Updates
	closeBusyNotification();

	let avpList = document.getElementById("rAvailablePackageList");
	//let instList = document.getElementById("rPackageList");
	
	let notification, response;

	switch(what) {
	case "installed":
		response = JSON.parse(res);
		if(response === null) {
			_notify(res, what, "warning");
			return;
		}

		let pkgs = response.packages;
		if (typeof pkgs === "string") pkgs = [pkgs];

		let msg = response.message.join("\n").trim();

		_notify("Installation of " + pkgs.join(', ') + " finished." +
				(msg? " See output in console for details." : ""),
				what, "info");
		if(msg) require("kor/cmdout").print(msg);

		let packageName, items;

		for(let packageName of pkgs) {
			items = avpList.getElementsByAttribute("label", packageName);
			if(items.length == 0) continue;
			for(let j = 0; j < items.length; ++j) {
				items[j].setAttribute("installedVersion", items[j].getAttribute("version"));
				items[j].setAttribute("installed", true);
			}
		}
		getInstalledPkgs();
		break;
	case "removed":
		response = JSON.parse(res);
		if(response === null) {
			//ko.dialogs.alert("Something went wrong...", res, document.title + " updateInfo");
			_notify(res, what, "error");
			return;
		}
		let changedCount = 0;
		for(let packageName in response) 
		    if(response.hasOwnProperty(packageName)) {
				if(response[packageName] == "TRUE") {
					++changedCount;
					let items = avpList.getElementsByAttribute("label", packageName);
					if(items.length == 0) continue;
					for(let j = 0; j < items.length; ++j) {
						items[j].removeAttribute("installed");
						items[j].setAttribute("installedVersion", "");
					}
				}
			}
		if(changedCount > 0) getInstalledPkgs();
		break;
	case "loaded":
		getInstalledPkgs();
		response = JSON.parse(res);
		notification = '';
		if(response === null) {
			notification = UI.translate("See output in console for additional information.");
			require("kor/cmdout").print(res);
		} else {
			let status = response.status;
			for(let i in status)
			    if(status.hasOwnProperty(i) && status[i] != 'TRUE')
					notification += 
				        UI.translate("Package %S was not loaded.", i) + " ";
			if(response.message) {
				require("kor/cmdout").print(response.message);
				notification += UI.translate("See output in console for additional information.");
			}
		}
		if(notification)
			_notify(notification, "update-loaded", "info");
		break;
	case "detached":
		response = JSON.parse(res);
		notification = '';
		if(response === null) {
			notification = UI.translate("See output in console for additional information.");
			require("kor/cmdout").print(res);
		} else {
			let status = response.status;
			let items, changedCount = 0, errors = [];
			for(let packageName in status)
				if(status.hasOwnProperty(packageName)) {
					if(status[packageName] == "TRUE") {
						changedCount++;
						items = avpList.getElementsByAttribute("label", packageName);
						if(items.length == 0) continue;
						for(let j = 0; j < items.length; ++j)
							items[j].removeAttribute("loaded");
					} else errors.push(packageName);
				}
			if(changedCount > 0) getInstalledPkgs();
			if (errors.length > 0)
				notification += UI.translate("These packages were not detached: %S.", errors.join(", ")) + " ";
			if(response.message) {
				require("kor/cmdout").print(response.message);
				notification += UI.translate("See output in console for additional information.") + " ";
			}
			if(notification)
				_notify(notification, "detach", errors.length? "warning" : "info");
		}
        break;
	default:
		break;

	}
	require("kor/main").fireEvent("r-environment-change");
}

function pkgManLoad(pkg) {
	var cmd = 'cat(kor::stringize(kor::pkgManLoadPackage(' + R.arg(pkg) + ')))';
	logger.debug(cmd);
	rconn.evalAsync(cmd, updateInfo, true, true, "loaded");
}

function populateAvailablePkgs(rOutput) {
	if (rOutput.substr(0, 4) == "NULL") {
		_notify("Error getting the list of avaiable packages",
				'available-pkgs-error',
				'error', [{
					label: 'Try again',
					accessKey: 'T',
					callback: function(nn) {
						getAvailablePkgs("", true);
						nn.close();
					}
				}]);
		return;
	}
	var rl = document.getElementById("rAvailablePackageList");
	document.getElementById("rAvailablePackagesLoadBox").loaded = true;

	var res = require("kor/csv").parse(rOutput, '\x1e', 1, false, ['name', 'version',
		'installedVersion', 'status', 'reposName' ]);
	while(rl.itemCount) rl.removeItemAt(0);
	let idx = String(res[0]).trim().split(" ").map(x => parseInt(x));
	res = res[1];

	var prevButton = document.getElementById('availablePackagesPrevButton');
	if (idx[0] > 1) {
		let item = document.createElement("richlistitem");
		item.setAttribute("class", "navButton");
		item.setAttribute("oncommand", "getAvailablePkgs('prev')");
		rl.appendChild(item);
		prevButton.disabled = false;
	} else {
		prevButton.disabled = true;
	}

	for(let i = 0, l = res.length; i < l; ++i){
		let item = res[i];
		rl.appendChild(makePkgItem(item.name, item.version, item.reposName,
			item.installedVersion, item.status, item.status != '',
			item.status == '1'));
	}

	var nextButton = document.getElementById('availablePackagesNextButton');
	if (idx[1] < idx[2]) {
		let item = document.createElement("richlistitem");
		item.setAttribute("class",  "navButton");
		item.setAttribute("oncommand", "getAvailablePkgs('next')");
		rl.appendChild(item);
		nextButton.disabled = false;
	} else {
		nextButton.disabled = true;
	}
	var info = document.getElementById('availablePackagesInfo');
	info.value = ' Showing packages '  + idx[0] + "-" + idx[1]  + ' of ' + idx[2] +
		' total (from "' + res[0].name + '" to "' +
		res[res.length - 1].name + '")';
}

function getAvailablePkgs(page, reload) {
	//document.getElementById("rAvailablePackagesLoadBox").loaded = false;
	var rl = document.getElementById("rAvailablePackageList");

	if (!page) page = '';
	else if (page === "next")
		rl.scrollToIndex(0);
	else if (page === "prev")
		rl.scrollToIndex(rl.getRowCount() - 1);

	var searchPattern = document.getElementById('searchfield').value.trim();
	searchPattern = require("kor/utils").str.toRegex(searchPattern);
	var cmd = 'kor::pkgManGetAvailable("' + page + '", sep="\\x1e", pattern=' +
		R.arg(searchPattern) + ', reload=' + R.arg(Boolean(reload)) + ')';
	logger.debug(cmd);
	rconn.evalAsync(cmd, populateAvailablePkgs, true, true);
}

function pmLoadPanel(/*event*/) { 
	//var pmDeck = document.getElementById("pkgPanels");
	var loadBox = pmDeck.selectedPanel.getElementsByTagName("loadbox")[0];
	if(loadBox && !loadBox.loaded) {
		switch(loadBox.id) {
			case 'rAvailablePackagesLoadBox':
				getAvailablePkgs("first", true);
				break;
			case 'rPackageLoadBox':
				getInstalledPkgs();
				break;
			case 'rUpdateableLoadBox':
				getUpdateable();
				break;
			case 'rCRANMirrorsLoadBox':
				getCranMirrors();
				break;
			default:
		}
	}
}

function openRepositoriesWindow() {
	window.openDialog('chrome://komodor/content/pkgman/repositories.xul',
		"pkgManRepositories", 'all=no,modal,resizable,width=400,height=400');
}

function init() {
	rconn.defineResultHandler("pkgman-install", _installHandler, false, false);
	rconn.defineResultHandler("pkgman-update-info", updateInfo, false, false);

	setCranMirror();
	//getCranMirrors();
	//getAvailablePkgs("first", true);
	//getInstalledPkgs();
	pmDeck.addEventListener("select", pmLoadPanel, true);
	pmLoadPanel();
}

function pkgMgrOnLoad(/*event*/) { 
	pmDeck = document.getElementById("pkgPanels");
	document.getElementById("viewGroup").selectedIndex =
		pmDeck.selectedIndex;

	//if(kor.command.isRRunning) window.setTimeout(init, 1);
	if(require("kor/command").isRRunning) init();
	else {
		ko.dialogs.alert("R must be started to manage its packages.",
						 null, "R package manager");
		self.close();
	}
}

addEventListener("load", pkgMgrOnLoad, false);
