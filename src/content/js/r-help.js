// SciViews-K R functions
// Define functions to pilot R from Komodo Edit 'sv.r' & 'sv.r.pkg'
// based on original Komodo code
// Copyright (c) 2000-2007, ActiveState Software Inc
// Copyright (c) 2009-2010, Kamil Bartoñ
// License: MPL 1.1/GPL 2.0/LGPL 2.1
////////////////////////////////////////////////////////////////////////////////
// ko.help.language();	// Replacement for language specific help on selection
						// function (cmd_helpLanguage command) extended to
						// handle "javascript:" commands.
// original code located in chrome://komodo/content/launch.js
////////////////////////////////////////////////////////////////////////////////

// This should be kept updated with new versions of the original function
ko.help.language = function () {
    var language = null;
    var view = ko.window.focusedView();
    if (!view) {
        view = ko.views.manager.currentView;
    }
    if (view != null) {
        if (view.koDoc) {
            language = view.koDoc.subLanguage;
            if (language == "XML") language = view.koDoc.language;
        } else language = view.language;
    }

    var command = null, name = null;
    if (language) {
        if (ko.prefs.hasStringPref(language + "HelpCommand")) {
            command = ko.prefs.getStringPref(language + "HelpCommand");
        } else {
            var langRegistrySvc = Components
				.classes['@activestate.com/koLanguageRegistryService;1']
				.getService(Components.interfaces.koILanguageRegistryService);
            var languageObj = langRegistrySvc.getLanguage(language);
            if (languageObj.searchURL) {
                command = "%(browser) " + languageObj.searchURL;
            }
        }
        if (command) {
            name = language + " Help";
        }
    }
    if (!command) {
        command = ko.prefs.getStringPref("DefaultHelpCommand");
        name = "Help";
    }

	if (command.search(/^\s*javascript:\s*(\S.*)\s*$/) != -1)  {
		command = ko.interpolate.interpolateString(RegExp.$1);
		eval(command);
	} else {
		ko.run.runCommand(window, command, null, null, false, false, true,
			"no-console", 0, "", 0, name);
	}
}
