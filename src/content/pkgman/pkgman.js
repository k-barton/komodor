
/* jslint unused: false */
/*globals document, Components, self */

// TODO: add kor:: to commands

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

var fieldNames = x => {
	var rval = {};
	for(let i = 0; i < x.length; ++i) rval[x[i]] = i;
	return rval;
};

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

function pkgManInstall(pkg) {
	var cmd = `pkgManGetDependencies(${R.arg(pkg)})`;
	logger.debug(cmd);
	//rconn.evalPredefined(cmd, "pkgman-install", true, pkg);
	rconn.evalAsync(cmd, _installHandler, true, true, pkg);
}

// pkgManInstall(pkg) -> _installHandler('{packages, not_avail }') ->

// TODO: allow for 'pkg' as a file path
function _installHandler(output, pkg) {
	closeBusyNotification();
	var response = JSON.parse(output); // response == {packages, not_avail }

	if (response == null) {
		_notify('wtf' + output, "install-wtf", "info");
		return;
	} else if (response.packages.length !== 0) {
		let hasDependencies = response.packages.length + response.not_avail.length;
		if(response.not_avail.length !== 0) {
			if(!require("ko/dialogs").confirm(
				((response.not_avail.length === 1) ?
					`Package's dependency "${response.not_avail[0]}" is not available.` :
					`Package's dependencies: ${response.not_avail.map(s => "\"" + s + "\"").join(", ")} are not available`) +
				" Proceed with installation anyway?", {yes: "Yes", no: "Cancel",
				title: "R package installation"}))
				return;
		}
        let cmd = `utils::install.packages(${R.arg(response.packages)})`; // XXX extra args ...
		let busyMessage = 'R is now busy installing the requested packages. ' +
			'No output will be shown in Komodo before the operation finishes.';
		let postInstall = (output, packages, pkg) => {
			_notify(`Installation of R package "${pkg} "${packages.length > 1 ? " and its dependencies" : ""} finished. See Command Output for details.`, "installed", "info");
			// post-install update:
			updatePackageItems(packages);
		};
		
		if(hasDependencies) {
			var buttons = [{
				label: 'Ok',
				accessKey: 'O',
				callback: n => {
					_notify(busyMessage, 'r-is-busy', 'info');
					rconn.evalAsync(cmd, postInstall, false, false, response.packages, pkg);
					//rconn.evalPredefined(cmd, "pkgman-update-info", true, "installed");
					n.close();
				}
			}, {
				label: 'Cancel', accessKey: 'C',
				callback: n => n.close()
			} ];
			
		_notify(
		'This will install R package "' + pkg + '"' + ((response.packages.length == 1) ? "" : (
			" and its " + ((response.packages.length == 2) ? "dependency " : "dependencies: ") +
			response.packages.slice(0, response.packages.lastIndexOf(pkg)).map(a => "\"" + a + "\"").join(", "))),
			"install-query", "question", buttons); 
		} else {
			_notify(busyMessage, 'r-is-busy', 'info');
			rconn.evalAsync(cmd, postInstall, false, false, response.packages, pkg);
		}
	} else  // no dependencies -> proceed with installation
		_notify("No such package is available...", "install-failed", 'info');
}

function pkgManRemove(pkg) {
	var cmd = 'pkgManRemovePackage(' + R.arg(pkg) + ')';
	logger.debug(cmd);
	rconn.evalPredefined(cmd, "pkgman-update-info", true, "removed");
}

function pkgManDetach(pkg) {
	var cmd = 'kor::pkgManDetachPackage(' + R.arg(pkg) + ')';
	//rconn.evalAsync(cmd, updateInfo, true, true, "detached");
	logger.debug(cmd);
	rconn.evalPredefined(cmd, "pkgman-update-info", true, "detached");

}

function pkgManUpgrade(pkg) {
	var cmd = 'kor::pkgManInstallPackages(' + R.arg(pkg) + ', ask=FALSE)';
	logger.debug(cmd);
	rconn.evalPredefined(cmd, "pkgman-update-info", true, "installed");
	_notify('R is now busy installing the requested packages. ' +
		'No output will be shown in Komodo before the operation finishes.',
		'r-is-busy', 'info');
}

var cachedPackageDescriptions = new Map();

function getDescriptionFor(el) {
	var key = el.label + " " + el.getAttribute("version");
	if(cachedPackageDescriptions.has(key)) {
		el.desc = cachedPackageDescriptions.get(key);
		return;
	}
	var cmd = 'kor::pkgManGetDescription(' + R.arg(el.label) + ')';
	logger.debug(cmd);
	rconn.evalAsync(cmd, (desc, el, key) => {
		desc = JSON.parse(desc);
		cachedPackageDescriptions.set(key, desc);
		el.desc = desc;
		}, true, true, el, key);
}

function setCranMirror(url) {
	if(!url) url = Prefs.getPref("CRANMirror").trim();
	try {
		let cmd = "kor::pkgManSetCRANMirror(" + R.arg(url) + ")";
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

	var res = JSON.parse(rOutput);

	while(rl.itemCount) rl.removeItemAt(0);
	var item, sel = -1, row, cell;
	var URL = 0, CountryCode = 1;
	
	for(let key of Object.keys(res.values)){
		item = res.values[key];
		row = document.createElement('listitem');
		row.setAttribute('value', item[URL]);
		cell = document.createElement('listcell');
		cell.setAttribute('label', key);
		cell.setAttribute('image', "chrome://komodor/skin/images/flags/" +
						  item[CountryCode] + ".gif");
		cell.className = "listcell-iconic";
		row.appendChild(cell);
		cell = document.createElement('listcell');
		cell.setAttribute('label', item[URL]);
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

// TODO: attribute 'working' ==> display animated cog icon

function createPackageItem(name, version, installedVersion, repositoryName, 
	loaded) {
	var item = document.createElement("richlistitem");
	item.setAttribute("label", name);
	item.setAttribute("version", version);
	item.setAttribute("repos", repositoryName);
	if(installedVersion) item.setAttribute("installedVersion", installedVersion);
	//if(status) item.setAttribute("status", status);
	if(loaded) item.setAttribute("loaded", loaded);
	return item;
}

function updatePackageItem(listbox, label, version, installedVersion, repositoryName, loaded) {
	var items = listbox.getElementsByAttribute("label", label);
	if(items.length == 0) return false;
	var item, installed;
	for(let j = 0; j < items.length; ++j) {
		items[j].setVersion(version, installedVersion);
		items[j].loaded = loaded;
	}
	return true;
}

function populateUpdateablePkgs(rOutput) {
	if (!rOutput || rOutput == 'NULL') return;
	document.getElementById("rUpdateableLoadBox").loaded = true;
	var rl = document.getElementById("rUpdateableList");

	while(rl.itemCount) rl.removeItemAt(0);

	var res = JSON.parse(rOutput);
	// ["Installed","ReposVer","RepositoryName","Loaded"]
	var $ = fieldNames(res.fieldNames);
	var item;
	for(let key of Object.keys(res.values)) {
		item = res.values[key];
		rl.appendChild(createPackageItem(key, item[$.ReposVer],
			item[$.Installed], item[$.RepositoryName], item[$.Loaded]));
	}
}

function getUpdateable() {
	var cmd = "kor::pkgManGetUpdateable()";
	logger.debug(cmd);
	rconn.evalAsync(cmd, populateUpdateablePkgs, true, true);
}

function populateInstalledPkgs(rOutput) {
	if (!rOutput) return;
	document.getElementById("rPackageLoadBox").loaded = true;
	var rl = document.getElementById("rPackageList");
	var res = JSON.parse(rOutput);
	var selectedIndex, selectedItem, selectedLabel;
	selectedIndex = rl.selectedIndex;
	selectedItem = rl.getSelectedItem(0);
	if(selectedItem != null) selectedLabel = selectedItem.label;

	// ["Version","RepositoryName","Priority","InstalledVersion","Loaded"]
	var $ = fieldNames(res.fieldNames);
	var loadedPkgs = [];

	while(rl.itemCount) rl.removeItemAt(0);
	for(let i = 0, l = res.length; i < l; ++i){
		let item = res[key];
		let isLoaded = item[$.Loaded].indexOf('TRUE') == 0;
		if(isLoaded) loadedPkgs.push(item.name);
		rl.appendChild(createPackageItem(key,
			item[$.Version], item[$.InstalledVersion], item[$.RepositoryName],
			isLoaded));
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
		item.loaded = loadedPkgs.indexOf(item.label) != -1;
	}
}

function getInstalledPkgs() {
	var cmd = "kor::pkgManGetInstalled()";
	logger.debug(cmd);
	rconn.evalAsync(cmd, populateInstalledPkgs, true, true);
}

function updatePackageItems(update, remove) {
	var listboxes = {
		available: document.getElementById("rAvailablePackageList"),
		installed: document.getElementById("rPackageList"),
		updateable: document.getElementById("rUpdateableList") };

	var items;
	if(Array.isArray(remove) && remove.length) {
		for(let i = 0; i < remove.length; ++i) { 
			items = listboxes.available.getElementsByAttribute("label", remove[i]);
			if(items.length != 0)
				for(let j = 0; j < items.length; ++j) {
					items[j].removeAttribute("installed");
					items[j].setAttribute("installedVersion", "");
				}
			
		[listboxes.installed, listboxes.updateable].forEach(lbx => {
			items = lbx.getElementsByAttribute("label", remove[i]);
			if(items.length != 0)
				for(let j = 0; j < items.length; ++j)
					lbx.removeItemAt(lbx.getIndexOfItem(items[j]));
			});
		}
	}

	if(!Array.isArray(update) || !update.length)
		return;
	
	// kor::
	var cmd = 'pkgManGetPackages(' + R.arg(update) + ', type = "both")';
	
	// XXX: what if window has closed?
	rconn.evalAsync(cmd, (output, listboxes) => {
		try {
			var res = JSON.parse(output);
		} catch(e) {
			return;
		}
		if(!res.values) return;
		var keys = Object.keys(res.values);
		if(!keys.length) return; 
		var $ = fieldNames(res.fieldNames); // [Version,RepositoryName,Priority,InstalledVersion,Loaded]
		var dat;
		// TODO:
		//listboxes.installed -> add if missing
		//listboxes.updateable -> add if old and missing
		for(let l in listboxes)
			if(listboxes.hasOwnProperty(l)) {
				for(let key of keys) {
					dat = res.values[key];	
					updatePackageItem(listboxes[l], key,
						dat[$.Version], dat[$.InstalledVersion],
						dat[$.RepositoryName], dat[$.Loaded] == "y");
				}
			}
	}, true, true, listboxes);
	// TODO: update package item's 'busy' attribute
}

// called upon invasive package operations
function updateInfo(output, what) {
	closeBusyNotification();
	// TODO: error catching in JSON.parse
	var notification, response = JSON.parse(output);

	switch(what) {
	case "installed":
		// {packages: {fieldNames,values},message}
		// fieldNames = [Version,RepositoryName,Priority,InstalledVersion,Loaded]
		if(response === null) {
			_notify(res, what, "warning");
			return;
		}
		let pkgs = response.packages;
		if (typeof pkgs === "string") pkgs = [pkgs];
		let msg = (Array.isArray(response.message) ?
			response.message.join("\n") : response.message).trim();
		_notify("Installation of " + pkgs.join(', ') + " finished." +
				(msg ? " See console output for details." : ""),
				what, "info");
		if(msg) require("kor/cmdout").print(msg);
		updatePackageItems(pkgs);
		break;

	case "removed":
		if(response === null) {
			_notify(res, what, "error");
			return;
		}
		var removed = Array.isArray(response.removed) ? response.removed : [ response.removed ]; 
		updatePackageItems(null, removed);
		
		break;
	case "loaded":
		notification = '';
		if(response === null) {
			notification = UI.translate("See output in console for additional information.");
			require("kor/cmdout").print(res);
		} else {
			let status = response.status;
			let loaded = [];
			for(let i in status) if(status.hasOwnProperty(i)) {
				if(status[i] == 'TRUE')
					loaded.push(i);
				else
					notification += UI.translate("Package %S was not loaded.", i) + " ";
			}
			updatePackageItems(loaded);
			if(response.message) {
				require("kor/cmdout").print(response.message);
				notification += UI.translate("See output in console for additional information.");
			}
		}
		if(notification)
			_notify(notification, "update-loaded", "info");
		break;
	case "detached":
		
		/// TODO....
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

// !!!!!!
function pkgManLoad(pkg) {
	var cmd = 'cat(kor::stringize(kor::pkgManLoadPackage(' + R.arg(pkg) + ')))';
	logger.debug(cmd);
	rconn.evalAsync(cmd, updateInfo, true, true, "loaded");
}

function populateAvailablePkgs(rOutput) {
	if (!rOutput || rOutput.startsWith("NULL")) {
		_notify("Error getting the list of avaiable packages",
				'available-pkgs-error',
				'error', [{
					label: 'Try again',
					accessKey: 'T',
					callback: nn => {
						getAvailablePkgs("", true);
						nn.close();
					}
				}]);
		return;
	}
	var rl = document.getElementById("rAvailablePackageList");
	document.getElementById("rAvailablePackagesLoadBox").loaded = true;

	var res = JSON.parse(rOutput);

	while(rl.itemCount) rl.removeItemAt(0);
	
	let idx = res.index.map(x => parseInt(x));

	var prevButton = document.getElementById('availablePackagesPrevButton');
	if (idx[0] > 1) {
		let item = document.createElement("richlistitem");
		item.setAttribute("class", "navButton");
		item.setAttribute("oncommand", "getAvailablePkgs('prev')");
		rl.appendChild(item);
		prevButton.disabled = false;
	} else
		prevButton.disabled = true;

	var $ = fieldNames(res.fieldNames); // [Version,RepositoryName,Priority,InstalledVersion,Loaded]
	var valueKeys = Object.keys(res.values);
	for(let key of valueKeys){
		let item = res.values[key];
		rl.appendChild(createPackageItem(key, item[$.Version],
			item[$.InstalledVersion], item[$.RepositoryName], item[$.Loaded]));
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
	info.value = `Showing packages ${idx[0]}-${idx[1]} of ${idx[2]} \
total (from "${valueKeys[0]}" to "${valueKeys[valueKeys.length - 1]}")`;
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
