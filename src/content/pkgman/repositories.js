/* globals Components, window, document */

var _w = Components.classes["@mozilla.org/appshell/window-mediator;1"]
	.getService(Components.interfaces.nsIWindowMediator).getMostRecentWindow("Komodo");

if (typeof require === "undefined") var require = _w.require;
var logger = require("ko/logging").getLogger("komodoR");
if (typeof ko === "undefined") var ko = _w.ko;

function pkgManGetRepositories() {
	try {
		let cmd = "kor::pkgManGetRepositories()";
		logger.debug(cmd);
		let res = JSON.parse(require("kor/connector").eval(cmd));
		let ret = {};
		for(let i in res)
			if(res.hasOwnProperty(i))
				ret[i] = res[i]['Contrib.URL'];
		return ret;		
	} catch(e) {
		return null;
	}
}

function createDOMElement(tagName, obj) {
	let item = document.createElement(tagName), keys = Object.keys(obj);
	for(let i = 0; i < keys.length; ++i) item.setAttribute(keys[i], obj[keys[i]]);
	return item;
}

	
var itemFocus = (item) => {
	if(item._checkbox.style.visibility !== "hidden")
		item._checkbox.focus();
		else item.focus();
};

var changed = () => {
	var list = document.getElementById("rRepositoryList");
	for(let item of list.children)
		if(item.checked !== item.defaultValue) return true;
	return false;
};

function onLoad() {
    var list = document.getElementById("rRepositoryList");

    require("kor/connector").evalAsync("kor::pkgManGetRepositories()",
		(output) => {
        try {
            let res = JSON.parse(output);
            list.parentNode.selectedIndex = 1;
            let keys = Object.keys(res), reposObj, checked, el;
			
            for (let i = 0; i < keys.length; ++i) {
                reposObj = res[keys[i]];
				checked = reposObj.default.indexOf("TRUE") !== -1;
				el = list.appendChild(createDOMElement("richlistitem", {
                    id: keys[i],
                    checked: checked,
                    label: reposObj.menu_name,
                    url: reposObj.URL,
                    contribUrl: reposObj['Contrib.URL'],
					defaultState: checked
                }));
            }
        } catch (e) {
            logger.exception(e, "repositories::onLoad");
        }
    }, true, true);

	list.onclick = (event) => {
		itemFocus(event.target);
	};
	list.onselect = (event) => {
		itemFocus(event.target.selectedItem);
	};
	list.addEventListener("command", () => {
		document.getElementById("ApplyButton").disabled =
		    !changed();
	});
}

function applyRepositories() {
    if (!changed()) return;
    var list = document.getElementById("rRepositoryList");
    var res = {},
        count = 0,
        item, n = list.itemCount;
    for (let i = 0, l = n; i < l; ++i) {
        item = list.getItemAtIndex(i);
        if (item.checked) {
            res[item.id] = item.reposUrl;
            ++count;
        }
    }
    require("kor/cmdout").clear();
    if (count === 0)
        ko.dialogs.alert("At least one repository must be selected.", null,
            "R package manager");
    else
        require("kor/connector")
        .evalAsync('base::options(repos=' + require("kor/r").arg(res) + ')',
            null,
            true);

    var pmWindow = self.opener;
    var pmDeck = pmWindow.pmDeck;
    for (let panel of pmDeck.children) {
        let loadbox = panel.getElementsByTagName("loadbox")[0];
        if (!loadbox) continue;
        loadbox.loaded = false;
    }
    pmWindow.pmLoadPanel();
}

window.addEventListener("load", onLoad, false);
