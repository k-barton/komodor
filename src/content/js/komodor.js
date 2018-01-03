/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  This code is based on SciViews-K general functions, which are
 *  copyright (c) 2008-2010 by Ph. Grosjean (phgrosjean@sciviews.org)
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */
/* globals sv, ko, Components, window, AddonManager, Services, require, document */
sv = {
    langName: "R_extended",
    extensionId: "komodor@komodor"
};

(function () {
    var _this = this;
    var _version;

    var logger = require("ko/logging").getLogger("komodoR");

    Object.defineProperty(this, "version", {
        get: () => _version,
        enumerable: true
    });

    try {
        let AddonManager = Components.utils.import("resource://gre/modules/AddonManager.jsm").AddonManager;
        AddonManager.getAddonByID(_this.extensionId, (addon) => _version = addon.version);
    } catch (e) {
        logger.exception(e, "sv.version");
    }
    // logger.info("Assigned sv.version to " + _this._version);
}).apply(sv);
