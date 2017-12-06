/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *  Copyright (c) 2011-2017 Kamil Barton
 *  
 *  This code is based on SciViews-K code:
 *  Copyright (c) 2008-2011, Ph. Grosjean (phgrosjean@sciviews.org) & K. Barton
 * 
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */
/* globals sv, ko, require */
if (sv.pref === undefined) sv.pref = {};

//This can be used in the Preferences page to set/restore missing values:
//sv.pref.setDefaults()

(function () {

    /* Preferences */
    var _this = this, _prefset = ko.prefs;

    Object.defineProperty(_this, 'prefset', {
        get: function () _prefset,
        set: function (val) _prefset = val,
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
        'RInterface.marginClick': true,
        'RInterface.format.keepBlankLines': true,
        'RInterface.format.replaceAssign': false,
        'RInterface.format.newlineBeforeBrace': false
    };
    //this.defaults[sv.langName + "HelpCommand"] = ;
    Object.defineProperty(this.defaults, sv.langName + "HelpCommand", {
        value: 'javascript:sv.r.help(\"%W\")', // jshint ignore:line
        writable: true,
        enumerable: true
    });

    // Update preference names:
    var logger = require("ko/logging").getLogger("komodoR");

    var renamePref = function (fromName, toName) {
        if (_prefset.hasPref(fromName) && !_prefset.hasPref(toName)) {
            let type = ['long', 'double', 'boolean', 'string'].indexOf(_prefset.getPrefType(fromName));
            if (type == -1) return false;
            let typeName = ['Long', 'Double', 'Boolean', 'String'][type];
            let value = _prefset['get' + typeName + 'Pref'](fromName);
            _prefset.deletePref(fromName);
            _prefset['set' + typeName + 'Pref'](toName, value);
            return true;
        }
        return false;
    };
    
    var oldNames = ["sciviews.ko.port", "sciviews.r.port", "sciviews.r.host", "svRDefaultInterpreter",
        "svRApplication", "svRArgs", "r.csv.dec", "r.csv.sep", "CRANMirror", "CRANMirrorSecure",
        "rRemoteHelpURL", "sciviews.margin.click",
        "RInterface.tidy.keepBlankLines", "RInterface.tidy.replaceAssign", "RInterface.tidy.newlineBeforeBrace",
        "R_extendedHelpCommand"
    ];
    
    var newNames = [];
    for (let i in this.defaults)
        if (this.defaults.hasOwnProperty(i)) newNames.push(i);
    for (let i = 0; i < newNames.length; ++i) {
        if (renamePref(oldNames[i], newNames[i]))
            logger.info("Updated preference name from " + oldNames[i] + " to " + newNames[i]);
    }

    //// Set default preferences
    this.setDefaults = function sv_checkAllPref(revert) {
        let val, rev, hasPref;
        for (let i in _this.defaults)
            if (_this.defaults.hasOwnProperty(i)) {
                hasPref = _prefset.hasPref(i);
                val = hasPref ? _this.getPref(i) : null;
                rev = revert || (typeof val == "number" && isNaN(val)) ||
                    val == "None";
                //|| (_this.defaults[i] !== '' && val === '');
                _this.setPref(i, _this.defaults[i], rev);
            }
    };

    this.getPref = function (prefName, defaultValue) {
        var ret, typeName, type;
        if (_prefset.hasPref(prefName)) {
            type = ['long', 'double', 'boolean', 'string']
                .indexOf(_prefset.getPrefType(prefName));
            if (type == -1) return undefined;
            typeName = ['Long', 'Double', 'Boolean', 'String'][type];
            ret = _prefset['get' + typeName + 'Pref'](prefName);
        } else ret = defaultValue;
        return ret;
    };

    this.setPref = function (prefName, value, overwrite, asInt) {
        var typeName, type;
        if (_prefset.hasPref(prefName)) {
            if (overwrite === false) return '';
            type = _prefset.getPrefType(prefName);

        } else {
            type = typeof value;
            if (type == 'number') type = asInt ? "long" : "double";
        }
        type = ['double', 'long', 'boolean', 'string'].indexOf(type);
        if (type == -1 || type == null)
            return undefined;
        typeName = ['Double', 'Long', 'Boolean', 'String'][type];
        _prefset['set' + typeName + 'Pref'](prefName, value);
        return typeName;
    };

    this.deletePref = function (prefName) {
        _prefset.deletePref(prefName);
        return _prefset.hasPref(prefName);
    };

}).apply(sv.pref);
