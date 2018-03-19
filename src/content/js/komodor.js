/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  This code is based on SciViews-K general functions, which are
 *  copyright (c) 2008-2010 by Ph. Grosjean (phgrosjean@sciviews.org)
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */
/* globals self */

self.kor = require("kor/main");

(function() {
	let logging = require("ko/logging");
	let level = logging.LOG_WARN;
	//let level = logging.LOG_DEBUG;
	//LOG_NOTSET, LOG_DEBUG, LOG_INFO, LOG_WARN, LOG_ERROR, LOG_CRITICAL
	logging.getLogger("komodoR").setLevel(level);
	logging.getLogger("korRConnector").setLevel(level);
	logging.getLogger("cile.rx").setLevel(level);
	logging.getLogger("koRLanguage").setLevel(level);
	logging.getLogger("RLinter").setLevel(level);
	logging.getLogger("koRmarkdownLanguage").setLevel(level);
	logging.getLogger("korScimozUtils").setLevel(level);
}).call(null);
