/* globals Components, window, document, require,
   Services
   */

(function () {
    //var _this = this;
    var logger = require("ko/logging").getLogger("komodoR");
    
    logger.debug("initialization started");

    const { classes: Cc, interfaces: Ci, utils: Cu } = Components;
    
    const kor = require("kor/main"), fileUtils = require("kor/fileutils");
    var R = kor.r, ko = kor.mainWin.ko;

    if (typeof Services === "undefined")
        Cu.import("resource://gre/modules/Services.jsm");

    var checkFileAssociation = () => {
        var langRegistry = Cc["@activestate.com/koLanguageRegistryService;1"]
            .getService(Ci.koILanguageRegistryService);

        var rFileLang = langRegistry.suggestLanguageForFile("foo.R");
        var prefs = require("ko/prefs");

        if (!prefs.hasBooleanPref("donotask_r_association_override"))
            prefs.setBooleanPref("donotask_r_association_override", false);
            
        if (!rFileLang || (rFileLang != kor.langName &&
            require("ko/dialogs").confirm("Currently *.R files are associated with language " + rFileLang + ". " +
                "Would you like to replace this association with R language? " +
                "\n(This can be changed in Preferences -> File associations)", {
                    yes: "Yes", no: "No", response: "Yes",
                    title: "R file association conflict",
                    doNotAskPref: "r_association_override"
                    }))) {

            // from content/pref/pref-association.js:OnPreferencePageOK
            let patternsObj = {}, languageNamesObj = {};
            langRegistry.getFileAssociations({}, patternsObj, {}, languageNamesObj);
            let patterns = patternsObj.value;
            let languageNames = languageNamesObj.value;
            for (let i = patterns.length - 1; i >= 0; --i) {
                if (patterns[i].toUpperCase() == "*.R" && languageNames[i] != kor.langName)
                    languageNames[i] = kor.langName;
            }

            try {
                let assocPref = langRegistry.createFileAssociationPrefString(
                    patterns.length, patterns,
                    languageNames.length, languageNames);
                prefs.setStringPref("fileAssociationDiffs", assocPref);
            } catch (ex) {
                let lastErrorSvc = Cc["@activestate.com/koLastErrorService;1"]
                    .getService(Ci.koILastErrorService);
                require("ko/dialogs").alert("There was an error saving file association changes: " +
                    lastErrorSvc.getLastErrorMessage());
            }
        }
    };

    var ensureRFileAssociation = function ensureRFileAssociation() {
        var view = require("ko/views").current();
        if (view && view.koDoc && view.koDoc.file.ext === ".R") {
            checkFileAssociation();
            window.removeEventListener('view_opened', ensureRFileAssociation, false);
            if (view.koDoc.language !== kor.langName) view.koDoc.language = kor.langName;
        }
    };

    window.addEventListener('view_opened', ensureRFileAssociation, false);

    //--------------------------------------------------------------------------  

    // Set default keybindings from file
    // chrome://komodor/content/default-keybindings.kkf
    // preserving user modified ones and avoiding key conflicts
    // sfx is for platform specific keybindings
    function _setKeybindings(clearOnly) {
        var kkfContent;
        try {
            kkfContent = fileUtils.readURI("chrome://komodor/content/keybindings.kkf");
        } catch (e) {
            return false;
        }
        if (!kkfContent) return false;

        logger.info("Setting default key bindings.");

        var kbMgr = ko.keybindings.manager;
        if (kbMgr.currentConfiguration === undefined)
            kbMgr = new ko.keybindings.manager();
        var currentConfiguration = kbMgr.currentConfiguration;

        if (!kbMgr.configurationWriteable(currentConfiguration))
            currentConfiguration = kbMgr.makeNewConfiguration(currentConfiguration + " [+R]");

        //from: gKeybindingMgr.parseConfiguration
        //var bindingRx = /[\r\n]+(# *SciViews|binding cmd_sv.*)/g;

        var bindingStr = kkfContent.match(new RegExp("^binding cmd_.*$", "gm"));
        var schemeKeys = {}, cmdName, key, cmdNames = [];
        for (let j = 0; j < bindingStr.length; ++j) {
            try {
                [, cmdName, key] = /^binding\s+(\S+)\s+(\S+)$/.exec(bindingStr[j]);
                schemeKeys[cmdName] = key;
                cmdNames.push(cmdName);
            } catch (e) {}
        }

        // upgrade command names if needed:
        cmdNames.forEach(cmdid => {
            let cmdOld = cmdid.replace(/^cmd_sv/, "cmd_"); // XXX: update cmd_R ==> cmd_svR
            let keyLabel = kbMgr.command2keylabel(cmdOld); // String!
            if (keyLabel) {
                // assignKey-> keysequence2keylabel produces some weird labels like F11,0 fix it here:
                let key = Array.from(kbMgr.command2key[cmdOld]); // clone array
                logger.debug("Upgrading command " + cmdOld + " to " + cmdid + ": key is " + key);
                kbMgr.clearBinding(cmdOld, "", false);
                kbMgr.assignKey(cmdid, key, "");
                kbMgr.command2key[cmdid] = key;
                kbMgr.makeKeyActive(cmdid, key);
            }
        }); // forEach
        kbMgr.saveCurrentConfiguration();

        if (clearOnly) {
            cmdNames.forEach(cmdid => kbMgr.clearBinding(cmdid, "", false));
        } else {
            cmdNames.forEach(cmdid => {
                let keySequence = schemeKeys[cmdid].split(/, /);
                let usedBy = kbMgr.usedBy(keySequence);
                if (!usedBy.length) {
                    kbMgr.assignKey(cmdid, keySequence, '');
                    kbMgr.makeKeyActive(cmdid, keySequence);
                    logger.debug("Assigned key sequence " + keySequence.join(", ") +
                        " to command " +
                        cmdid);
                }
            });
        }

        //kbMgr.saveAndApply(ko.prefs);
        kbMgr.saveCurrentConfiguration();
        kbMgr.loadConfiguration(kbMgr.currentConfiguration, true);
        //delete kbMgr;
        return true;
    } // _setKeybindings

    //this.setKeybindings = function (clearOnly, sfx) _setKeybindings(clearOnly, sfx);
   
    var onLoad = function korOnLoadObserver( /*win, topic, ...data */ ) {
        logger.debug("initialization - onLoad started (on komodo-ui-started event)");
        Services.obs.removeObserver(korOnLoadObserver, "komodo-ui-started");
        
        //topic="komodo-ui-started"
        // first run:
        const prefs = require("ko/prefs");
        let firstRunPref = "RInterface.firstRunDone";

        if (!prefs.hasPref(firstRunPref) || kor.version !== prefs.getStringPref(firstRunPref)) {
            prefs.setStringPref(firstRunPref, kor.version);
            
            // os.name is nt, posix, java. Use
            // Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS.toLowerCase();
            let osName = Cc['@activestate.com/koOs;1'].getService(Ci.koIOs).name;
            if (!_setKeybindings(false, osName)) // use system specific keybindings
                _setKeybindings(false, ''); // fallback - use default

            // XXX (old pref name) remove at some point:
            prefs.deletePref("rInterface.firstRunDone");
            
            let langHelpCommandName = require("kor/main").langName + "HelpCommand";
            if(prefs.hasStringPref(langHelpCommandName)) {
				let langHelpCommand = prefs.getStringPref(langHelpCommandName);
				if (langHelpCommand.contains('sv'))
					prefs.setStringPref(langHelpCommandName, langHelpCommand.replace(/\bsv\b/g, "kor"));
			}
			
            // Open NEWS:
            let doc = Services.koDocSvc.createDocumentFromURI("chrome://komodor/content/doc/NEWS.html");
            require("ko/views").manager.topView.createViewFromDocument(doc, 'browser', -1);
        } // end first run

        require("kor/prefs").setDefaults(false);

 
        // For completions
        let cuih = ko.codeintel.CompletionUIHandler;
        if (cuih) {
            // TODO: replace with svg
            let baseURI = "chrome://komodor/skin/images/";
            //cuih.prototype.types.argument = cuih.prototype.types.interface;
            cuih.prototype.types.environment = cuih.prototype.types.namespace;
            cuih.prototype.types.file = baseURI + "cb_file.png";
            cuih.prototype.types.argument = baseURI + "cb_argument.png";
            cuih.prototype.types.grapharg = baseURI + "cb_graphical_argument.png";
            cuih.prototype.types.dataset = baseURI + "cb_data.png";
        }        
        
        
        const notify = require("notify/notify");
        notify.categories.register("R-formatter", { label: "R code formatter", opts: { duration: 2000 } });
        notify.categories.register("R-interface", { label: "R Interface", opts: { severity: "info",
                duration: 3000, icon: "koicon://ko-svg/chrome/icomoon/skin/notification2.svg" } });
        
        // Workaround for missing icons in "customize" view. Add "image" attribute to R toolbar buttons.
        // XXX: do that permanently in xul overlay
        if(parseInt(ko.version.match(/\d+/)[0]) > 9) {
            
            let buttonSetImageAttribute = (button) => {
                let imgsrc = document.defaultView.getComputedStyle(button).listStyleImage;
                if(imgsrc.startsWith("url(")) imgsrc = imgsrc.replace(/^url\("(.*)"\)$/, "$1");
                else imgsrc = document.getAnonymousElementByAttribute(button, "class", "toolbarbutton-icon").src;
                if(imgsrc) button.setAttribute("image", imgsrc);
                logger.debug("buttonSetImageAttribute: id=" + button.id);
            };
            for(let button of document.getElementById("RToolbar").getElementsByTagName("toolbarbutton"))
                buttonSetImageAttribute(button);
        }
		
        setTimeout(() => {
            kor.rconn.startSocketServer();
            kor.command.setControllers();
            kor.command.setRStatus(kor.rconn.isRConnectionUp(true));
            ko.commands.updateCommand("cmd_svREscape"); // ?

            logger.debug("initialization - delayed tasks end");

        }, 1000);

        
        logger.debug("initialization - onLoad done");
    }; // onLoad

    // "komodo-post-startup" event in Komodo 9 only.
    //addEventListener("komodo-post-startup", _this.onLoad, false);
    Services.obs.addObserver(onLoad, "komodo-ui-started", false);
  
         
//var buttonGetImage = (button) => {
//    let imgsrc = document.defaultView.getComputedStyle(button).listStyleImage;
//    if(imgsrc.startsWith("url(")) imgsrc = imgsrc.replace(/^url\("(.*)"\)$/, "$1");
//    else imgsrc = document.getAnonymousElementByAttribute(button, "class", "toolbarbutton-icon").src;
//    return imgsrc;
//};
 
    var onKomodoRUpdateRestart = function () {
        if (!kor.command.isRRunning) return true;
        //if (topic != "quit-application-requested") return;

        let staged = fileUtils.exists2(fileUtils.path("ProfD", "extensions", "staged",
            kor.extensionId)) == fileUtils.TYPE_DIRECTORY;
        if (staged) {
            let result = ko.dialogs.yesNoCancel(
                "In order to complete the update of \"R Interface\" add-on, " +
                "the connected R session must be closed. Do you want to save your R workspace? " +
                "Click \"Cancel\" to leave R open " +
                "(the add-on will not be updated until you restart Komodo" +
                " with R unconnected).", null, null,
                "\"R interface\" update");

            switch (result) {
            case "Yes":
                R.quit("yes");
                break;
            case "No":
                R.quit("no");
                break;
            default:
            }
        }
        //cancelQuit.data = true;
        return true;
    };

    //Services.obs.addObserver(onKomodoRUpdateRestart, "quit-application-requested", false);

    // Just in case, run a clean-up before quitting Komodo:
    ko.main.addWillCloseHandler(() => require("kor/connector").stopSocketServer(), null);
    //ko.main.addWillCloseHandler(sv.rconn.stopSocketServer, sv.rconn);
    ko.main.addWillCloseHandler(onKomodoRUpdateRestart, null);

    var rStatusChangeObserver = function (event) {
        let running = event.detail.running;
        if (typeof event.detail.running === "undefined")
            logger.warning("'r-status-change' event did not provide the expected data");
        let el = document.getElementById('cmd_svRStarted');
        if (running) el.setAttribute("checked", "true");
            else el.removeAttribute("checked");
        require("kor/ui").addNotification(running ? "R session is connected" : "R is not running");
    };
    window.addEventListener("r-status-change", rStatusChangeObserver, false);
    
   logger.debug("initialization (main thread) completed");

}).apply(null);