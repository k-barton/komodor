/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  Copyright (c) 2008-2017 Kamil Barton
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */


// requires sv.array

if (typeof (sv.file) == 'undefined') sv.file = {};

(function () {
    // Default file encoding to use
    var _this = this;

    var logger = require("ko/logging").getLogger("komodoR");

    // from selfish point of view I find it more useful than latin1
    // "licentia poetica"
    this.defaultEncoding = "latin2";
    this.TYPE_DIRECTORY = 2;
    this.TYPE_FILE = 1;
    this.TYPE_NONE = 0;

    var Ci = Components.interfaces;
    var Cc = Components.classes;

    // Read a file with encoding
    this.read = function (filename, encoding) {
        if (!encoding) encoding = _this.defaultEncoding;

        var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
        var fis = Cc["@mozilla.org/network/file-input-stream;1"]
            .createInstance(Ci.nsIFileInputStream);
        var is = Cc["@mozilla.org/intl/converter-input-stream;1"]
            .createInstance(Ci.nsIConverterInputStream);

        try {
            file.initWithPath(filename);
            fis.init(file, -1, -1, 0);
            is.init(fis, encoding, 1024, 0xFFFD);

            var ret = "";
            if (is instanceof Ci.nsIUnicharLineInputStream) {
                var str = {};
                var cont;
                do {
                    cont = is.readString(4096, str);
                    ret += str.value;
                } while (cont);
            }
        } catch (e) {
            logger.exception(e, "Error while trying to read " + filename);
        } finally {
            is.close();
            fis.close();
        }
        return ret;
    }

    // Write in a file with encoding
    this.write = function (filename, content, encoding, append) {
        //if (!encoding) encoding = _this.defaultEncoding;

        append = append ? 0x10 : 0x20;

        var file, fos, os;

        var file = Cc["@mozilla.org/file/local;1"]
            .createInstance(Ci.nsILocalFile);
        var fos = Cc["@mozilla.org/network/file-output-stream;1"]
            .createInstance(Ci.nsIFileOutputStream);
        if (encoding)
            os = Cc["@mozilla.org/intl/converter-output-stream;1"]
            .createInstance(Ci.nsIConverterOutputStream);

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
            logger.exception(e, "Error in sv.file.write: while trying to write to " + filename);
        } finally {
            if (os) os.close();
            fos.close();
        }
    }

    // Checks for file existence, returns 2 for dir, 1 for file, otherwise 0
    this.exists = function (path) {
        var file = Cc["@mozilla.org/file/local;1"]
            .createInstance(Ci.nsILocalFile);
        try {
            file.initWithPath(path);
        } catch (e) {
            return _this.TYPE_NONE;
        }

        if (file.exists()) {
            if (file.isDirectory()) {
                return _this.TYPE_DIRECTORY;
            } else if (file.isFile()) {
                return _this.TYPE_FILE;
            }
        }
        return _this.TYPE_NONE;
    }

    this.exists2 = function (path) {
        var sysutils = Cc['@activestate.com/koSysUtils;1']
            .getService(Ci.koISysUtils);

        if (sysutils.IsDir(path)) return _this.TYPE_DIRECTORY;
        if (sysutils.IsFile(path)) return _this.TYPE_FILE;
        return _this.TYPE_NONE;
    }

    // Creates unique temporary file, accessible by all users; returns its name
    this.temp = function (prefix) {
        var nsIFile = Ci.nsIFile;
        var dirSvc = Cc["@mozilla.org/file/directory_service;1"]
            .getService(Ci.nsIProperties);
        var tempDir = dirSvc.get("TmpD", nsIFile)
            .path;
        var tmpfile = Cc["@mozilla.org/file/local;1"]
            .createInstance(Ci.nsILocalFile);

        if (!prefix) prefix = "svtmp";

        tmpfile.initWithPath(tempDir);
        tmpfile.append(prefix)
        tmpfile.createUnique(nsIFile.NORMAL_FILE_TYPE, 511 /*0777*/ );

        return tmpfile.path;
    }

    this.specDir = function (dirName) {
        var file;
        if (dirName == "~")
            dirName = (navigator.platform.indexOf("Win") == 0) ? "Pers" : "Home";

        try {
            try {
                file = Cc["@mozilla.org/file/directory_service;1"]
                    .getService(Ci.nsIProperties)
                    .get(dirName, Ci.nsILocalFile)
                    .path;
            } catch (e) {
                // if above fails, try Komodo directories too:
                var dirs = Cc['@activestate.com/koDirs;1']
                    .getService(Ci.koIDirs);
                if (dirs.propertyIsEnumerable(dirName))
                    file = dirs[dirName];
            }

        } catch (e) {}
        return file ? file : dirName;
    }

    // Create nsILocalFile object from path
    // concatenates arguments if needed
    this.getLocalFile = function (path) {
        path = _this.path.apply(_this, Array.apply(null, arguments));
        var file = Cc["@mozilla.org/file/local;1"]
            .createInstance(Ci.nsILocalFile);
        file.initWithPath(path);
        return file;
    }

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
    // example: sv.file.path("~/workspace/dir1", "dir2", "file1.tmp")
    // would produce something like that:
    // "c:\users\bob\MyDocuments\workspace\dir1\dir2\file1.tmp"
    // "/home/bob/workspace/dir1/dir2/file1.tmp"
    this.path = function (path) {
        var os = Cc['@activestate.com/koOs;1']
            .getService(Ci.koIOs);
        var sep = os.sep;
        if (typeof path.join == "undefined")
            path = Array.apply(null, arguments);
        // 'flatten' the array:
        var res = [];
        for (var i in path) res = res.concat(path[i]);
        //path = os.path.normpath(res.join(sep));
        var dir0;

        path = res.join(sep);
        if (os.name == "nt") path = path.replace(/\/+/g, sep);
        dir0 = path.split(sep, 1)[0];

        path = sv.file.specDir(dir0) + path.substring(dir0.length);
        path = os.path.abspath(os.path.normpath(path));
        return path;
    }

    this.toFileURI = function (file) {
        if (typeof file == "string") file = _this.getLocalFile(file);
        if (!file) return null;
        var io = Cc["@mozilla.org/network/io-service;1"]
            .getService(Ci.nsIIOService);
        return io.newFileURI(file).spec;
    }
	
	    // Read data from an URI
    this.pathFromURI = function (uri) {
        var fileSvc = Cc["@activestate.com/koFileService;1"]
            .getService(Ci.koIFileService);
        return fileSvc.getFileFromURI(uri).path;
    }

    // Read data from an URI
    this.readURI = function (uri) {
        var fileSvc = Cc["@activestate.com/koFileService;1"]
            .getService(Ci.koIFileService);
        var file = fileSvc.getFileFromURI(uri);
        if (file.open('r')) {
            var res = file.readfile();
            file.close();
            return res;
        }
        return undefined;
    }

    this.readURIAsync = function (uri, charset, callback, onError) {
        var NetUtil = Components.utils.import("resource://gre/modules/NetUtil.jsm").NetUtil;
        var args = Array.apply(null, arguments);
        args.splice(0, 4);
        NetUtil.asyncFetch(uri, function (istream, res) {
            if (!Components.isSuccessCode(res)) {
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
    }

    // List all files matching a given pattern in directory,
    // python interface - ~2x faster than with nsILocalFile
    this.list = function (dirname, pattern, noext) {
        var os = Cc['@activestate.com/koOs;1']
            .getService(Ci.koIOs);
        var ospath = os.path;

        if (ospath.exists(dirname) && ospath.isdir(dirname)) {
            var files = os.listdir(dirname, {});
            if (pattern) {
                var selfiles = [],
                    file;
                for (var i in files) {
                    file = files[i];
                    if (file.search(pattern) != -1) {
                        file = noext ? file.substring(0, file.lastIndexOf(".")) : file;
                        selfiles.push(file);
                    }
                }
                return selfiles;
            } else {
                if (noext) {
                    for (i in files)
                        files[i] = ospath.withoutExtension(files[i]);
                }
                return files;
            }

        } else {
            return null;
        }

        return null;
    }

    function _WhichAll(file) {
        var sysutils = Cc['@activestate.com/koSysUtils;1']
            .getService(Ci.koISysUtils);
        return sysutils.WhichAll(file, {});
    }

    if (navigator.platform.indexOf("Win") == 0) {
        this.whereIs = function (appName) {
            // add default extension for executable if none
            if (appName.search(/\.[^\.]{3}$/) == -1) appName += ".exe";

            var reg = Cc["@mozilla.org/windows-registry-key;1"]
                .createInstance(Ci.nsIWindowsRegKey);
            var key, path;

            //TODO on windows 64:
            // define these as they are not defined in nsWindowsRegKey in Komodo7 
            const WOW64_32 = 0x00000200;
            const WOW64_64 = 0x00000100;
            var isWin64 = false;
            var wowflag = 0x0;

            try {
                reg.open(reg.ROOT_KEY_LOCAL_MACHINE, "SOFTWARE\\Wow6432Node", reg.ACCESS_READ);
                isWin64 = true;
                wowflag = WOW64_64;
            } catch (e) {}

            var accMode = reg.ACCESS_READ | wowflag;

            function readVal(reg, name) reg.hasValue(name) ? reg.readStringValue(name) :
                null;

            // Special treatment for R* apps:
            if (appName.match(/^R(?:gui|term|cmd)?\.exe$/i)) {
                var ret = [],
                    ret2 = [];
                var reg2;
                reg.open(reg.ROOT_KEY_LOCAL_MACHINE, "SOFTWARE\\R-core\\R", accMode);

                /// Look for all installed paths, but default goes first
                var curVer = readVal(reg, "Current Version");
                if (curVer != null) {
                    reg2 = reg.openChild(reg.readStringValue("Current Version"), accMode);
                    ret.push(readVal(reg2, "InstallPath"));
                }

                var ver;
                for (var i = 0; i < reg.childCount; ++i) {
                    ver = reg.getChildName(i);
                    if (ver == curVer) continue;
                    reg2 = reg.openChild(ver, accMode);
                    ret.push(readVal(reg2, "InstallPath"));
                }

                ret = sv.array.unique(ret);

                if (appName.search(/\.exe$/) == -1) appName += ".exe";
                var binDir = [ /*"\\bin\\", */ "\\bin\\x64\\", "\\bin\\i386\\"];
                // from 2.12 R executables may reside also in bin/i386 directory

                for (var i in ret) {
                    for (var j in binDir) {
                        app = ret[i] + binDir[j] + appName;
                        if (_this.exists(app)) ret2.push(app);
                    }
                }
                return ret2;
            }

            key = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\" +
                appName;
            try {
                reg.open(reg.ROOT_KEY_LOCAL_MACHINE, key, accMode);
                path = reg.readStringValue("");
                return path.replace(/(^"|"$)/g, "");
            } catch (e) {
                var key = "Applications\\" + appName + "\\shell\\Open\\Command";
                try {
                    reg.open(reg.ROOT_KEY_CLASSES_ROOT, key, accMode);
                    path = reg.readStringValue("");
                    path = path.replace(/(^"+|"*\s*"%\d.*$)/g, "");
                    return path;
                } catch (e) {
                    // fallback: look for app in PATH:
                    return _WhichAll(appName);
                }
            }
            return null;
        }

    } else {
        this.whereIs = _WhichAll;
    }

    //// inspired by "getDir" function from nsExtensionManager...
    this.getDir = function (path, isFile, createFile) {
        var leaves = [],
            key = (isFile ? path.parent : path);
        while (!key.exists() || !key.isDirectory()) {
            leaves.unshift(key.leafName);
            if (!key.parent) break;
            key = key.parent;
        }

        for (var i in leaves) {
            key.append(leaves[i]);
            key.create(key.DIRECTORY_TYPE, 0777);
        }
        if (isFile) {
            key.append(path.leafName);
            if (createFile && !key.exists())
                key.create(key.NORMAL_FILE_TYPE, 0777);
        }
        return key;
    }

})
.apply(sv.file);