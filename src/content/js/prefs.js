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

    // exists =
    // "convert" (overwrite + convert value) 
    // "replace" (overwrite + convert preference)
    // "omit" (no overwrite)
    // "fix" (overwrite if wrong type)
    this.setPref = function (prefName, value, exists = "convert", asInteger = false) {
        var typeName, prefType = null, valueType = typeof value;
        if (valueType == 'number') valueType = asInteger ? "long" : "double";
        //console.log("prefName=", prefName);
        if (_prefset.hasPref(prefName)) {
            if (exists == "omit") return '';
            prefType = _prefset.getPrefType(prefName);
            
            if(prefType != valueType) {
                if(exists != "convert") {
                    _prefset.deletePref(prefName);
                     prefType = valueType;
                }
            } else if(exists == "fix") // correct type
                return '';
        } else 
            prefType = valueType;
            
        //console.log("prefType=", prefType, " valueType=", valueType);
        let typeIndex = ['double', 'long', 'boolean', 'string'].indexOf(prefType);
        if (typeIndex === -1 || typeIndex === null)
            return undefined;
        typeName = ['Double', 'Long', 'Boolean', 'String'][typeIndex];
        _prefset['set' + typeName + 'Pref'](prefName, value);
        return typeName;
    };

    this.deletePref = function (prefName) {
        _prefset.deletePref(prefName);
        return _prefset.hasPref(prefName);
    };
    
    // Set default preferences
    this.setDefaults = function (revert) {
        let val, hasPref;
        for (let i in _this.defaults)
            if (_this.defaults.hasOwnProperty(i)) {
                hasPref = _prefset.hasPref(i);
                val = hasPref ? _this.getPref(i) : null;
                let valType = typeof val;
                let rev = revert || (valType == "number" && isNaN(val)) || val == "None";
                _this.setPref(i, _this.defaults[i], rev ? "replace" : "fix", valType == "number" && Number.isInteger(_this.defaults[i]));
            }
    };
    

}).apply(sv.pref);
