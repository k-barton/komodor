// SciViews-K preferences management ('sv.pref' namespace)
// Define default preferences values for SciViews-K and MRU lists
// Copyright (c) 2008-2011, Ph. Grosjean & K. Barton
// License: MPL 1.1/GPL 2.0/LGPL 2.1

if (sv.pref == undefined) sv.pref = {};

//This can be used in the Preferences page to set/restore missing values:
//sv.pref.setDefaults()

(function() {

/* Preferences */
var _this = this;
var prefset = ko.prefs;

Object.defineProperty(_this, 'prefset', {
  get: function() { return prefset; },
  set: function(val) { prefset = val; },
  enumerable: true
});

this.defaults = {
	'sciviews.ko.port': 7052,
	'sciviews.r.port': 8888,
	'sciviews.r.host': '127.0.0.1',
	svRDefaultInterpreter: '',
	svRApplication: '',
	svRArgs: '--quiet',
    'r.csv.dec': '.',
	'r.csv.sep': ',',
	'r.application': '', // XXX this one is of questionable usefulness
	CRANMirror: 'https://cran.r-project.org/',
	CRANMirrorSecure: true,
	'rRemoteHelpURL': 'http://finzi.psych.upenn.edu/R/',
	'sciviews.margin.click': true
};

this.defaults[sv.langName + "HelpCommand"] = 'javascript:sv.r.help(\"%W\")';

//// Set default preferences
this.setDefaults = function sv_checkAllPref(revert) {
	var val, rev, hasPref;
	for (var i in _this.defaults) {
		hasPref = prefset.hasPref(i);
		val = hasPref ? _this.getPref(i) : null;
		rev = revert || (typeof val == "number" && isNaN(val)) || val == "None";
			//|| (_this.defaults[i] !== '' && val === '');
		_this.setPref(i, _this.defaults[i], rev);
	}
};


this.getPref = function(prefName, defaultValue) {
	var ret, typeName, type;
	if (prefset.hasPref(prefName)) {
		type = ['long', 'double', 'boolean', 'string']
            .indexOf(prefset.getPrefType(prefName));
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
	if (type == -1 || type == null)
		return undefined;
	typeName = ['Double', 'Long', 'Boolean', 'String'][type];
	prefset['set' + typeName + 'Pref'](prefName, value);
	return typeName;
}

this.deletePref = function(prefName) {
	prefset.deletePref(prefName);
	return prefset.hasPref(prefName);
}

}).apply(sv.pref);

sv.pref.setDefaults(false);
