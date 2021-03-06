/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *  Copyright (c) 2015-2017 Kamil Barton
 *  
 *  This code is based on SciViews-K code:
 *  Copyright (c) 2008-2015, Ph. Grosjean (phgrosjean@sciviews.org) & K. Barton
 * 
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */
// require: rconnection,r,file,utils,command,rbrowser,string
/* globals require, Object */


// from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
if (!Object.entries)
    Object.entries = function (obj) {
        var ownProps = Object.keys(obj),
            i = ownProps.length,
            resArray = new Array(i); // preallocate the Array
        while (i--) resArray[i] = [ownProps[i], obj[ownProps[i]]];
        return resArray;
    };
    
if (!Object.values)
    Object.values = function (obj) {
    	var vals = [];
        for (var key in obj)
            if (obj.hasOwnProperty(key) && obj.propertyIsEnumerable(key))
                vals.push(obj[key]);
        return vals;
    };


(function () {
    "use strict";

    var _this = this;
    var logger = require("ko/logging").getLogger("komodoR");

    const su = require("kor/utils").str, fu = require("kor/fileutils"),
		rConn = require("kor/connector"), ui = require("kor/ui"),
		korCommand = require("kor/main").command;
   
    var _w = require("ko/windows").getMain();
    var ko = _w.ko;
    
    var { Cc, Ci, Cu } = require("chrome");
    var XPCOMUtils = Cu.import("resource://gre/modules/XPCOMUtils.jsm").XPCOMUtils;
    var lazySvcGetter = XPCOMUtils.defineLazyServiceGetter.bind(XPCOMUtils);
    
    var svc = {};
    lazySvcGetter(svc, "OS", "@activestate.com/koOs;1", "koIOs");
    
    var widthPrefix = () => "\x05\x12" + require("kor/cmdout").width + ";";
    // this.widthPrefix = widthPrefix;
    
    // const userCommandId = rConn.userCommandId;
    const userCommandId = "usercommand2";
    
    rConn.defineResultHandler(userCommandId, null, rConn.AUTOUPDATE);
    
    this.evalUserCmd = function (cmd) {
        rConn.evalAsync.call(rConn, widthPrefix() + cmd, userCommandId,
            rConn.AUTOUPDATE | rConn.REALTIME);
    };
    
    this.nonDetachable = new Set([".GlobalEnv", "package:kor", "package:utils", 
		"package:base", "Autoloads"]); 

    // this.escape = function (cmd) rConn.escape(cmd);
    
    this.escape = function () rConn.evalAsync.call(rConn, "\x05\x11", userCommandId);

    // Set the current working directory (to current buffer dir, or ask for it)
    this.setwd = function (dir, ask, type) {
        // for compatibility with previous versions
        switch (arguments.length) {
        case 1:
            type = dir;
            dir = null;
            ask = false;
            break;
        case 2:
            type = dir;
            dir = null;
            break;
        default:
        }
        let getDirFromR = "";

        if (!dir || fu.exists(dir) === fu.TYPE_DIRECTORY) { // Not there or unspecified
            switch (type) {
            case "this":
                break;
            case "current":
                getDirFromR = "base::getwd()";
                ask = true; // Assume 'ask' is always true in this case
                break;
            case "file":
                var view = require("ko/views").current();
                if (view) {
                    view.scintilla.focus();
                    if (!view.koDoc.isUntitled) dir = view.koDoc.file.dirName;
                } // Fallback: project directory
                break;
            case "project":
                try {
                    let file = ko.places.manager.getSelectedItem().file;
                    dir = file.isDirectory ? file.path : file.dirName;
                } catch (e) {
                    dir = fu.pathFromURI(ko.places.manager.currentPlace);
                }
                break;
            default:
            }
        }
        if (getDirFromR) {
            try {
                dir = rConn.eval("base::cat(base::path.expand(" + getDirFromR + "))");
            } catch (e) {
                dir = "";
            }
            if (!dir) {
                ui.addNotification("Cannot retrieve directory from R.");
                return null;
            }
            dir = svc.OS.path.normpath(dir);
        }

        if (ask || !dir)
            dir = ko.filepicker.getFolder(dir, ui.translate("Choose working directory"));

        if (dir != null) rConn.evalAsync("base::setwd(" + _this.arg(dir) + ")", null, true);
        return dir;
    };

    // Run current selection or line buffer in R
    this.run = function () {
        try {
            var scimoz = ui.getCurrentScimoz();
            if (scimoz === null) return false;
            var text = ui.getTextRangeWithBrowseCode("sel", true);
            if (!text) { // No selection
                var currentLine = scimoz.lineFromPosition(scimoz.currentPos);
                var oText = {
                    value: ''
                };
                var lineCount = scimoz.lineCount;
                while (currentLine < lineCount && !(text = oText.value.trim()))
                    scimoz.getLine(currentLine++, oText);
                scimoz.gotoLine(currentLine);
                text = oText.value.trim();
            }
            if (text) return _this.evalUserCmd(text);
            return false;
        } catch (e) {
            return e;
        }
    };

	var sourceDescr = {
		"sel": "selection",
		"word": "word under cursor",
		"block": "bookmark delimited block",
		"para": "current paragraph",
		"line": "current line",
		"linetobegin": "from cursor position to the start of line",
		"linetoend": "from cursor position to the end of line",
		"end": "from cursor position to the end of file",
		"codefrag": "code fragment",
		"all": "whole file"
	};
	
    // Source the current buffer or some part of it
    this.source = function (what) {
        var rval = false;
        try {
            var scimoz = ui.getCurrentScimoz();
            if (scimoz === null) return false;
            var view = require("ko/views").current();
            if (!view) return false;
            var doc = view.koDoc;
            if (!doc) return false;

            var cmd, path, isTmp, comment = "";
            if (!what || what === "all") {
                let isTempFile = {};
                path = ui.pathWithCurrentViewContent(view, isTempFile);
                if (path === null) return false;
                isTmp = isTempFile.value;
            } else {
                // Save all or part in the temporary file and source that file.
                // After executing, tell R to delete it.

                isTmp = true;
				
                let fileName = svc.OS.path.withoutExtension(doc.baseName) + "_" + what;
                let content = ui.getTextRangeWithBrowseCode(what);
                let description = '';
                if (what === "function") {
                    let rx = /(([`'"])(.+)\2|([\w\u00C0-\uFFFF\.]+))(?=\s*<-\s*function)/;
                    let match = content.match(rx);
                    let funcName = (match ? match[3] || match[4] : '');
                    //.replace(/^(['"`])(.*)\1/, "$2")
                    fileName += "_" + funcName;
                    description = 'function `' + funcName + '`';
                } else 
                    description = sourceDescr[what];

                fileName = fileName.replace(/[\/\\:\^\&\%\@\?"'\[\]\{\}\|\*]/g, "")
					.replace(/[\._]+/g, "_") +
                    svc.OS.path.getExtension(doc.baseName);
                path = fu.temp(fileName);
                fu.write(path, content + "\n", 'utf-8', false);
                comment = "## Source code: " + description + "\n";
            }

            if (isTmp)
                cmd = comment + 'kor::sourceTemp(' + _this.arg(path) +
                    ', encoding="utf-8", local = kor::getEvalEnv())';
            else
                cmd = comment + 'base::source(' + _this.arg(path) + 
					', encoding="' +
                    view.koDoc.encoding.short_encoding_name.toLowerCase() +
                    '", local = kor::getEvalEnv())';

            rval = _this.evalUserCmd(cmd);

        } catch (e) {
            logger.exception(e, "while sourcing R code");
        }
        return rval;
    };

    // Send whole or a part of the current buffer to R and place cursor at next line
    this.send = function(what = "all") {
    	let scimoz = ui.getCurrentScimoz();
    	if (!scimoz) return;

    	try {
    		let cmd = ui.getTextRangeWithBrowseCode(what, !what.contains("sel")).trimRight();
    		if (cmd) _this.evalUserCmd(cmd);

    		if (what === "line" || what === "linetoend") // || what == "para"
    			scimoz.charRight();
    	} catch (e) {
    		logger.exception(e, "");
    	}
    	return;
    };

    // Get help in R (HTML format)
    function askRForHelpURL(topic, pkg) {
        let cmd = "";
        if (pkg === true) {
            pkg = 'NA'; // try.all.packages
        } else if (pkg !== undefined) {
            pkg = _this.arg(pkg);
        } else pkg = _this.arg(null);
        cmd = 'base::cat(kor::getHelpURL(' +
            (topic ? 'topic=' + _this.arg(topic) + "," : "") + 
            (pkg ? 'package=' + pkg + '' : "") +
            '), "<[end-of-result]>")';
            
        return new Promise((resolve, reject) => {
                rConn.evalAsync(cmd, (result) => {
                    result = result.substr(0, result.indexOf("<[end-of-result]>") - 1);
                    if (!result.startsWith("http")) result = null;
                    resolve(result);
                }, true);
                });
    }

    var _lastHelpTopic = {
        topic: "",
        found: null
    };

    this.help = function (topic = ui.getTextRange("word")) {
        topic = topic.toString().trim();
        if (topic === "") {
            ui.addNotification(ui.translate("Selection is empty"));
            return;
        }
        let cmdPackage = null;
        if (_lastHelpTopic.topic === topic)
            cmdPackage = _lastHelpTopic.found ? null : true;
        else _lastHelpTopic.topic = topic;
            
        askRForHelpURL(topic, cmdPackage).then((helpURI) => {
            if (cmdPackage === true && helpURI === null)
                helpURI = false;
            _lastHelpTopic.found = helpURI !== null;
            if (helpURI === null) return;
            logger.debug("r.help: helpURI=" + helpURI);
            korCommand.openHelp(helpURI);
        }).catch((e) => logger.exception(e));
    };

    // Run the example for selected item
    this.example = function (topic = "") {
        var res = false;
        if (!topic)
            topic = ui.getTextRange("word");
        if (topic === "") {
            ui.addNotification(ui.translate("Selection is empty"));
        } else {
            res = _this.evalUserCmd("utils::example(" + _this.arg(topic) + ")");
            //ui.addNotification(ui.translate("R example run for \"%S\"", topic));
        }
        return res;
    };

    this.endBrowse = function() {
        rConn.evalAsync("kor::koBrowseEnd()", (data) => {
            ui.addNotification("R: " + data.trim());
            }, rConn.AUTOUPDATE);
    };
    
    this.detach = function(names) {
        if (!Array.isArray(names)) names = [names];
        names = names.filter(x => !_this.nonDetachable.has(x));
        if(names.length == 0) return;
        var cmd = "kor::doCommand(\"detach\", " + _this.arg(names) + ")";
        rConn.evalAsync(cmd, (data) => {
                var re = /^<(error|success):(.*)>\s*$/gm, result, res = { error: [], success: [] }, msg = "R: ";
                while ((result = re.exec(data))) res[result[1]].push(result[2]);
                if (res.error.length !== 0)
                    msg += res.error.map(x => '"' + x + '"').join(", ") + " could not be detached.\n";
                if (res.success.length !== 0) {
                    msg += res.success.map(x => '"' + x + '"').join(", ") + " successfully detached.\n";
                    ui.addNotification(msg);
                }
            }, rConn.HIDDEN | rConn.AUTOUPDATE);
    };
    
    /*
      demo()
    */
    
    // Display some text from a file
    this.pager = function (fileName, header, title, removeFile = true, encoding = null) {
        let file = fu.getLocalFile(fileName);
        if (!file.exists()) return;

        encoding = encoding ? encoding.toLowerCase() : "utf-8";
        let enc1 = encoding.replace(/^windows-/, "cp");
        let content = fu.read(fileName, enc1);
        if(removeFile) file.remove(false);

        let stylesheet = "chrome://komodor/skin/rpager.css";
        let html = `<?xml version="1.0" encoding="${encoding.toUpperCase()}"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head><meta charset="${encoding}" /><title>${title}</title><link href="{$stylesheet}" rel="stylesheet" type="text/css" /></head>
<body><pre id="rPagerTextContent">${content}</pre></body>
</html>`;
        
        //let os = Cc['@activestate.com/koOs;1'].getService(Ci.koIOs);
        //let htmlFileName =  os.path.withoutExtension(fileName) + ".html";
        let htmlFileName = fu.temp("rpager.html");
        fu.write(htmlFileName, html, enc1);

        korCommand.openHelp(fu.toFileURI(htmlFileName));
        
        require("sdk/timers").setTimeout(file => {
                try {
                    fu.getLocalFile(htmlFileName).remove(false);
                } catch (e) {}
            }, 10000, file);
    };

    // Search R help for topic
    this.search = function (topic) {
        topic = String(topic).trim();
        if (topic === "") return;
        rConn.evalAsync('utils::help.search(' + _this.arg(topic) + ')', null,
            true);
    };

    // Quit R (ask to save if 'save' is not defined)
    this.quit = function (save) {
        var response;
        if (typeof (save) === "undefined") {
            // Ask for saving or not
            response = ko.dialogs.customButtons("Do you want to save the" +
                " workspace and the command history in" +
                " the working directory first?", ["Yes", "No", "Cancel"], "No",
                null, "R Interface");
            if (response == "Cancel") return;
        } else response = save ? "yes" : "no";

        rConn.evalAsync('base::q(' + _this.arg(response.toLowerCase()) + ')', null, true);
        require("sdk/timers").setTimeout(
            () => korCommand.setRStatus(rConn.isRConnectionUp(false)),
            1000);
    };
    
    this.viewTable = function _viewTable(name) {
        var cssURI = require("kor/prefs")
            .getPref("RInterface.viewTableCSSURI", 
            "resource://kor-doc/viewTable.css");
        //fu.pathFromURI(uri) == uri
        
        var maxRows = require("kor/prefs")
            .getPref("RInterface.viewTableMaxRows", 256);
        // TODO: add kor::
        var cmd = 'view(' + name + ', cssfile=' + _this.arg(cssURI) +
            ', max.rows=' + _this.arg(maxRows) + ')';
        rConn.evalAsync(cmd);
        return cmd;
    };
    
    this.saveDataFrame = function _saveDataFrame(name, fileName, objName,
        dec = require("ko/prefs").getStringPref("RInterface.CSVDecimalSep"),
        sep = require("ko/prefs").getStringPref("RInterface.CSVSep")) {

        if (!fileName) {
            let filterIndex;
            switch (sep) {
            case '\\t':
                filterIndex = 1;
                break;
            case ';':
            case ',':
                filterIndex = 0;
                break;
            case ' ':
                filterIndex = 2;
                break;
            default:
                filterIndex = 3;
            }

            let dir = korCommand.getCwd(true);
            let oFilterIdx = {
                value: filterIndex
            };
            fileName = ui.browseForFile(dir, objName, "", [
                "Comma separated values (*.csv)|*.csv",
                "Tab delimited (*.txt)|*.txt",
                "Whitespace delimited values (*.txt)|*.txt"
            ], false, true, oFilterIdx);
            sep = [",", "\\t", " "][oFilterIdx.value];
            if (dec === "," && sep === ",") dec = ";";
        }
        
        if(!fileName) return null;

        var cmd = 'utils::write.table(' + name + ', file=' +
            _this.arg(fileName) +
            ', dec=' + _this.arg(dec) + ', sep=' + _this.arg(sep) + ', col.names=NA)';
        rConn.evalAsync(cmd);
        return cmd;
    };

    this.get = function r_get(x, envir, hidden = false) {
        if (typeof envir === "string" && envir.startsWith("package:")) 
            return envir.substring(8) + (hidden ? ":::" : "::") + x;
        var pos;
        if (envir === -1) pos = ', pos=kor::getEvalEnv()';
            else if (envir === null) pos = "";
            else pos = ", pos=" + envir;
        return "base::get(" + _this.arg(x) + pos + ", inherits=FALSE)";
    };

    
    this.arg = function r_arg(...args) {
        
        return args.map((a) => {
            switch (typeof a) {
            case "object":
                let rval, named = false;
                if (Array.isArray(a)) {
                    rval = a.map(b => r_arg(b));
                } else if (a === null)
                    return "NULL";
                else {
                    let rxValidName = /^(?:\.(?:[a-zA-Z\.][a-zA-Z0-9_]*)?|[a-zA-Z][a-zA-Z0-9_]*)$/;
                    let entries = Object.entries(a), i = 0;
                    named = true;
                    rval = new Array(entries.length);
                    for (let [key, value] of entries) {
                        if(!rxValidName.test(key))
                            key = "'" + su.addslashes(key) + "'";
                        rval[i++] = `${key}=${r_arg(value)}`;
                    }
                    a = Object.values(a);
                }
                let t1 = typeof a[0];
                return !named && rval.length == 1 ? rval[0] :
                    (a.every(item => typeof item === t1) ? "c" : "list") +
                    "(" + rval.join(", ") + ")";
            case "boolean":
                return a ? "TRUE" : "FALSE";
            case "number":
                if (!isFinite(a)) {
                    if (isNaN(a)) return "NaN";
                    return (a < 0) ? "-Inf" : "Inf";
                }
                return a.toString();
            case "string":
                return "\"" + su.addslashes(a) + "\"";
            default:
            }
        });
    };
    
    // TODO key.indexOf("#") !== -1)? key + "=" : ""
    // TODO key.indexOf("!") !== -1)? args[key] : _this.arg(args[key])
    
    this.rCall = (fun, args) =>
        fun + "(" + Object.keys(args).map(key => 
            (((key.indexOf("#") === -1)? key.replace("!", '') + "=" : "") +
             ((key.indexOf("!") !== -1)? args[key] : _this.arg(args[key])))).join(", ") + ")";

    this.formatRCodeInView = function () {
        var view = require("ko/views").current();
        if (!view) return;
        var pkgName = "styler";

        _this.isPackageInstalled(pkgName, (yes) => {
            if (yes) 
                _this.doFormatCode(view);
            else {
                if (ko.dialogs.yesNo(
                        "R package \"" + pkgName +
                        "\" is not installed. Would you like to install it now from CRAN?",
                        null, null, "R Interface") == "Yes") {
                    _this.installPackage(pkgName, (isInstalled) => {
                        if (!isInstalled) {
                            ko.dialogs.alert(
                                "R failed to install \"" + pkgName +
                                "\". See \"Command Output\" for details.",
                                null, "R Interface");
                        } else 
                            _this.doFormatCode(view);
                    });
                }
            }
        });
    };
    
    this.doFormatCode = function(view) {
        if (!view) return;
        var scimoz = view.scimoz; /* var not let */
        var content, inFile, firstLine = 0,
            encoding = "UTF-8",
            baseIndentation = 0,
            extent = null;
        inFile = fu.temp("kor_tidyin.R");
        if (scimoz.selectionEmpty) {
            content = scimoz.text;
        } else {
            extent = {
                start: scimoz.positionFromLine(scimoz.lineFromPosition(
                    scimoz.selectionStart)),
                end: scimoz.getLineEndPosition(scimoz.lineFromPosition(
                    scimoz.selectionEnd))
            };
            content = scimoz.getTextRange(extent.start, extent.end); // scimoz.selText;
            // baseIndentation is in character units
            baseIndentation = scimoz.getLineIndentation(scimoz.lineFromPosition(
                extent.start)); /* var not let */
        }
        fu.write(inFile, content, 'utf-8');
        let formatOpt = {
            //replaceAssign: false,
            //newlineBeforeBrace: false, //indentBy: view.koDoc.indentWidth
            indentBy: scimoz.indent, 
            width: scimoz.edgeColumn //width: view.koDoc.getEffectivePrefs().getLongPref("editAutoWrapColumn")
        };
        for (let i in formatOpt)
            if (formatOpt.hasOwnProperty(i)) {
                let prefVal = require("kor/prefs").getPref(
                    "RInterface.format." + i);
                if (prefVal !== undefined) formatOpt[i] =
                    prefVal;
            }
        let rArg = _this.arg;
        let cmd =
            `base::cat(styler::style_file(path=${rArg(inFile)},transformers=styler::tidyverse_style(indent_by=${formatOpt.indentBy}))$changed[1L])`;

        rConn.evalAsync(cmd, (result) => {
            if (!scimoz) return;
            if (result.endsWith("NA")) {
                ui.addNotification(
                    "R code not formatted, possibly because of syntax errors.",
                    "R-formatter");
                return;
            } else if (result.endsWith("FALSE")) return;
            let code;
            try {
                code = fu.read(inFile, 'utf-8');
                let fout = fu.getLocalFile(inFile);
                if (fout.exists()) fout.remove(false);
            } catch (e) {
                logger.exception(e,
                    "reading formatted R code from " +
                    inFile);
                return;
            }
            if (!code) return; // SC_EOL_CRLF (0), SC_EOL_CR (1), or SC_EOL_LF (2)
            let eolChar = ui.eOLChar(scimoz);
            code = code.replace(/(\r?\n|\r)/g, eolChar);
            if (extent === null) {
                scimoz.targetWholeDocument();
                scimoz.replaceTarget(code);
            } else {
                if (baseIndentation > 0) { // TODO: if selection does not start at first column...
                    let nSpaces, nTabs;
                    if (scimoz.useTabs) {
                        nTabs = Math.floor(
                            baseIndentation /
                            scimoz.tabWidth);
                        nSpaces = baseIndentation %
                            scimoz.tabWidth;
                    } else nSpaces = baseIndentation;
                    let rx = new RegExp("(^|" + eolChar +
                        ")", "g");
                    code = code.replace(rx, "$1" + "\t"
                        .repeat(nTabs) + " "
                        .repeat(nSpaces));
                }
                scimoz.targetStart = extent.start;
                scimoz.targetEnd = extent.end;
                scimoz.replaceTarget(code);
                scimoz.selectionStart = scimoz.targetStart;
                scimoz.selectionEnd = scimoz.targetEnd;
            }
            ui.addNotification("R code formatted.",
                "R-formatter");
        }, rConn.HIDDEN | rConn.STDOUT);
    }; // end doFormatCode
    this.isPackageInstalled = function (pkgName, callback) {
        // TODO use system command R CMD --slave --vanilla -e "find.package(...)"
        if (!require("kor/command").isRRunning) {
            callback(undefined);
            return;
        }
        rConn.evalAsync("kor::isInstalledPkg(" + _this.arg(pkgName) + ")", (result) => {
            callback(parseInt(result) > 0);
        }, rConn.HIDDEN | rConn.STDOUT);
    };
    
    this.installPackage = function (pkgName, callback) {
        if (!require("kor/command").isRRunning) {
            callback(undefined);
            return;
        }
        rConn.evalAsync(`utils::install.packages(${_this.arg(pkgName)})`,
            () => _this.isPackageInstalled(pkgName, callback), rConn.AUTOUPDATE);
    };
	
	this.loadWorkspace = function(filePath, callback = null, pos = 2) {
        if (!require("kor/command").isRRunning) {
            callback(undefined);
            return;
        }
        rConn.evalAsync(`kor::doCommand("attach", ${_this.arg(filePath)}, ${_this.arg(pos)})`,
            callback.bind(null), rConn.AUTOUPDATE);
    };

    
}).apply(module.exports);
