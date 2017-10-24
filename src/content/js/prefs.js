// SciViews-K preferences management ('sv.pref' namespace)
// Define default preferences values for SciViews-K and MRU lists
// Copyright (c) 2008-2011, Ph. Grosjean & K. Barton
// License: MPL 1.1/GPL 2.0/LGPL 2.1
if (sv.pref == undefined) sv.pref = {};

//This can be used in the Preferences page to set/restore missing values:
//sv.pref.setDefaults()

(function () {

    /* Preferences */
    var _this = this;
    var prefset = ko.prefs;

    Object.defineProperty(_this, 'prefset', {
        get: function () prefset,
        set: function (val) prefset = val,
        enumerable: true
    });

    this.defaults = {
        'RInterface.koPort': 7052,
        'RInterface.RPort': 8888,
        'RInterface.RHost': '127.0.0.1',
        'RInterface.pathToR': '',
        'RInterface.runRAs': '',
        'RInterface.cmdArgs': '--quiet',
        'RInterface.CSVDecimalSep': '.',
        'RInterface.CSVSep': ',',
        'CRANMirror': 'https://cran.r-project.org/',
        'CRANMirrorSecure': true,
        'RInterface.rRemoteHelpURL': 'http://finzi.psych.upenn.edu/R/', // TODO update URL
        'RInterface.marginClick': true
    };

    this.defaults[sv.langName + "HelpCommand"] = 'javascript:sv.r.help(\"%W\")';

	// Update preference names:
	var logger = require("ko/logging").getLogger("komodoR");
    logger.setLevel(logger.INFO);

    var renamePref = function (fromName, toName) {
        if (prefset.hasPref(fromName) && !prefset.hasPref(toName)) {
            let type = ['long', 'double', 'boolean', 'string'].indexOf(prefset.getPrefType(fromName));
            if (type == -1) return false;
            let typeName = ['Long', 'Double', 'Boolean', 'String'][type];
            let value = prefset['get' + typeName + 'Pref'](fromName);
			prefset.deletePref(fromName);
			prefset['set' + typeName + 'Pref'](toName, value);
			return true;
        }
		return false;
    };
    var oldNames = ["sciviews.ko.port", "sciviews.r.port", "sciviews.r.host", "svRDefaultInterpreter",
		"svRApplication", "svRArgs", "r.csv.dec", "r.csv.sep", "CRANMirror", "CRANMirrorSecure",
        "rRemoteHelpURL", "sciviews.margin.click", "R_extendedHelpCommand"
    ];
	var newNames = [];
	for(let i in this.defaults) if(this.defaults.hasOwnProperty(i)) newNames.push(i);
	for (let i = 0; i < newNames.length; ++i) {
        if(renamePref(oldNames[i], newNames[i]))
		  logger.info("Updated preference name from " + oldNames[i] + " to " + newNames[i]);  
    }
	
	

    //// Set default preferences
    this.setDefaults = function sv_checkAllPref(revert) {
        var val, rev, hasPref;
        for (var i in _this.defaults)
            if (_this.defaults.hasOwnProperty(i)) {
                hasPref = prefset.hasPref(i);
                val = hasPref ? _this.getPref(i) : null;
                rev = revert || (typeof val == "number" && isNaN(val)) ||
                    val == "None";
                //|| (_this.defaults[i] !== '' && val === '');
                _this.setPref(i, _this.defaults[i], rev);
            }
    };


    this.getPref = function (prefName, defaultValue) {
        var ret, typeName, type;
        if (prefset.hasPref(prefName)) {
            type = ['long', 'double', 'boolean', 'string']
                .indexOf(prefset.getPrefType(prefName));
            if (type == -1) return undefined;
            typeName = ['Long', 'Double', 'Boolean', 'String'][type];
            ret = prefset['get' + typeName + 'Pref'](prefName);
        } else ret = defaultValue;
        return ret;
    };

    this.setPref = function (prefName, value, overwrite, asInt) {
        var typeName, type;
        if (prefset.hasPref(prefName)) {
            if (overwrite === false) return '';
            type = prefset.getPrefType(prefName);

        } else {
            type = typeof value;
            if (type == 'number') type = asInt ? "long" : "double";
        }
        type = ['double', 'long', 'boolean', 'string'].indexOf(type);
        if (type == -1 || type == null)
            return undefined;
        typeName = ['Double', 'Long', 'Boolean', 'String'][type];
        prefset['set' + typeName + 'Pref'](prefName, value);
        return typeName;
    };

    this.deletePref = function (prefName) {
        prefset.deletePref(prefName);
        return prefset.hasPref(prefName);
    };

}).apply(sv.pref);

sv.pref.setDefaults(false);