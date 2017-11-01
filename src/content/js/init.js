/* globals sv, ko, Components, window, document, require,
   Services
   */
sv.init = {};

(function () {
    var _this = this;
    var logger = require("ko/logging").getLogger("komodoR");

    const {
        classes: Cc,
        interfaces: Ci
    } = Components;

    //------------------------------------------------------------------------------------------------------------

    var checkFileAssociation = function () {
        var langRegistry = Components.classes["@activestate.com/koLanguageRegistryService;1"]
            .getService(Components.interfaces.koILanguageRegistryService);

        var rFileLang = langRegistry.suggestLanguageForFile("foo.R");

        if (!ko.prefs.hasBooleanPref("donotask_r_association_override")) {
            ko.prefs.setBooleanPref("donotask_r_association_override", false);
        }

        if (!rFileLang || (rFileLang != sv.langName && ko.dialogs.yesNo(
                "Currently *.R files are associated with language " + rFileLang + ". " +
                "Would you like to replace this association with R language? " +
                "\n(This can be changed in Preferences -> File associations)",
                "Yes", null, "R file association conflict", "r_association_override") == "Yes")) {

            // from content/pref/pref-association.js:OnPreferencePageOK
            let patternsObj = {},
                languageNamesObj = {};
            langRegistry.getFileAssociations({}, patternsObj, {}, languageNamesObj);
            let patterns = patternsObj.value;
            let languageNames = languageNamesObj.value;
            for (let i = patterns.length - 1; i >= 0; --i) {
                if (patterns[i].toUpperCase() == "*.R" && languageNames[i] != sv.langName)
                    languageNames[i] = sv.langName;
            }

            try {
                let assocPref = langRegistry.createFileAssociationPrefString(
                    patterns.length, patterns,
                    languageNames.length, languageNames);
                ko.prefs.setStringPref("fileAssociationDiffs", assocPref);
            } catch (ex) {
                let lastErrorSvc = Components.classes["@activestate.com/koLastErrorService;1"]
                    .getService(Components.interfaces.koILastErrorService);
                ko.dialogs.alert("There was an error saving file association changes: " +
                    lastErrorSvc.getLastErrorMessage());
            }
        }
    };

    this.ensureRFileAssociation = function ensureRFileAssoc() {
        var view = ko.views.manager.currentView;
        if (view && view.koDoc && view.koDoc.displayPath.match(/\.[Rr]$/)) {
            checkFileAssociation();
            window.removeEventListener('view_opened', ensureRFileAssoc, false);
            if (view.koDoc.language != sv.langName) view.koDoc.language = sv.langName;
        }
    };

    window.addEventListener('view_opened', this.ensureRFileAssociation, false);

    //------------------------------------------------------------------------------------------------------------  

    // Set default keybindings from file
    // chrome://komodor/content/default-keybindings.kkf
    // preserving user modified ones and avoiding key conflicts
    // sfx is for platform specific keybindings
    function _setKeybindings(clearOnly, sfx) {

        if (!sfx) sfx = "";
        var kkfContent;
        try {
            kkfContent = sv.file.readURI("chrome://komodor/content/keybindings" + sfx + ".kkf");
        } catch (e) {
            return false;
        }
        if (!kkfContent) return false;

        logger.info("Setting default key bindings.");

        var kbMgr = ko.keybindings.manager;
        if (kbMgr.currentConfiguration == undefined) {
            kbMgr = new ko.keybindings.manager();
        }
        var currentConfiguration = kbMgr.currentConfiguration;

        if (!kbMgr.configurationWriteable(currentConfiguration))
            currentConfiguration = kbMgr.makeNewConfiguration(currentConfiguration + " [+R]");

        //from: gKeybindingMgr.parseConfiguration
        //var bindingRx = /[\r\n]+(# *SciViews|binding cmd_sv.*)/g;

        var bindingStr = kkfContent.match(new RegExp("^binding cmd_.*$", "gm"));
        var schemeKeys = {},
            cmdName, key, cmdNames = [];
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

    this.onLoad = function sv_onLoadObserver( /*win, topic, ...data */ ) {
        //topic="komodo-ui-started"
        // first run:
        var firstRunPref = "rInterface.firstRunDone";
        if (!ko.prefs.hasPref(firstRunPref) || sv.version != ko.prefs.getStringPref(firstRunPref)) {
            ko.prefs.setStringPref(firstRunPref, sv.version);
            let osName = Cc['@activestate.com/koOs;1'].getService(Ci.koIOs).name;
            if (!_setKeybindings(false, osName)) // use system specific keybindings
                _setKeybindings(false, ''); // fallback - use default
        } // end first run

        var thisWin = window;
        var onLoadIntervalId;
        onLoadIntervalId = thisWin.setInterval(function () {
            if (!sv.rbrowser) return;
            thisWin.clearInterval(onLoadIntervalId);

            sv.pref.setDefaults(false);
            sv.rconn.startSocketServer();

            sv.command.setControllers();
            sv.command.setRStatus(sv.rconn.isRConnectionUp(true));

            if (sv.command.isRRunning) sv.rbrowser.refresh();

            // For completions
            var cuih = ko.codeintel.CompletionUIHandler;
            if (cuih) {
                let baseURI = "chrome://komodor/skin/images/";
                //cuih.prototype.types.argument = cuih.prototype.types.interface;
                cuih.prototype.types.environment = cuih.prototype.types.namespace;
                cuih.prototype.types.file = baseURI + "cb_file.png";
                cuih.prototype.types.argument = baseURI + "cb_argument.png";
                cuih.prototype.types.grapharg = baseURI + "cb_graphical_argument.png";
                cuih.prototype.types.dataset = baseURI + "cb_data.png";
            }
        }, 1000);
        Services.obs.removeObserver(sv_onLoadObserver, "komodo-ui-started");
    }; // onLoad

    // "komodo-post-startup" event in Komodo 9 only.
    //addEventListener("komodo-post-startup", _this.onLoad, false);
    Services.obs.addObserver(_this.onLoad, "komodo-ui-started", false);

    this.onKomodoRUpdateRestart = function (cancelQuit, topic, data) {
        if (!sv.command.isRRunning) return;
        if (topic != "quit-application-requested") return;

        let staged = sv.file.exists2(sv.file.path("ProfD", "extensions", "staged",
            sv.extensionId)) == sv.file.TYPE_DIRECTORY;
        if (staged && data == "restart") {
            let result = ko.dialogs.yesNoCancel(
                "In order to complete the update of \"R Interface\" add-on, " +
                "the connected R session must be closed. Do you want to save your R workspace? " +
                "Click \"Cancel\" to leave R open " +
                "(the add-on will not be updated until you restart Komodo" +
                " with R unconnected", null, null,
                "\"R interface\" update");

            switch (result) {
            case "Yes":
                sv.r.quit("yes");
                break;
            case "No":
                sv.r.quit("no");
                break;
            default:
            }
        }
        //cancelQuit.data = true;
    };

    Services.obs.addObserver(_this.onKomodoRUpdateRestart, "quit-application-requested", false);

    // Just in case, run a clean-up before quitting Komodo:
    ko.main.addWillCloseHandler(() => sv.rconn.stopSocketServer());

    var observeR = function () {
        var el = document.getElementById('cmd_svRStarted');
        if (sv.command.isRRunning) el.setAttribute("checked", "true");
        else el.removeAttribute("checked");
    };
    window.addEventListener("r_app_started_closed", observeR, false);

}).apply(sv.init);