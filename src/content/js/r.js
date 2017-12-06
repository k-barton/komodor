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
/* globals sv, ko, window, require, navigator, setTimeout */


if (typeof sv.r == "undefined")
    sv.r = {
        RMinVersion: "3.0.0", // Minimum version of R required
        sep: ";;", // Separator used for items
        get isRunning() sv.command.isRRunning // Indicate if R is currently running
    };

// from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries
if (!Object.entries)
    Object.entries = function (obj) {
        var ownProps = Object.keys(obj),
            i = ownProps.length,
            resArray = new Array(i); // preallocate the Array
        while (i--) resArray[i] = [ownProps[i], obj[ownProps[i]]];
        return resArray;
    };

(function () {

    var _this = this;
    var logger = require("ko/logging").getLogger("komodoR");

    // Evaluate R expression and call callback function in Komodo with the result as
    // first argument. All additional arguments will be passed to callback
    this.evalAsync = function ( /*cmd*/ ) {
        // TODO try FUNCTION.bind(this, args...));

        var args = Array.apply(null, arguments);
        args.splice(2, 0, true, false);
        sv.rconn.evalAsync.apply(sv.rconn, args);
    };

    this.eval = function (cmd) sv.rconn.evalAsync.call(sv.rconn, cmd);

    // XXX: remove in favour of sv.r.eval(cmd, hidden)
    this.evalHidden = function (cmd)
    sv.rconn.evalAsync.call(sv.rconn, cmd, null, true);

    this.escape = function (cmd) sv.rconn.escape(cmd);

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
        var getDirFromR = "";

        if (!dir || (sv.file.exists(dir) == 2)) { // Not there or unspecified
            switch (type) {
            case "this":
                break;
            case "current":
                getDirFromR = "getwd()";
                ask = true; // Assume ask is always true in this case
                break;
            case "file":
                var view = ko.views.manager.currentView;
                if (view) {
                    view.setFocus();
                    if (!view.koDoc.isUntitled) dir = view.koDoc.file.dirName;
                } // Fallback: project directory
                break;
            case "project":
                try {
                    var file = ko.places.manager.getSelectedItem().file;
                    dir = file.isDirectory ? file.path : file.dirName;
                } catch (e) {
                    dir = sv.file.pathFromURI(ko.places.manager.currentPlace);
                }
                break;
            default:
            }
        }
        if (getDirFromR) {
            try {
                dir = sv.rconn.eval("cat(path.expand(" + getDirFromR + "))");
            } catch (e) {
                dir = "";
            }
            if (!dir) {
                sv.alert(sv.translate("Cannot retrieve directory from R." +
                    " Make sure R is running."));
                return null;
            }
            if (navigator.platform.search(/^Win/) == 0) dir = dir.replace(/\//g, '\\');
        }

        if (ask || !dir)
            dir = ko.filepicker.getFolder(dir, sv.translate("Choose working directory"));

        if (dir != null) sv.r.eval(".odir <- setwd(\"" + sv.string.addslashes(dir) + "\")");
        return dir;
    };

    // Run current selection or line buffer in R
    this.run = function () {
        try {
            var scimoz = sv._getCurrentScimoz();
            if (scimoz === null) return false;
            var text = sv.getTextRange("sel", true);
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
            if (text) return sv.rconn.evalAsync(text);
            return false;
        } catch (e) {
            return e;
        }
    };

    // Source the current buffer or some part of it
    this.pathWithCurrentViewContent = function (view, isTempFile) {
        var rval = false;
        try {
            if (!view) view = ko.views.manager.currentView;
            if (!view) return null;
            view.setFocus();
            var scimoz = view.scimoz;
            if (!scimoz) return null;
            var doc = view.koDoc;
            if (!doc) return null;
            var original = doc.file && doc.file.isLocal && !doc.isUntitled && !doc.isDirty;
            // if local document is saved, return path to the original file
            if (original) {
                rval = doc.file.path;
            } else {
                rval = sv.file.temp(doc.baseName);
                sv.file.write(rval, scimoz.text, 'utf-8', false);
            }
            if (Object.isExtensible(isTempFile))
                isTempFile.value = !original;
        } catch (e) {
            logger.exception(e, "pathWithCurrentViewContent");
            return null;
        }
        return rval;
    };

    // Source the current buffer or some part of it
    this.source = function (what) {
        var rval = false;
        try {
            var scimoz = sv._getCurrentScimoz();
            if (scimoz === null) return false;
            var view = ko.views.manager.currentView;
            if (!view) return false;
            var doc = view.koDoc;
            if (!doc) return false;

            var cmd, path, isTmp, comment = "";
            if (!what || what == "all") {
                let isTempFile = {};
                path = _this.pathWithCurrentViewContent(view, isTempFile);
                if (path === null) return false;
                isTmp = isTempFile.value;
            } else {
                // Save all or part in the temporary file and source that file.
                // After executing, tell R to delete it.

                isTmp = true;

                var os = Cc['@activestate.com/koOs;1'].getService(Ci.koIOs);
                let fileName = os.path.withoutExtension(doc.baseName) + "_" + what;
                let content = sv.getTextRange(what);
                let description = '';
                if (what == "function") {
                    let rx = /(([`'"])(.+)\2|([\w\u0100-\uFFFF\.]+))(?=\s*<-\s*function)/;
                    let match = content.match(rx);
                    let funcName = (match ? match[3] || match[4] : '');
                    //.replace(/^(['"`])(.*)\1/, "$2")
                    fileName += "_" + funcName;
                    description = 'function `' + funcName + '`';
                } else {
                    let descr = {
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
                    description = descr[what];
                }
                fileName = fileName.replace(/[\/\\:\^\&\%\@\?"'\[\]\{\}\|\*]/g, "").replace(/[\._]+/g,
                        "_") +
                    os.path.getExtension(doc.baseName);
                path = sv.file.temp(fileName);
                sv.file.write(path, content + "\n", 'utf-8', false);
                comment = "## Source code: " + description + "\n";
            }
            var pathEsc = sv.string.addslashes(path);
            if (isTmp) {
                cmd = comment +
                    'kor::sourceTemp("' + pathEsc + '", encoding="utf-8")';
            } else {
                cmd = comment + 'base::source("' + pathEsc + '", encoding="' + view.encoding + '")';
            }

            rval = _this.eval(cmd);

        } catch (e) {
            logger.exception(e, "while sourcing R code");
        }
        return rval;
    };

    // Send whole or a part of the current buffer to R and place cursor at next line
    this.send = function (what = "all") {
        let scimoz = sv._getCurrentScimoz();
        if (!scimoz) return;

        try {
            let cmd = sv.string.trim(sv.getTextRange(what, what.indexOf("sel") === -1), "right");
            if (cmd) sv.rconn.evalAsync(cmd);

            if (what == "line" || what == "linetoend") // || what == "para"
                scimoz.charRight();
        } catch (e) {
            logger.exception(e, "");
         }
        return;
    };

    this.rFn = name => "kor::" + name;

    // Get help in R (HTML format)
    function _getHelpURI(topic, pkg) {
        var quote = function (str)
        '"' + str + '"';
        var res = "";
        if (pkg === true) {
            pkg = 'NA';
        } else if (pkg != undefined) {
            if (typeof pkg == "string")
                pkg = quote(pkg);
            else if (pkg.map != undefined)
                pkg = "c(" + pkg.map(quote).join(", ") + ")";
            else pkg = "NULL";
        } else pkg = "NULL";
        var cmd = "";
        cmd += topic ? ' topic=' + quote(topic) + ',' : "";
        cmd += pkg ? ' package=' + pkg + '' : "";
        cmd = 'cat(kor::getHelpURL(' + cmd + '), "\\f\\f")';
        try {
            res = sv.rconn.eval(cmd);
        } catch (e) {
            return null;
        }

        //res = res.split(/[\n\r\f]/, 1)[0];
        res = res.substr(0, res.search(/\f+/) - 1);
        if (res.indexOf("http") == 0) return res;
        return null;
    }

    var _lastHelpTopic = {
        topic: "",
        found: null
    };

    // TODO: - open main page if second time topic is ""
    //       - handle 'package::function' topic
    this.getHelp = function (topic) {
        var result, cmdPackage = null;
        if (_lastHelpTopic.topic == topic) {
            cmdPackage = _lastHelpTopic.found ? null : true;
        } else _lastHelpTopic.topic = topic;
        result = _getHelpURI(topic, cmdPackage);

        if (cmdPackage === true && result == null) {
            result = false;
        }
        _lastHelpTopic.found = result != null;
        return result;
    };

    this.help = function (topic) {
        if (!topic) topic = sv.getTextRange("word");
        topic = topic.toString().trim();
        if (topic === "") {
            sv.addNotification(sv.translate("Selection is empty"));
            return null;
        }
        var helpURI = this.getHelp(topic);
        if (helpURI == null) return false;
        sv.command.openHelp(helpURI);
        return true;
    };

    // Run the example for selected item
    this.example = function (topic = "") {
        var res = false;
        if (topic == "")
            topic = sv.getTextRange("word");
        if (topic == "") {
            sv.addNotification(sv.translate("Selection is empty"));
        } else {
            res = _this.eval("example(" + topic + ")");
            sv.addNotification(sv.translate("R example run for \"%S\"", topic));
        }
        return res;
    };

    // Display some text from a file
    this.pager = function (file, title, cleanUp = true) {
        var rSearchURI = "chrome://komodor/content/rsearch.html";
        var content = sv.file.read(file);
        content = content.replace(/([\w\.\-]+)::([\w\.\-\[]+)/ig,
            '<a href="' + rSearchURI + '?$1::$2">$1::$2</a>');
        content = "<pre id=\"rPagerTextContent\" title=\"" + title + "\">" +
            content + "</div>";
        //var charset = sv.socket.charset;
        sv.file.write(file, content, 'utf-8');
        sv.command.openHelp(rSearchURI + "?file:" + file);
        if (cleanUp)
            window.setTimeout(file => {
                try {
                    sv.file.getLocalFile(file).remove(false);
                } catch (e) {}
            }, 10000, file);
    };

    // Search R help for topic
    this.search = function (topic) {
        topic = sv.string.trim(topic);
        if (topic === "") return;
        sv.rconn.evalAsync('utils::help.search("' + sv.string.addslashes(topic) + '")', null,
            true, false);
    };

    // Quit R (ask to save in save in not defined)
    this.quit = function (save) {
        var response;
        if (typeof (save) === "undefined") {
            // Ask for saving or not
            response = ko.dialogs.customButtons("Do you want to save the" +
                " workspace and the command history in" +
                " the working directory first?", ["Yes", "No", "Cancel"], "No",
                null, "Exiting R");
            if (response == "Cancel") return;
        } else response = save ? "yes" : "no";

        _this.evalHidden('base::q("' + response.toLowerCase() + '")');
        // Clear the objects browser
        sv.rbrowser.clearPackageList();
        setTimeout(() => sv.command.setRStatus(sv.rconn.isRConnectionUp(false)),
            1000);
    };

    this.saveDataFrame = function _saveDataFrame(name, fileName, objName,
        dec = sv.pref.getPref("RInterface.CSVDecimalSep"),
        sep = sv.pref.getPref("RInterface.CSVSep")) {

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

            let dir = sv.command.getCwd(true);
            let oFilterIdx = {
                value: filterIndex
            };
            fileName = sv.fileOpen(dir, objName, "", ["Comma separated values (*.csv)|*.csv",
                "Tab delimited (*.txt)|*.txt",
                "Whitespace delimited values (*.txt)|*.txt"
            ], false, true, oFilterIdx);
            sep = [",", "\\t", " "][oFilterIdx.value];
            if (dec == "," && sep == ",") dec = ";";
        }

        var cmd = 'write.table(' + name + ', file="' +
            sv.string.addslashes(fileName) +
            '", dec="' + dec + '", sep="' + sep + '", col.names=NA)';
        sv.r.eval(cmd);
        return cmd;
    };

    this.arg = function r_arg(...args) {
        return args.map((a) => {
            switch (typeof a) {
            case "object":
                let rval;
                if (Array.isArray(a))
                    rval = a.map(b => r_arg(b));
                else if (a === null)
                    return "NULL";
                else {
                    let entries = Object.entries(a),
                        i = 0;
                    rval = new Array(entries.length);
                    for (let [key, value] of entries) rval[i++] =
                        `${sv.string.addslashes(key)}=${r_arg(value)}`;
                }
                return "c(" + rval.join(", ") + ")";
            case "boolean":
                return a ? "TRUE" : "FALSE";
            case "number":
                if(!isFinite(a)) {
                    if (isNaN(a)) return "NaN";
                    return (a < 0) ? "-Inf" : "Inf";
                }
                return a.toString();
            case "string":
                return "\"" + sv.string.addslashes(a) + "\"";
            default:
            }
        });
    };

    this.formatRCodeInView = function () {
        var view = ko.views.manager.currentView;
        if (!view) return;
        var pkgName = "formatR";

        sv.r.isPackageInstalled(pkgName, (yes) => {
            if (yes) 
                _this.doFormatCode(view);
            else {
                if (ko.dialogs.yesNo(
                        "R package \"" + pkgName +
                        "\" is not installed. Would you like to install it now from CRAN?",
                        null, null, "R Interface") == "Yes") {
                    sv.r.installPackage(pkgName, (isInstalled) => {
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

    this.doFormatCode = function (view) {
        if (!view) return;
        var scimoz = view.scimoz; /* var not let */
        let inFile, firstLine = 0;
        var isTmp = true;
        var extent, encoding;
        if (scimoz.selectionEmpty) {
            extent = null;
            let isTempFile = {};
            inFile = sv.r.pathWithCurrentViewContent(view, isTempFile);
            isTmp = isTempFile.value;
            encoding = isTmp ? "UTF-8" : view.koDoc.encoding.short_encoding_name;
        } else {
            extent = {
                start: scimoz.positionFromLine(scimoz.lineFromPosition(scimoz.selectionStart)),
                end: scimoz.getLineEndPosition(scimoz.lineFromPosition(scimoz.selectionEnd))
            };
            let content = scimoz.getTextRange(extent.start, extent.end); // scimoz.selText;
            inFile = sv.file.temp("kor_tidyin");
            sv.file.write(inFile, content, 'utf-8');
            firstLine = scimoz.lineFromPosition(extent.start);
            encoding = "UTF-8";
        }

        // baseIndentation is in character units
        var baseIndentation = scimoz.getLineIndentation(firstLine); /* var not let */
        var outFile = sv.file.temp("kor_tidyout");

        let formatOpt = {
            keepBlankLines: true,
            replaceAssign: false,
            newlineBeforeBrace: false, //indentBy: view.koDoc.indentWidth
            indentBy: scimoz.indent, //width: view.koDoc.getEffectivePrefs().getLongPref("editAutoWrapColumn") 
            width: scimoz.edgeColumn
        };
        for (let i in formatOpt)
            if (formatOpt.hasOwnProperty(i)) {
                let prefVal = sv.pref.getPref("RInterface.format." + i);
                if (prefVal !== undefined) formatOpt[i] = prefVal;
            }
        let rArg = sv.r.arg;
        let cmd =
            `kor::formatCode(${rArg(inFile)},\
blank = ${rArg(formatOpt.keepBlankLines)}, arrow = ${rArg(formatOpt.replaceAssign)}, \
brace.newline = ${rArg(formatOpt.newlineBeforeBrace)}, indent = ${formatOpt.indentBy}, \
width.cutoff = ${formatOpt.width}, file = ${rArg(outFile)}, encoding = "${encoding}")`;

        sv.rconn.evalAsync(cmd, (result) => {
            if (!scimoz) return;
            if (parseInt(result) == 0) {
                sv.addNotification("R code not formatted because it contains syntax errors.", "R-formatter");
                return;
            }
        
            let code;
            try {
                code = sv.file.read(outFile, 'utf-8');
                let fout = sv.file.getLocalFile(outFile);
                if (fout.exists()) fout.remove(false);
                if (isTmp) {
                    let fin = sv.file.getLocalFile(inFile);
                    if (fin.exists()) fin.remove(false);
                }
            } catch (e) {
                logger.exception(e, "reading formatted R code from " + outFile);
                return;
            }
            if (!code) return;
            // SC_EOL_CRLF (0), SC_EOL_CR (1), or SC_EOL_LF (2)
            let eolChar = sv.eOLChar(scimoz);
            code = code.replace(/(\r?\n|\r)/g, eolChar);

            if (extent === null) {
                scimoz.targetWholeDocument();
                scimoz.replaceTarget(code);
            } else {
                if (baseIndentation > 0) {
                    // TODO: if selection does not start at first column...
                    let nSpaces, nTabs;
                    if (scimoz.useTabs) {
                        nTabs = Math.floor(baseIndentation / scimoz.tabWidth);
                        nSpaces = baseIndentation % scimoz.tabWidth;
                    } else
                        nSpaces = baseIndentation;
                    let rx = new RegExp("(^|" + eolChar + ")", "g");
                    code = code.replace(rx, "$1" + "\t".repeat(nTabs) + " ".repeat(
                        nSpaces));
                }
                scimoz.targetStart = extent.start;
                scimoz.targetEnd = extent.end;
                scimoz.replaceTarget(code);
                scimoz.selectionStart = scimoz.targetStart;
                scimoz.selectionEnd = scimoz.targetEnd;
            }
            sv.addNotification("R code formatted", "R-formatter");
        }, true, true);
    }; // end doFormatCode

    this.installPackage = function (pkgName, callback) {
        if (!_this.isRunning) {
            callback(undefined);
            return;
        }
        sv.rconn.evalAsync(`utils::install.packages("${pkgName}")`,
            () => sv.r.isPackageInstalled(pkgName, callback), false);
    };

    this.isPackageInstalled = function (pkgName, callback) {
        // TODO use system command R CMD --slave --vanilla -e "find.package(...)"
        if (!_this.isRunning) {
            callback(undefined);
            return;
        }
        sv.rconn.evalAsync("kor::isInstalledPkg(\"" + pkgName + "\")", (result) => {
            callback(parseInt(result) > 0);
        }, true, true);
    };

}).apply(sv.r);