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
 
if(sv._versionCompare(ko.version, "10") < 0) {
	
// Komodo 9
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
		
		command = command.trim();
		if (command.indexOf("javascript:") === 0) {
			command = command.substring(11).trim();
			eval(ko.interpolate.interpolateString(command));
		} else { 
			ko.run.runCommand(window, command, null, null, false, false, true,
				"no-console", 0, "", 0, name);
		}
	}
	
} else {
	
/**
 * Opens language specific help for the current buffer.
 *
 * @param {string} searchTerm  Open language help for this search term.
 */
 
	// Komodo 10-11
	ko.help.language = function(searchTerm) {
		// Get the current document's language.
		var language = null;
		var view = ko.window.focusedView();
		if (!view) view = ko.views.manager.currentView;
		if (view != null) {
			if (view.koDoc) {
				language = view.koDoc.subLanguage;
				if (language == "XML") {
					// use the primary language, not the sublanguage
					language = view.koDoc.language
				}
			} else {
				language = view.language;
			}
		}

		// Get the help command appropriate for that language.
		var command=null, name=null;
		if (language) {
			if (ko.prefs.hasStringPref(language+'HelpCommand')) {
				command = ko.prefs.getStringPref(language+'HelpCommand');
			} else {
				// try to get from the language service
				var langRegistrySvc = Components.classes['@activestate.com/koLanguageRegistryService;1'].
								  getService(Components.interfaces.koILanguageRegistryService);
				var languageObj = langRegistrySvc.getLanguage(language);
				if (languageObj.searchURL) {
					var searchURL = languageObj.searchURL;
					if (searchURL.indexOf("?") == -1) {
						// search with google, encode URL correctly.
						searchURL = ("http://www.google.com/search?q="
									 + encodeURIComponent("site:" + searchURL)
									 + "+%W");
					}
					command = "%(browser) " + searchURL;

				}
			}
			if (command) {
				name = language + " Help";
			}
		}
		if (!command) {
			// Couldn't find language-specific help command -- use the default one.
			command = ko.prefs.getStringPref('DefaultHelpCommand');
			name = "Help";
		}

		if (searchTerm && command.indexOf("%W") >= 0) {
			command = command.replace("%W", searchTerm);
		}

		command = command.trim();
		if (command.indexOf("javascript:") === 0) {
			eval(command.substring(11).trim());
		} else { 
			ko.run.command(command,
						   {
							"runIn": 'no-console',
							"openOutputWindow": false,
							"name": name,
						   });
		}
	}	

}







