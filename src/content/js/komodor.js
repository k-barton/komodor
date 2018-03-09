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
	//LOG_NOTSET, LOG_DEBUG, LOG_INFO, LOG_WARN, LOG_ERROR, LOG_CRITICAL
	logging.getLogger("komodoR").setLevel(logging.LOG_WARN);
	logging.getLogger("korRConnector").setLevel(logging.LOG_WARN);
	logging.getLogger("cile.rx").setLevel(logging.LOG_WARN);
	logging.getLogger("koRLanguage").setLevel(logging.LOG_WARN);
	logging.getLogger("RLinter").setLevel(logging.LOG_WARN);
	logging.getLogger("koRmarkdownLanguage").setLevel(logging.LOG_WARN);
	logging.getLogger("korScimozUtils").setLevel(logging.LOG_WARN);
}).call(null);
