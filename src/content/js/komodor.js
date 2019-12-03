/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */
/* globals self */

self.kor = require("kor/main");

(function() {
	var logging = require("ko/logging");
	//var level = logging.LOG_WARN;
	var level = logging.LOG_DEBUG;
	//LOG_NOTSET, LOG_DEBUG, LOG_INFO, LOG_WARN, LOG_ERROR, LOG_CRITICAL
	logging.getLogger("komodoR").setLevel(level);
	logging.getLogger("korRConnector").setLevel(level);
	logging.getLogger("cile.rx").setLevel(level);
	logging.getLogger("RConn").setLevel(level);
	logging.getLogger("koRLanguage").setLevel(level);
	logging.getLogger("RLinter").setLevel(level);
	logging.getLogger("koRmarkdownLanguage").setLevel(level);
	logging.getLogger("korScimozUtils").setLevel(level);
	logging.getLogger("kor/cmdout").setLevel(level);
	logging.getLogger("kor/connector").setLevel(level);
	
	// DEBUG:
	logging.getLogger("koScintillaSchemeService").setLevel(logging.LOG_ERROR);
	logging.getLogger("koJavaScriptLinter").setLevel(logging.LOG_ERROR);
    
    var scriptloader = ((typeof Services === "object") && Services.scriptloader) ?
        Services.scriptloader :
        Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
            .getService(Components.interfaces.mozIJSSubScriptLoader);
    for(let a of ["init", "r-help", "bookmark"])
        scriptloader.loadSubScript("chrome://komodor/content/js/" + a + ".js", window, "utf-8");

    
}).call(null);
