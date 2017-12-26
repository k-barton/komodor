/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 */

/* Replacement for language specific help on selection.
 * function (cmd_helpLanguage command) extended to handle "javascript:" format.
 * The original code is located in chrome://komodo/content/launch.js
 * 
 * Note: this should be kept updated with new versions of the original function.
*/


/**
 * Opens language specific help for the current buffer.
 *
 * @param {string} searchTerm  Open language help for this search term.
 */

/* globals ko, sv, window, Components, require */
 
// Komodo 9
	ko.help.language = function () {
		var language = null;
		var view = ko.window.focusedView();
		if (!view) 
			view = ko.views.manager.currentView;
		if (view != null) {
			if (view.koDoc) {
				language = view.koDoc.subLanguage;
				if (language === "XML") language = view.koDoc.language;
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
		
		command = command.trim();
		if (command.startsWith("javascript:")) { // jshint ignore: line
			command = command.substring(11).trim();
			eval(ko.interpolate.interpolateString(command)); // jshint ignore: line
		} else { 
			ko.run.runCommand(window, command, null, null, false, false, true,
				"no-console", 0, "", 0, name);
		}
	};

