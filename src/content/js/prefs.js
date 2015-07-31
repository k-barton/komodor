// SciViews-K preference code
// SciViews-K preferences management ('sv.prefs' namespace)
// Define default preferences values for SciViews-K and MRU lists
// Copyright (c) 2008-2011, Ph. Grosjean & K. Barton
// License: MPL 1.1/GPL 2.0/LGPL 2.1
////////////////////////////////////////////////////////////////////////////////
// sv.pref.getPref(pref, def); // Get a preference, use 'def' is not found
// sv.pref.setPref(pref, value, overwrite); // Set a preference string
////////////////////////////////////////////////////////////////////////////////

if (sv.pref == undefined) sv.pref = {};

//This can be used in the Preferences page to set/restore missing values:
//sv.prefs.checkAll()

// sv.prefs.defaults[preferenceName] = preferenceValue
sv.defaultPrefs = {
	'sciviews.ko.port': 7052,
	'sciviews.r.port': 8888,
	'sciviews.r.host': '127.0.0.1',
	'sciviews.client.id': 'SciViewsK',
	'sciviews.client.type': 'socket',
	'sciviews.conn.type': 'socket',
	svRDefaultInterpreter: '',
	svRApplication: '',
	svRArgs: '--quiet',
    'r.csv.dec': '.',
	'r.csv.sep': ',',
	'r.application': '', // XXX this one is of questionable usefulness
	CRANMirror: 'http://cran.r-project.org/',
	RHelpCommand: 'javascript:sv.r.help(\"%w\")',
	'r.remote.help': 'http://finzi.psych.upenn.edu/R/',
	'sciviews.margin.click': true
};

//// Set default preferences
sv.checkAllPref = function sv_checkAllPref(revert) {
	var val, rev;
	for (var i in sv.defaultPrefs) {
		val = sv.pref.getPref(i);
		rev = revert || (typeof(val) == "number" && isNaN(val)) || val == "None"
			|| (sv.defaultPrefs[i] != '' && val == '');
		sv.pref.setPref(i, sv.defaultPrefs[i], rev);
	}
};


(function() {

/* Preferences */
var prefset = Components.classes["@activestate.com/koPrefService;1"]
	.getService(Components.interfaces.koIPrefService).prefs;

this.prefset = prefset;

this.getPref = function(prefName, defaultValue) {
	var ret, typeName, type;
	if (prefset.hasPref(prefName)) {
		type = ['long', 'double', 'boolean', 'string'].indexOf(prefset.getPrefType(prefName));
		if (type == -1) return undefined;
		typeName = ['Long', 'Double', 'Boolean', 'String'][type];
		ret = prefset['get' + typeName + 'Pref'](prefName);
	} else ret = defaultValue;
	return ret;
}

this.setPref = function(prefName, value, overwrite, asInt) {
	var typeName, type;
	if (prefset.hasPref(prefName)) {
		if (overwrite === false) return '';
		type = prefset.getPrefType(prefName);
	} else {
		type = typeof value;
		if (type == 'number') type =  asInt? "long" : "double";
	}
	type = ['double', 'long', 'boolean', 'string'].indexOf(type);
	if (type == -1 || type == null) return undefined;
	typeName = ['Double', 'Long', 'Boolean', 'String'][type];
	prefset['set' + typeName + 'Pref'](prefName, value);
	return typeName;
}

this.deletePref = function(prefName) {
	prefset.deletePref(prefName);
	return prefset.hasPref(prefName);
}

}).apply(sv.pref);


sv.checkAllPref(false);
