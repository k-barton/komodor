// SciViews-K R functions
// Define functions to pilot R from Komodo Edit 'sv.r'
// Copyright (c) 2008-2015, Ph. Grosjean (phgrosjean@sciviews.org) & K. Barton
// License: MPL 1.1/GPL 2.0/LGPL 2.1
////////////////////////////////////////////////////////////////////////////////

if (typeof(sv.r) == 'undefined')
sv.r = {
	RMinVersion: "3.0.0",	// Minimum version of R required
	sep: ";;",				// Separator used for items
	isRunning: false        // Indicate if R is currently running
};

(function() {
	
var _this = this;

var logger = require("ko/logging").getLogger("komodoR");


// Evaluate R expression and call callback function in Komodo with the result as
// first argument. All additional arguments will be passed to callback
this.evalAsync = function(/*cmd*/) {
	var args = Array.apply(null, arguments);
	args.splice(2,  0, true, false);
	sv.rconn.evalAsync.apply(sv.rconn, args);
};

this.eval = function(cmd) sv.rconn.evalAsync.call(sv.rconn, cmd);

// XXX: remove in favour of sv.r.eval(cmd, hidden)
this.evalHidden = function(cmd)
	sv.rconn.evalAsync.call(sv.rconn, cmd, null, true);
this.escape = function (cmd) sv.rconn.escape(cmd);

// Set the current working directory (to current buffer dir, or ask for it)
this.setwd = function (dir, ask, type) {
	// for compatibility with previous versions
	switch (arguments.length) {
		case 1: type = dir; dir = null; ask = false; break;
		case 2: type = dir; dir = null; break;
		default:
	}
	var getDirFromR = "";

	if (!dir || (sv.file.exists(dir) == 2)) { // Not there or unspecified
		switch (type) {
			case "this":
				break;
			case "session":
				getDirFromR = "getOption(\"R.initdir\")";
				break;
			case "previous":
				getDirFromR = "if (exists(\".odir\")) .odir else getwd()";
				break;
			case "init":
				getDirFromR = "getOption(\"R.initdir\")";
				break;
			case "current":
				getDirFromR = "getwd()";
				ask = true;	// Assume ask is always true in this case
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
					dir = file.isDirectory? file.path : file.dirName;
				} catch(e) {
					dir = sv.file.pathFromURI(ko.places.manager.currentPlace);
				}
				break;
			default:
		}
	}
	if (getDirFromR) {
		try {
			dir = sv.rconn.eval("cat(path.expand(" + getDirFromR + "))");
		} catch(e) {
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
		if(!text) { // No selection
			var currentLine = scimoz.lineFromPosition(scimoz.currentPos);
			var oText = { value: '' };
			var lineCount =	scimoz.lineCount;
			while(currentLine < lineCount && !(text = oText.value.trim()))
				scimoz.getLine(currentLine++, oText);
			scimoz.gotoLine(currentLine);
			text = oText.value.trim();
		}
		if(text) return sv.rconn.evalAsync(text);
		return false;
	} catch(e) {
		return e;
	}
};

// Source the current buffer or some part of it
this.source = function (what) {
	var res = false;
	try {
		var scimoz = sv._getCurrentScimoz();
		if (scimoz === null) return false;
		var view = ko.views.manager.currentView;
		var doc = view.koDoc;
		var file;
		if (!doc.isUntitled && doc.file) {
			file = sv.string.addslashes(doc.file.path);
		} else {
			file = doc.baseName;
		}

		if (!what) what = "all"; // Default value

		// Special case: if "all" and local document is saved,
		// source as the original file
		if (what == "all" && doc.file && doc.file.isLocal &&
			!doc.isUntitled && !doc.isDirty) {
			res = _this.eval('source("' + file +  '", encoding = "' +
			view.encoding + '")');
		} else {
			// Save all or part in the temporary file and source that file.
			// After executing, tell R to delete it.
			var code = sv.getTextRange(what);
			if (what == "function") {
				var rx = /(([`'"])(.+)\2|([\w\u0100-\uFFFF\.]+))(?=\s*<-\s*function)/;
				var match = code.match(rx);
				what += " \"" + (match? match[3] || match[4] : '') + "\"";
				//.replace(/^(['"`])(.*)\1/, "$2")
			}
			sv.cmdout.clear();
			sv.cmdout.append(':> #source("' + file + '*") # buffer: ' + what);

			var tempFile = sv.file.temp();
			sv.file.write(tempFile, code + "\n", 'utf-8', false);
			tempFile = sv.string.addslashes(tempFile);

			var cmd = 'tryCatch(source("' + tempFile + '", encoding =' +
				' "utf-8"), finally = {unlink("' + tempFile + '")});';

			_this.evalAsync(cmd, function(ret) sv.cmdout.append(ret + "\n:>"));
		}
	} catch(e) {
		logger.error(e, " Exception thrown while sourcing R code");
	}
	return res;
};

// Send whole or a part of the current buffer to R and place cursor at next line
this.send = function (what) {
	var scimoz = sv._getCurrentScimoz();
	if (scimoz === null) return false;

	try {
		if (!what) what = "all"; // Default value

		var cmd = sv.getTextRange(what, what.indexOf("sel") == -1).rtrim();
		if (cmd) res = sv.rconn.evalAsync(cmd);

		if (what == "line" || what == "linetoend") // || what == "para"
			scimoz.charRight();

	} catch(e) { return e; }
	return res;
};

this.rFn = (name) => "base::get(\"" + name + "\", \"komodoConnection\", inherits=FALSE)";

// Get help in R (HTML format)
function _getHelpURI(topic, pkg) {
	var quote = function(str) '"' + str + '"'; 
	var res = "";
	if(pkg === true) {
		pkg = 'NA';
	} else if(pkg != undefined) {
		if(typeof pkg == "string")
			pkg =  quote(pkg);
		else if (pkg.map != undefined)
			pkg = "c(" + pkg.map(quote).join(", ") + ")";
		else pkg = "NULL";
	} else pkg = "NULL";
	var cmd = "";
	cmd += topic ? ' topic=' + quote(topic) + ',' : "";
	cmd += pkg ? ' package=' + pkg + '' : "";
	cmd = 'cat(getHelpURL(' + cmd + '), "\\f\\f")';
	try {
		res = sv.rconn.eval(cmd);
	} catch(e) {
		return null;
	}
	
	//res = res.split(/[\n\r\f]/, 1)[0];
	res = res.substr(0, res.search(/\f+/) - 1);
	if(res.indexOf("http") == 0) return res;
	return null;
}
	
var _lastHelpTopic = {topic: "", found: null};
	
// TODO: - open main page if second time topic is ""
//       - handle 'package::function' topic
this.getHelp = function (topic) {
	var result, cmdPackage = null;
	if (_lastHelpTopic.topic == topic) {
		cmdPackage = _lastHelpTopic.found? null : true;
	} else _lastHelpTopic.topic = topic;
	result = _getHelpURI(topic, cmdPackage);
	
	if(cmdPackage === true && result == null) {
		result = false;
	}
	_lastHelpTopic.found = result != null;
	return result;
};

this.help = function(topic) {
	if (topic == undefined || topic == "")
		topic = sv.getTextRange("word");
	topic = sv.string.trim(String(topic));
	if (topic == "") {
		sv.addNotification(sv.translate("Selection is empty"));
		return null;
	}
	var helpUri = this.getHelp(topic);
	if(helpUri == null) return false;
	sv.command.openHelp(helpUri);
	return true;
};	

// Run the example for selected item
this.example = function (topic) {
	var res = false;
	if (typeof(topic) == "undefined" | topic == "")
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
this.pager = function(file, title, cleanUp) {
	var rSearchURI = "chrome://komodor/content/rsearch.html";
	var content = sv.file.read(file);
	content = content.replace(/([\w\.\-]+)::([\w\.\-\[]+)/ig,
		'<a href="' + rSearchURI + '?$1::$2">$1::$2</a>');
	content = "<pre id=\"rPagerTextContent\" title=\"" + title + "\">" +
		content + "</div>";
	//var charset = sv.socket.charset;
	sv.file.write(file, content, 'utf-8');
	sv.command.openHelp(rSearchURI + "?file:" + file);
	if(cleanUp || cleanUp === undefined)
		window.setTimeout((file) => {
			try {
				sv.file.getLocalFile(file).remove(false);
			} catch(e) {
			}}, 10000, file);
};

// Search R help for topic
this.search = function (topic) {
	topic = sv.string.trim(topic);
	if(topic == "") return;
	sv.rconn.evalAsync('utils::help.search("' + sv.string.addslashes(topic) +  '")', null, 
		true, false);
};

// Quit R (ask to save in save in not defined)
this.quit = function (save) {
	var response;
	if (typeof(save) == "undefined") {
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
	setTimeout(function() sv.command.setRStatus(sv.rconn.isRConnectionUp(false)),
		1000);
};


this.saveDataFrame = function _saveDataFrame(name, fileName, objName, dec, sep) {
	if (!dec) dec = sv.pref.getPref("r.csv.dec");
	if (!sep) sep = sv.pref.getPref("r.csv.sep");

	if (!fileName) {
		var filterIndex;
		switch(sep) {
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

		var dir = sv.command.getCwd(true);

		oFilterIdx = {value : filterIndex};
		fileName = sv.fileOpen(dir, objName, "",
			["Comma separated values (*.csv)|*.csv",
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

}).apply(sv.r);


