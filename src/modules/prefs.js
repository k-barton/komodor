/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *  Copyright (c) 2011-2017 Kamil Barton
 *  
 *  This code is based on SciViews-K code:
 *  Copyright (c) 2008-2011, Ph. Grosjean (phgrosjean@sciviews.org) & K. Barton
 * 
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */

"use strict";

const PrefsetExt = exports.PrefsetExt = function(prefset) {
    var _prefset = prefset || require("ko/prefs");
	Object.defineProperty(this, '_prefset', {
		get() _prefset,
		enumerable: true
	  });
};

PrefsetExt.prototype = {
    // exists =
    // "convert" (overwrite + convert value) 
    // "replace" (overwrite + convert preference)
    // "omit" (no overwrite)
    // "fix" (overwrite if wrong type),
    setPref(prefName, value, exists = "convert", asInteger = false) {
        var typeName, prefType = null, valueType = typeof value;
        if (valueType === 'number') valueType = asInteger ? "long" : "double";
        if (this._prefset.hasPref(prefName)) {
            if (exists === "omit") return '';
            prefType = this._prefset.getPrefType(prefName);

            if (prefType !== valueType) {
                if (exists !== "convert") { // fix | replace
                    this._prefset.deletePref(prefName);
                    prefType = valueType;
                }
            } else if (exists === "fix") // correct type
                return '';
        } else
            prefType = valueType;

        //console.log("prefType=", prefType, " valueType=", valueType);
        let typeIndex = ['double', 'long', 'boolean', 'string'].indexOf(prefType);
        if (typeIndex === -1 || typeIndex === null)
            return undefined;
        typeName = ['Double', 'Long', 'Boolean', 'String'][typeIndex];
        this._prefset['set' + typeName + 'Pref'](prefName, value);
        return typeName;
    },
    getPref(prefName, defaultValue) {
        var ret, typeName, type;
        if (this._prefset.hasPref(prefName)) {
            type = ['long', 'double', 'boolean', 'string']
                .indexOf(this._prefset.getPrefType(prefName));
            if (type === -1) return undefined;
            typeName = ['Long', 'Double', 'Boolean', 'String'][type];
            ret = this._prefset['get' + typeName + 'Pref'](prefName);
        } else ret = defaultValue;
        return ret;
    },
    deletePref(prefName) {
        this._prefset.deletePref(prefName);
        return this._prefset.hasPref(prefName);
    },
    setDefaults(revert, defaults) {
        let keys = Object.keys(defaults);
        let val, isInteger, ifExists = revert ? "replace" : "fix";
        for (let i = 0; i < keys.length; ++i) {
            isInteger = typeof val === "number" && Number.isInteger(defaults[keys[i]]);
            this.setPref(keys[i], defaults[keys[i]], ifExists, isInteger);
        }
    },
    renamePref(fromName, toName) {
        if (fromName === toName) return false;
        if (this._prefset.hasPref(fromName) && !this._prefset.hasPref(toName)) {
            let type = ['long', 'double', 'boolean', 'string'].indexOf(this._prefset.getPrefType(fromName));
            if (type === -1) return false;
            let typeName = ['Long', 'Double', 'Boolean', 'String'][type];
            let value = this._prefset['get' + typeName + 'Pref'](fromName);
            this._prefset.deletePref(fromName);
            this._prefset['set' + typeName + 'Pref'](toName, value);
            return true;
        }
        return false;
    }
};

(function () {

    var logger = require("ko/logging").getLogger("komodoR-prefs");
    var _this = this;
    Object.defineProperty(this, 'toString', { value: () => "[object KorPrefs]",  enumerable: false});

    var _pref = new PrefsetExt();
    
    Object.defineProperties(this, { 
        prefset: { get() _pref._prefset, enumerable: true },
        setPref : { get() _pref.setPref.bind(_pref), enumerable: true },
        getPref : { get() _pref.getPref.bind(_pref), enumerable: true },
        deletePref : { get() _pref.deletePref.bind(_pref), enumerable: true },
        setDefaults : { value(revert) _pref.setDefaults.bind(_pref)(revert, _this.defaults), enumerable: true }
    }); 
    
    // when changing this, update oldNames below accordingly
    this.defaults = { 
        'RInterface.koPort': 7052,
        'RInterface.RPort': 8888,
        'RInterface.RHost': '127.0.0.1',
        'RInterface.pathToR': 'R',
        'RInterface.runRAs': '',
        'RInterface.cmdArgs': '--quiet',
        'RInterface.RCommand': '',
        'RInterface.rBrowserAutoUpdate': true,
        'RInterface.rBrowserMaxItems': 256,
        'RInterface.CSVDecimalSep': '.',
        'RInterface.CSVSep': ',',
        'CRANMirror': 'https://cran.r-project.org/',
        'CRANMirrorSecure': true,
        'RInterface.rRemoteHelpURL': 'http://finzi.psych.upenn.edu/R/', // TODO update URL
        'RInterface.marginClick': true,
        'RInterface.viewTableMaxRows': 512,
        'RInterface.viewTableCSSURI': "resource://kor-doc/viewTable.css"
    };

    this.defaults[require("kor/main").langName + "HelpCommand"] =
        'javascript:kor.r.help(\"%W\")'; // jshint ignore: line
  
    // this.reset = (prefName) => {
        // if(!prefName || !this.defaults.hasOwnProperty(prefName)) return null;
        // return this.setPref(prefName, this.defaults[prefName]);
    // };

    this.renamePrefs = function() {
        // Update preference names:
        // backward compatibility - rename old properties
        // IMPORTANT: update order to match 'defaults'!
        let oldNames = ["sciviews.ko.port", "sciviews.r.port", "sciviews.r.host", "svRDefaultInterpreter",
            "svRApplication", "svRArgs", "svRCommand", 
            null, null,
            "r.csv.dec", "r.csv.sep", "CRANMirror", "CRANMirrorSecure",
            "rRemoteHelpURL", "sciviews.margin.click",
            null, null,
            "R_extendedHelpCommand",
        ];
        let newNames = Object.keys(_this.defaults);
        for (let i = 0; i < newNames.length; ++i) {
            if (oldNames[i] && _pref.renamePref(oldNames[i], newNames[i]))
                logger.info("Updated preference name from " + oldNames[i] + " to " + newNames[i]);
        }
    };

}).apply(module.exports);
