/* globals require, Components, module,
   OS, SysUtils, FileService, IO
*/

var fileUtils = {};

if (typeof require === "function") {
    var { Cc, Ci, Cu } = require("chrome");
    module.exports = fileUtils;
} else {
    // This is being loaded in a JS component or a JS module
    var { classes: Cc, interfaces: Ci, utils: Cu } = Components;
    this.EXPORTED_SYMBOLS = ["fileUtils"];
}

var _W = require("ko/windows").getMain();

var XPCOMUtils = Cu.import("resource://gre/modules/XPCOMUtils.jsm").XPCOMUtils;
var lazySvcGetter = XPCOMUtils.defineLazyServiceGetter.bind(XPCOMUtils);

// jshint ignore: start
lazySvcGetter(this, "OS", "@activestate.com/koOs;1", "koIOs");
lazySvcGetter(this, "SysUtils", "@activestate.com/koSysUtils;1", "koISysUtils");
lazySvcGetter(this, "FileService", "@activestate.com/koFileService;1", "koIFileService");
lazySvcGetter(this, "IO", "@mozilla.org/network/io-service;1", "nsIIOService");
// jshint ignore: end


(function () {
    "use strict";
    // Default file encoding to use
    var _this = this;
    
    const ArrX = Cu.import("resource://kor/utils.js").ArrayUtils; 
    
    this.defaultEncoding = "latin2";
    this.toString = () => "[object KorFileUtils]";

    
    Object.defineProperties(this, {
          TYPE_NONE: { value: 0, enumerable: true }, 
          TYPE_FILE: { value: 1, enumerable: true }, 
          TYPE_DIRECTORY: { value: 2, enumerable: true }
    });
    
    // Read a file with encoding
    this.read = function (filename, encoding = _this.defaultEncoding,
        position = 0, out = null) {

        var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
        var fis = Cc["@mozilla.org/network/file-input-stream;1"]
            .createInstance(Ci.nsIFileInputStream);
        var is = Cc["@mozilla.org/intl/converter-input-stream;1"]
            .createInstance(Ci.nsIConverterInputStream);

        let ret;
        try {
            file.initWithPath(filename);
            fis.init(file, -1, -1, 0);
            is.init(fis, encoding, 1024, 0xFFFD);
            
            fis.seek(fis.NS_SEEK_SET, position); /*NS_SEEK_SET = 0*/
            //fis.available()

            ret = "";
            if (is instanceof Ci.nsIUnicharLineInputStream) {
                let str = {}, cont;
                do {
                    cont = is.readString(4096, str);
                    ret += str.value;
                } while (cont !== 0);
            }
        } catch (e) {
            Cu.reportError("While trying to read \"" + filename + "\": " + e);
        } finally {
            if(out && typeof out === "object")
                out.value = fis.tell();
            is.close();
            fis.close();
        }
        return ret;
    };

    // Write in a file with encoding
    this.write = function (filename, content, encoding, append) {
        //if (!encoding) encoding = _this.defaultEncoding;

        append = append ? 0x10 : 0x20;
        var file = Cc["@mozilla.org/file/local;1"]
            .createInstance(Ci.nsILocalFile),
            fos = Cc["@mozilla.org/network/file-output-stream;1"]
            .createInstance(Ci.nsIFileOutputStream),
            os = encoding ? Cc["@mozilla.org/intl/converter-output-stream;1"]
            .createInstance(Ci.nsIConverterOutputStream) : null;
        //PR_CREATE_FILE = 0x08	PR_WRONLY 	 = 0x02
        //PR_APPEND 	 = 0x10		PR_TRUNCATE 	 = 0x20

        try {
            file.initWithPath(filename);
            fos.init(file, 0x08 | 0x02 | append, -1, 0);
            if (os) {
                os.init(fos, encoding, 0, 0x0000);
                os.writeString(content);
            } else {
                fos.write(content, content.length);
            }

        } catch (e) {
            Cu.reportError("While trying to write to \"" + filename + "\"");
            Cu.reportError(e);
        } finally {
            if (os) os.close();
            fos.close();
        }
    };

    // Checks for file existence, returns 2 for dir, 1 for file, otherwise 0
    this.exists = function (path) {
        var file = Cc["@mozilla.org/file/local;1"]
            .createInstance(Ci.nsILocalFile);
        try {
            file.initWithPath(path);
        } catch (e) {
            return _this.TYPE_NONE;
        }

        if (file.exists()) 
            if (file.isDirectory()) 
                return _this.TYPE_DIRECTORY;
            else if (file.isFile()) 
                return _this.TYPE_FILE;
        
        return _this.TYPE_NONE;
    };

    this.exists2 = function (path) {
        if (SysUtils.IsDir(path)) return _this.TYPE_DIRECTORY;
        if (SysUtils.IsFile(path)) return _this.TYPE_FILE;
        return _this.TYPE_NONE;
    };

    // Creates unique temporary file, accessible by all users; returns its name
    this.temp = function (prefix) {
        var nsIFile = Ci.nsIFile;
        var dirSvc = Cc["@mozilla.org/file/directory_service;1"]
            .getService(Ci.nsIProperties);
        var tempDir = dirSvc.get("TmpD", nsIFile)
            .path;
        var tmpfile = Cc["@mozilla.org/file/local;1"]
            .createInstance(Ci.nsILocalFile);

        if (!prefix) prefix = "~kor";

        tmpfile.initWithPath(tempDir);
        tmpfile.append(prefix);
        tmpfile.createUnique(nsIFile.NORMAL_FILE_TYPE, 511 /*0777*/ );

        return tmpfile.path;
    };

    this.specDir = function (dirName) {
        let file;
        if (dirName === "~") dirName = (OS.name === "nt") ? "Pers" : "Home";
        let koDirs = Cc['@activestate.com/koDirs;1'].getService(Ci.koIDirs);
        if (dirName in koDirs && typeof koDirs[dirName] === "string") {
            file = koDirs[dirName];
        } else {
            try {
                file = Cc["@mozilla.org/file/directory_service;1"]
                    .getService(Ci.nsIProperties)
                    .get(dirName, Ci.nsILocalFile)
                    .path;
            } catch (e) {
                return dirName;
            }
        }
        return file ? file : dirName;
    };


    // Create nsILocalFile object from path
    // concatenates arguments if needed
    this.getLocalFile = function (path) {
        path = _this.path.apply(_this, Array.apply(null, arguments));
        let file = Cc["@mozilla.org/file/local;1"]
            .createInstance(Ci.nsILocalFile);
        file.initWithPath(path);
        return file;
    };

    // Concatenate the arguments into a file path.
    // First element of a path can be a name of a special directory:
    // 	eg. "ProfD", "TmpD", "Home", "Pers", "Desk", "Progs". For all possibilities,
    //	see reference at https://developer.mozilla.org/En/Code_snippets:File_I/O
    // Additionally, Komodo paths are translated:
    //  "userDataDir", "supportDir", "hostUserDataDir", "factoryCommonDataDir",
    //  "commonDataDir, "userCacheDir", "sdkDir", "docDir", "installDir", "mozBinDir",
    //  "binDir", "pythonExe", "binDBGPDir", "perlDBGPDir" and "pythonDBGPDir".
    // Leading "~" is expanded to a path of a home directory ("My documents" on windows).
    // Following arguments can be specified as single array or string
    // example: path("~/workspace/dir1", "dir2", "file1.tmp")
    // would produce something like that:
    // "c:\users\bob\MyDocuments\workspace\dir1\dir2\file1.tmp"
    // "/home/bob/workspace/dir1/dir2/file1.tmp"
    this.path = function (...path) {
        let sep = OS.sep;
        // 'flatten' the array:
        let res = Array.concat.apply(null, path);
        path = res.join(sep);
        if (OS.name === "nt") path = path.replace(/\/+/g, sep);
        let dir0 = path.split(sep, 1)[0];

        path = this.specDir(dir0) + path.substring(dir0.length);
        path = OS.path.abspath(OS.path.normpath(path));
        return path;
    };

    this.toFileURI = function (file) {
        if (typeof file === "string") file = _this.getLocalFile(file);
        if (!file) return null;
        return IO.newFileURI(file).spec;
    };
	
    this.pathFromURI = (uri) => FileService.getFileFromURI(uri).path;

    // Read data from an URI
    this.readURI = function (uri) {
        let file = FileService.getFileFromURI(uri);
        if (file.open('r')) {
            let res = file.readfile();
            file.close();
            return res;
        }
        return undefined;
    };
    
    var isSuccessCode = (returnCode) => (returnCode & 0x80000000) === 0;

    this.readURIAsync = function (uri, charset, callback, onError) {
        var NetUtil = Cu.import("resource://gre/modules/NetUtil.jsm").NetUtil;
        var args = Array.apply(null, arguments);
        args.splice(0, 4);
        NetUtil.asyncFetch(uri, (istream, res) => {
            if (!isSuccessCode(res)) {
                if (onError) onError(res);
                return;
            }
            try {
                args.unshift(
                    NetUtil.readInputStreamToString(istream, istream.available(), {
                        charset: charset,
                        replacement: "?"
                    })
                );
            } catch (e) {
                args.unshift(undefined);
            } finally {
                istream.close();
            }
            callback.apply(null, args);
        });
    };

    // List all files matching a given pattern in directory,
    // python interface - ~2x faster than with nsILocalFile
    this.list = function (dirname, pattern, noext) {

        if (OS.path.exists(dirname) && OS.path.isdir(dirname)) {
            let files = OS.listdir(dirname, {});
            if (pattern) {
                let selfiles = [], file;
                for (let i = 0; i < files.length; ++i) {
                    file = files[i];
                    if (file.search(pattern) !== -1) {
                        file = noext ? file.substring(0, file.lastIndexOf(".")) : file;
                        selfiles.push(file);
                    }
                }
                return selfiles;
            } else 
                return noext? files.map(f => OS.path.withoutExtension(f)) : files;
        } 
        return null;
    };

    if (OS.name === "nt") {
        
        var findOnPath = (appName) => {
            var envpath = OS.getenv("PATH").split(OS.pathsep);
            return envpath.map(x => _this.path(x, appName))
                .filter(x => _this.exists2(x) === _this.TYPE_FILE);
        };
        
        this.whereIs = function (appName, pathOnly = false) {
            // add default extension for executable if none
            if (appName.search(/\.[^\.]{3}$/) === -1) appName += ".exe";
            if (pathOnly) return findOnPath(appName);
 
            var reg = Cc["@mozilla.org/windows-registry-key;1"]
                .createInstance(Ci.nsIWindowsRegKey);
            let key, path;

            //TODO on windows 64:
            // define these as they are not defined in nsWindowsRegKey in Komodo7 
            //const WOW64_32 = 0x00000200;
            const WOW64_64 = 0x00000100;
            let isWin64 = false, wowflag = 0x0;

            try {
                reg.open(reg.ROOT_KEY_LOCAL_MACHINE, "SOFTWARE\\Wow6432Node", reg.ACCESS_READ);
                isWin64 = true;
                wowflag = WOW64_64;
            } catch (e) {}

            let accMode = reg.ACCESS_READ | wowflag;
            let readVal = (reg, name) => reg.hasValue(name) ? reg.readStringValue(name) : null;

            // Special treatment for R* apps:
            if (appName.match(/^R(?:gui|term|cmd)?\.exe$/i)) {
                let ret = [], ret2 = [], reg2;
                reg.open(reg.ROOT_KEY_LOCAL_MACHINE, "SOFTWARE\\R-core\\R", accMode);

                /// Look for all installed paths, but default goes first
                let curVer = readVal(reg, "Current Version");
                if (curVer !== null) {
                    reg2 = reg.openChild(reg.readStringValue("Current Version"), accMode);
                    ret.push(readVal(reg2, "InstallPath"));
                }

                let ver;
                for (let i = 0; i < reg.childCount; ++i) {
                    ver = reg.getChildName(i);
                    if (ver == curVer) continue;
                    reg2 = reg.openChild(ver, accMode);
                    ret.push(readVal(reg2, "InstallPath"));
                }

                ret = ArrX.unique(ret);

                if (appName.search(/\.exe$/) == -1) appName += ".exe";
                let binDir = [ /*"\\bin\\", */ "\\bin\\x64\\", "\\bin\\i386\\"];
                // from 2.12 R executables may reside also in bin/i386 directory

                let app;
                for (let i = 0; i < ret.length; ++i)
                    for (let j = 0; j < binDir.length; ++j) {
                        app = ret[i] + binDir[j] + appName;
                        if (_this.exists(app)) ret2.push(app);
                    }
                return ret2;
            }

            key = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\" +
                appName;
            try {
                reg.open(reg.ROOT_KEY_LOCAL_MACHINE, key, accMode);
                path = reg.readStringValue("");
                return [ path.replace(/(^"|"$)/g, "") ];
            } catch (e) {
                let key = "Applications\\" + appName + "\\shell\\Open\\Command";
                try {
                    reg.open(reg.ROOT_KEY_CLASSES_ROOT, key, accMode);
                    path = reg.readStringValue("");
                    path = path.replace(/(^"+|"*\s*"%\d.*$)/g, "");
                    return [ path ];
                } catch (e) {
                    // fallback: look for app in PATH:
                    return findOnPath(appName);
                }
            }
            return [];
        };

    } else // non-windows
        this.whereIs = (appName) => SysUtils.WhichAll(appName, {});
        

    //// inspired by "getDir" function from nsExtensionManager...
    this.getDir = function (path, isFile, createFile) {
        let leaves = [], key = (isFile ? path.parent : path);
		// TypeError on line 376: key.exists is not a function
        while (!key.exists() || !key.isDirectory()) {
            leaves.unshift(key.leafName);
            if (!key.parent) break;
            key = key.parent;
        }

        for (let i = 0; i < leaves.length; ++i) {
            key.append(leaves[i]);
            key.create(key.DIRECTORY_TYPE, 511 /*0777*/);
        }
        if (isFile) {
            key.append(path.leafName);
            if (createFile && !key.exists())
                key.create(key.NORMAL_FILE_TYPE, 511 /*0777*/);
        }
        return key;
    };
    
}).apply(fileUtils);
