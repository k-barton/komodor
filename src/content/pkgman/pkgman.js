
var sv, ko;
var pmDeck;

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
	var cmd = 'cat(simpsON(' + sv.r.rFn('sv_pkgManInstallPackages') +
		'("' + pkg + '"' + ask + ')))';
	sv.rconn.evalPredefined(cmd, "pkgman-install", true, pkg);
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
				var cmd = 'cat(simpsON(sv_pkgManInstallPackages("' + pkg +
					'", ask=FALSE, installDeps=TRUE)))';
				sv.rconn.evalPredefined(cmd, "pkgman-update-info", true, "installed");
				_notify('R is now busy installing the requested packages. ' +
						'No output will be shown in Komodo before the operation finishes.',
						'r-is-busy', 'info');
				//sv.r.evalAsync(cmd, updateInfo, "installed");
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
	var cmd = 'cat(simpsON(sv_pkgManRemovePackage("' + pkg + '")))';
	//sv.r.evalAsync(cmd, updateInfo, "removed");
	sv.rconn.evalPredefined(cmd, "pkgman-update-info", true, "removed");
}

function pkgManDetach(pkg) {
	var cmd = 'cat(simpsON(sv_pkgManDetachPackage("' + pkg + '")))';
	//sv.r.evalAsync(cmd, updateInfo, "detached");
	sv.rconn.evalPredefined(cmd, "pkgman-update-info", true, "detached");

}

function pkgManUpgrade(pkg) {
	var cmd = 'cat(simpsON(sv_pkgManInstallPackages("' + pkg + '", ask=FALSE)))';
	sv.rconn.evalPredefined(cmd, "pkgman-update-info", true, "installed");
	_notify('R is now busy installing the requested packages. ' +
		'No output will be shown in Komodo before the operation finishes.',
		'r-is-busy', 'info');
}

function pkgManLoad(pkg) {
	var cmd = 'cat(simpsON(sv_pkgManLoadPackage("' + pkg + '")))';
	sv.r.evalAsync(cmd, updateInfo, "loaded");
}

function getUpdateable() {
	sv.rconn.evalAsync("sv_pkgManGetUpdateable()", populateUpdateablePkgs, true, true);
}

function populateUpdateablePkgs(rOutput) {
	if (!rOutput || rOutput == 'NULL') return;
	document.getElementById("rUpdateableLoadBox").loaded = true;
	rl = document.getElementById("rUpdateableList");
	var res = sv.io.csvToObj(rOutput, ';;', 0, true,
		['package', 'libPath', 'version', 'rVersion', 'reposVersion', 'repos' ]);

	while(rl.itemCount) rl.removeItemAt(0);
	var item;
	for(let i = 0, l = res.length; i < l; ++i){
		item = res[i];
		rl.appendChild(makePkgItem(item.package, item.reposVersion, item.repos,
			item.version, "old", true, true, false));
	}
}

function updateInfo(res, what) {
// add to installed / reload installed
// update items in Available
// remove from Updates
	closeBusyNotification();

	var avpList = document.getElementById("rAvailablePackageList");
	var instList = document.getElementById("rPackageList");

	switch(what) {
	case "installed":
		response = JSON.parse(res);
		if(response == null) {
			_notify(res, what, "warning");
			return;
		}

		var pkgs = response.packages;
		if (typeof pkgs == "string") pkgs = [pkgs];

		var msg = response.message.join("\n").trim();

		_notify("Installation of " + pkgs.join(', ') + " finished." +
				(msg? " See output in console for details." : ""),
				what, "info");
		if(msg) sv.cmdout.print(msg);

		var packageName, items;

		for(var i in pkgs) {
			packageName = pkgs[i];

			items = avpList.getElementsByAttribute("label", packageName);
			if(items.length == 0) continue;
			for(var j = 0; j < items.length; j++) {
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
		var changedCount = 0;
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
		var notification = '';
		if(response === null) {
			notification = sv.translate("See output in console for additional information.");
			sv.cmdout.print(res);
		} else {
			let status = response.status;
			for(let i in status)
			    if(status.hasOwnProperty(i) && status[i] != 'TRUE')
					notification += 
				        sv.translate("Package %S was not loaded.", i) + " ";
			if(response.message) {
				sv.cmdout.print(response.message);
				notification += sv.translate("See output in console for additional information.");
			}
		}
		if(notification)
			_notify(notification, "update-loaded", "info");
		break;
	case "detached":
		response = JSON.parse(res);
		var notification = '';
		if(response === null) {
			notification = sv.translate("See output in console for additional information.");
			sv.cmdout.print(res);
		} else {
			var status = response.status;
			var items, changedCount = 0, errors = [];
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
				notification += sv.translate("These packages were not detached: %S.", errors.join(", ")) + " ";
			if(response.message) {
				sv.cmdout.print(response.message);
				notification += sv.translate("See output in console for additional information.") + " ";
			}
			if(notification)
				_notify(notification, "detach", errors.length? "warning" : "info");
		}
        break;
	default:

	}
}

function getDescriptionFor(el) {
	var pkg = el.label;
	sv.r.evalAsync('sv_pkgManGetDescription("' + pkg + '")', function(desc, el) {
		el.desc = desc;
	}, el);
}

function setCranMirror(url) {
	if(!url) url = sv.pref.getPref("CRANMirror").trim();
	try {
		sv.rconn.evalAsync("sv_pkgManSetCRANMirror(\"" + url + "\")", null, true);
		sv.pref.setPref("CRANMirror", url);
		sv.pref.setPref("CRANMirrorSecure", url);
	} catch(e) {
		return;
	}
	var selectedCranMirror = document.getElementById('selectedCranMirror');
	if(selectedCranMirror) selectedCranMirror.value = url;
}

function populateCranMirrorsList(rOutput) {
	//var lines = rOutput.split(/[\r\n]+/);
	var mirror = sv.pref.getPref("CRANMirror").trim();
	var rl = document.getElementById("rCRANMirrorsList");

	var res = sv.io.csvToObj(rOutput, ';', 0, false, ['name', 'url', 'countryCode' ]);

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
	sv.rconn.evalAsync("sv_pkgManGetMirrors()", populateCranMirrorsList, true, true);
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
	if(old) item.setAttribute("old", old);
	if(loaded) item.setAttribute("loaded", loaded);
	return item;
}

function getInstalledPkgs() {
	sv.rconn.evalAsync("sv_pkgManGetInstalled(sep='\\x1e')",
			populateInstalledPkgs, true, true);
}

function populateInstalledPkgs(rOutput) {
	if (!rOutput || rOutput == 'NULL') return;

	document.getElementById("rPackageLoadBox").loaded = true;
	var rl = document.getElementById("rPackageList");

	var res = sv.io.csvToObj(rOutput, '\x1e', 0, false, ['name', 'version',
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

function getAvailablePkgs(page, reload) {
	//document.getElementById("rAvailablePackagesLoadBox").loaded = false;
	var rl = document.getElementById("rAvailablePackageList");

	if (!page) page = '';
	else if (page == "next")
		rl.scrollToIndex(0);
	else if (page == "prev")
		rl.scrollToIndex(rl.getRowCount() - 1);

	var searchPattern = document.getElementById('searchfield').value.trim();
	searchPattern = sv.string.toRegex(searchPattern);
	var cmd = 'sv_pkgManGetAvailable("' + page + '", sep="\\x1e", pattern="' +
		searchPattern + '", reload=' + (reload ? 'TRUE': 'FALSE') + ')';
	sv.rconn.evalAsync(cmd, populateAvailablePkgs, true, true);
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

	var res = sv.io.csvToObj(rOutput, '\x1e', 1, false, ['name', 'version',
		'installedVersion', 'status', 'reposName' ]);
	while(rl.itemCount) rl.removeItemAt(0);
	idx = String(res[0]).trim().split(" ").map(x => parseInt(x));
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
	sv.rconn.defineResultHandler("pkgman-install", _installHandler, false);
	sv.rconn.defineResultHandler("pkgman-update-info", updateInfo, false);

	setCranMirror();
	//getCranMirrors();
	//getAvailablePkgs("first", true);
	//getInstalledPkgs();
	pmDeck.addEventListener("select", pmLoadPanel, true);
	pmLoadPanel();
}

function pkgMgrOnLoad(/*event*/) { 
	var p = parent;
	while ((p = p.opener)) {
		if (p.ko) {
			sv = p.sv;
			ko = p.ko;
			break;
	}}
	pmDeck = document.getElementById("pkgPanels");
	document.getElementById("viewGroup").selectedIndex =
		pmDeck.selectedIndex;

	//if(sv.r.isRunning) window.setTimeout(init, 1);
	if(sv.r.isRunning) init();
	else {
		ko.dialogs.alert("R must be started to manage its packages.",
						 null, "R package manager");
		self.close();
	}
}

addEventListener("load", pkgMgrOnLoad, false);
