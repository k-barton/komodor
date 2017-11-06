/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  Copyright (c) 2015-2017 Kamil Barton
 *  Copyright (c) 2009-2015 Kamil Barton & Ph. Grosjean (phgrosjean@sciviews.org)
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */

/*
 * TODO: identify packages by pos rather than name (allow for non-unique names)
 * TODO: context menu for search-paths list
 * TODO: add context menu item for environments: remove all objects
 * TODO: automatic refresh of the browser from R
 * TODO: make this a sv.robjects.tree 
[ERROR] console-logger: TypeError: treeBox is null (2) in chrome://komodor/content/js/rbrowser.js:972
 */

/* globals sv, ko, require, Components, document, self */

sv.rbrowser = {};

// Control characters + separators (make them sv-wide):
//     \x15 - connection error
//     \x03 - stderr
//     \x02 - stdout
// robjects:
//     \x1e - record separator
//     \x1f - unit separator
//     \x1d - group separator

// sv.rbrowser constructor
(function () {
	
	var logger = require("ko/logging").getLogger("komodoR");
    //logger.setLevel(logger.DEBUG);

    // FIXME: sep is also defined as sv.r.sep
    var sep = "\x1f"; // ";;"
    var recordSep = "\x1e";
    //var recordSep = "\n"; //"\x1e";
      
    var dQuote = s => "\"" + s + "\"";
		
	// id +'_' + 
	var createCommand = (env, obj, all) => 
    	"kor::write.objList(kor::objList(id=" + dQuote(sv.uid(1) + "_" + env + "_" + obj) + 
		", envir=" + (env ? dQuote(env) : "") +  
		", object=" + dQuote(obj) + ", all.info=FALSE, compare=FALSE, " + 
		"all.names=" + (all ? "TRUE" : "FALSE") + "), sep=" + dQuote(sep) + 
		    ", eol=" + dQuote(recordSep) + ")";
    

    var _listAllNames = false;
  
    var _getObjListCommand = (env, obj) => {
	    var rval = createCommand(env ? sv.string.addslashes(env) : env,
		   obj? obj.replace(/^([`"'])(.*)\1/, "$2") : "",  // WTF? replace(/\$/g, "$$$$"). 
		   _listAllNames
	    );

        logger.debug("R-browser command: \n"  + "\n" + rval);
        return rval;
    };
 


    // This should be changed if new icons are added
    var iconTypes = ['array', 'character', 'data.frame', 'Date', 'dist',
        'empty', 'factor', 'function', 'glm', 'htest', 'integer', 'list',
        'lm', 'lme', 'logical', 'matrix', 'nls', 'numeric', 'object', 'objects',
        'package', 'standardGeneric', 'S3', 'S4', 'ts', 'environment',
        'formula'
    ];

    // Used in .contextOnShow
    var nonDetachable = [".GlobalEnv", "package:kor", "package:utils",
        "package:base" ];

    // Reference to parent object for private functions
    var _this = this;
    var filterBy = 0; // Filter by name by default
    var isInitialized = false;

    this.visibleData = [];
    this.treeData = []; // Fields: Class, Dims, Full.name, Group, Name, Recursive

    this.treeBox = null;
    this.selection = null;

    var atomSvc = Components.classes["@mozilla.org/atom-service;1"]
        .getService(Components.interfaces.nsIAtomService);
        
    Object.defineProperty(this, "rowCount", {
        get: function () this.visibleData.length,
        enumerable: true
    });

    var _getVItem = function(obj, index, level, first, last, parentIndex) {
        var vItem = {};

        if (obj.group == "list" || obj.group == "function" || obj.list) {
            vItem.isContainer = true;
            vItem.isContainerEmpty = false;
            vItem.childrenLength = obj.children ? obj.children.length : 0;
            vItem.isOpen = (typeof (obj.isOpen) != "undefined") && obj.isOpen;
            vItem.isList = true;
        } else {
            vItem.isContainer = typeof (obj.children) != "undefined";
            vItem.isContainerEmpty = vItem.isContainer &&
                (obj.children.length == 0);
            vItem.childrenLength = vItem.isContainer ? obj.children.length : 0;
            vItem.isList = false;
        }
        vItem.isOpen = (typeof (obj.isOpen) != "undefined") && obj.isOpen;
        vItem.parentIndex = parentIndex;
        vItem.level = level;
        vItem.first = first;
        vItem.last = last;
        vItem.labels = [obj.name, obj.dims, obj.group, obj.class, obj.fullName];
        vItem.origItem = obj;
        vItem.origItem.index = index;
        return vItem;
    };
	
	 var _addVisibleDataItems = function addVisibleDataItems(item, parentIndex, level) {
        if (item === undefined) return parentIndex;
        if (level === undefined) level = -1;
        if (!parentIndex) parentIndex = 0;

        var idx = parentIndex;
        var len = item.length;

        for (let i = 0; i < len; ++i) {
            //item[i].class != "package" &&
            if (level == 1 && !_this.filter(item[i].sortData[filterBy])) {
                item[i].index = -1;
                continue;
            }
            ++idx;
            let vItem = _getVItem(item[i], idx, level, i == 0, i == len - 1,
                parentIndex);
            _this.visibleData[idx] = vItem;

            if (vItem.isContainer && vItem.isOpen && vItem.childrenLength > 0) {
                let idxBefore = idx;
                idx = addVisibleDataItems(item[i].children, idx, level + 1);

                // No children is visible
                if (idxBefore == idx) {
                    vItem.isContainerEmpty = true;
                }
            }
        }
        return idx;
    };
		
     var _createVisibleData = function() {
        //if (!isInitialized) throw new Error("treeData not initialized");
        if (!isInitialized) return;

        var rowsBefore = _this.visibleData.length;
        var firstVisibleRow = _this.treeBox ? _this.treeBox.getFirstVisibleRow() : 0;
        _this.visibleData = [];
  
        _addVisibleDataItems(_this.treeData, -1, 0);

        var rowsChanged = _this.visibleData.length - rowsBefore;

        if (rowsChanged) _this.treeBox.rowCountChanged(0, rowsChanged);

        if (_this.treeBox.view.rowCount > _this.visibleData.length)
            throw new Error("WTF?");

        if (firstVisibleRow < _this.visibleData.length)
            _this.treeBox.scrollToRow(firstVisibleRow);

        _this.treeBox.invalidateRange(
            _this.treeBox.getFirstVisibleRow(),
            _this.treeBox.getLastVisibleRow());
    };

    // RObjectLeaf constructor:
    function RObjectLeaf(env, obj, arr, index, parentElement) {
        var type = parentElement ? ((parentElement.type == "environment") ? 'object' :
                (parentElement.group == "function" ? "args" : "sub-object")) :
            'environment';

        var dimNumeric = 1;
        let pos = index; // XXX ????
        //this.index = index;
        this.type = type;
        if (obj) { /// Objects
            if (/^(\d+x)*\d+$/.test(arr[2]))
                dimNumeric = arr[2].split(/x/).reduce((x, y) => x * parseInt(y));
            this.name = arr[0];
            this.fullName = arr[1];
            this.dims = arr[2];
            this.group = arr[3];
            try {
                this.class = arr[4];
                this.env = env;
                this.list = (arr[5] == "TRUE");
                if (this.list) this.children = [];
                this.sortData = [this.name.toLowerCase(), dimNumeric, this.class.toLowerCase(),
                    this.group.toLowerCase(), index
                ];
            } catch (e) {
                //print(e); //DEBUG
                //print(arr);
            }
            this.parentObject = parentElement;
        } else { /// Environment
            pos = _this.searchPath.indexOf(env);
            this.name = this.fullName = env;
            this.children = [];
            this.class = "package";
            this.dims = dimNumeric = pos;
            this.sortData = [this.name.toLowerCase(), pos, this.class.toLowerCase(),
                this.type.toLowerCase()
            ];
            this.isOpen = true;
        }
    }

    RObjectLeaf.prototype = {
        name: null,
        fullName: null,
        children: undefined,
        type: "environment",
        class: "package",
        group: "",
        env: null,
        list: false,
        isOpen: false,
        dims: 0,
        sortData: [],
        index: -1,
        parentObject: this.treeData,
        //toString: function() { ret = []; for (var i in this) if(typeof this[i] != "function") ret.push(i + ":" + this[i]); return ret.join(" * "); }
        toString () {
            return this.env + "::" + this.fullName + " (" + (this.isOpen ? "+" : ".") + ")" +
                (this.isOpen ? "->" + this.children : '');
        },
        childrenLoaded: false
        //get childrenLength() this.children ? this.children.length : 0,
        //set childrenLength(x) null
    };
	
    var _objTreeCrawler = function objTreeCrawler(name, root) {
        var children = root.children;
        var n = children.length;
        for (let i = 0; i < n; ++i) {
            var fullName = children[i].fullName;
            if (fullName == name) return children[i];
            if ((name.indexOf(fullName) == 0) && ("@$[".indexOf(name[fullName.length]) != -1))
                return objTreeCrawler(name, children[i]);
        }
        return null;
    };
	

    this.getRObjTreeLeafByName = function (name, env) {
        var root = this.treeData;
        if (!root.length) return null;
        var j;
        for (j = 0; j < root.length; ++j)
            if (root[j].fullName == env)
                if (!name) return root[j];
                else break;
        if (!name) return null; // package not found, nothing to do.
        return _objTreeCrawler(name, root[j]);
    };

    _this.getRowByName = function (name, env) {
        var vd = _this.visibleData;
        var i;
        for (i = 0; i < vd.length; ++i)
            if (name == vd[i].labels[4] && env == vd[i].origItem.env) break;
        return i >= vd.length ? undefined : i;
    };

    var fullname = (vd, i) => vd[i].origItem.env + "::" + vd[i].origItem.fullName;

    // TODO: make internal
    var _storedSelection;
    this.saveSelection =
        function () {
            var idx = this.getSelectedRows();
            var vd = this.visibleData;
            _storedSelection = idx.map(i => fullname(vd, i));
        };

    this.restoreSelection =
        function () {
            if (!this.selection) return;
            this.selection.clearSelection();
            if (_storedSelection && _storedSelection.map) {
                let vd = this.visibleData;
                for (let j = 0; j < _storedSelection.length; ++j) {
                    for (let i = 0; i < vd.length; ++i) {
                        if (_storedSelection[j] == fullname(vd, i)) {
                            this.selection.toggleSelect(i);
                            break;
                        }
                    }
                }
            }
        };

    this.parseObjListResult =
        function _parseObjListResult(data, rebuild, scrollToRoot) {

            var closedPackages = {};
            var currentPackages = _this.treeData.map(x => {
                closedPackages[x.name] = !x.isOpen;
                return x.name;
            });

            if (rebuild) _this.treeData.splice(0);

            _this.saveSelection();

            var envName, objName;
            var treeBranch, lastAddedRootElement;
            data = data.trim();
            if (!data) return;
            var lines = data.split(/[\r\n]{1,2}/);

            for (let i = 0; i < lines.length; ++i) {
                if (lines[i].indexOf(sep) == -1) { // Parse list header
                    if (lines[i].indexOf("Env=") == 0) {
                        envName = lines[i].substr(4).trim();
                        if (lines[i + 1].indexOf("Obj=") != 0)
                            throw new Error("Expected 'Obj=' after 'Env='");
                        objName = lines[i + 1].substr(4).trim();
                        treeBranch = _this.getRObjTreeLeafByName(objName, envName);
                        if (!treeBranch && !objName) { // This is environment
                            treeBranch = new RObjectLeaf(envName, false);
                            _this.treeData.push(treeBranch);
                            if (currentPackages.indexOf(envName) == -1)
                                lastAddedRootElement = treeBranch;
                        }
                        if (treeBranch) {
                            //var isEmpty = (lines.length == i + 2) || (lines[i + 2].indexOf('Env') == 0);
                            if (!objName) {
                                if (closedPackages[envName]) treeBranch.isOpen = false;
                            } else treeBranch.isOpen = true;
                            treeBranch.children = [];
                            treeBranch.childrenLoaded = true;
                        }
                    }
                    i += 2; // advance to object list
                }
                if (!treeBranch) continue; // this object is missing, skip all children
                if (i >= lines.length) break;
                if (lines[i].indexOf('Env') == 0) {
                    --i;
                    continue;
                }
                try {
                    let objlist = lines[i].split(recordSep);
                    for (let k = 0; k < objlist.length; ++k) {
                        if (objlist[k].length == 0) break;
                        let leaf = new RObjectLeaf(envName, true,
                            objlist[k].split(sep), k /* or i?*/ , treeBranch);
                        treeBranch.children.push(leaf);
                    }
                } catch (e) {
                    logger.exception(e);
                }
            }

            //_this.selection.clearSelection();
            _this.sort(null, null, true); // .index'es are generated here, don't restre selection

            if (scrollToRoot && lastAddedRootElement) { //only if rebuild, move the selection
                let idx = lastAddedRootElement.index;
                if (idx != -1) {
                    //_this.treeBox.ensureRowIsVisible(idx);
                    _this.treeBox.scrollToRow(Math.min(idx, _this.rowCount - _this.treeBox.getPageLength()));
                    _this.selection.select(idx);
                }
            }

            _this.restoreSelection();

        };
		
    this.getOpenItems =
        function (asRCommand) {
            let vd = this.visibleData;
            let ret = [];
            for (let i in vd) {
                if (_this.isContainerOpen(i)) {
                    let oi = vd[i].origItem;
                    let env = oi.env || oi.fullName;
                    let objName = oi.type == "environment" ? "" : oi.fullName;
                    ret.push(asRCommand ? _getObjListCommand(env, objName) : oi.fullName);
                }
            }
            return ret;
        };

    Object.defineProperty(this, 'listAllNames', {
        get: () => _listAllNames,
        set: function (val) {
            _listAllNames = Boolean(val);
            _this.refresh(false);
        },
        enumerable: true
    });

    this._getObjListCommand = _getObjListCommand; /// XXX

    this.refresh =
        function (force) {
            _this.getPackageList();

            var cmd, init;
            init = force || !_this.treeData.length || !_this.treeBox;

            if (init) {
                _this.getPackageList();
                cmd = _this._getObjListCommand(".GlobalEnv", "");
            } else {
                let cmd1 = _this.getOpenItems(true);
                let cmd2 = _this.treeData.map(x => _getObjListCommand(x.fullName, ""));
                cmd = sv.array.unique(cmd1.concat(cmd2)).join("\n");
            }

            // Komodo9:
            // panel = ko.widgets.getWidget("rbrowser_tabpanel")
            // Komodo7+9:
            // panelWin = document.getElementById("rbrowser_tabpanel").contentWindow
            // document.getElementById("rbrowser_objects_tree").tree
            // sv.rbrowser.refresh()

            if (init) {
                let thisWindow = self;
                //if (thisWindow.location.pathname != "rbrowser_tabpanel") { // in main window
                if (thisWindow.location.pathname.indexOf("komodo.xul") != -1) { // in main window
                    thisWindow = document.getElementById("rbrowser_tabpanel").contentWindow;
                }
                thisWindow.document.getElementById("rbrowser_objects_tree").view = _this;
            }

            sv.rconn.evalAsync(cmd, _this.parseObjListResult, true);
            isInitialized = true;
        };

    // END NEW =====================================================================

    function _removeObjectList(pack) {
        for (let i = 0; i < _this.treeData.length; ++i) {
            if (_this.treeData[i].name == pack) {
                _this.treeData.splice(i, 1);
                break;
            }
        }
        _createVisibleData();
    }

    function _addObject(env, objName, callback /*, obj*/ ) {
        //sv.r.evalAsync(_getObjListCommand(env, objName), callback, obj);
        // callback is always 'parseObjListResult' so far.
        var scrollToRoot = !objName; // if no object name - we are adding a package
        // so, scroll to its item

        sv.r.evalAsync(_getObjListCommand(env, objName), callback,
            // args for callback:
            false, scrollToRoot);
    }

    // New: allow for filtering by exclusion: prepend with "~"
    function _getFilter() {
        var tb = document.getElementById("rbrowser_filterbox");
        var obRx, text, not;
        text = tb.value;
        not = (text[0] == "~");
        if (not) text = text.substr(1);
        if (!text) return function ( /*x*/ ) true;
        try {
            obRx = new RegExp(text, "i");
            tb.className = "";
            if (not) return x => !(obRx.test(x));
            else return x => obRx.test(x);
        } catch (e) {
            tb.className = "badRegEx";
            return x => (x.indexOf(text) > -1);
        }
    }

    this.applyFilter = function () {
        _this.filter = _getFilter();
        _createVisibleData();
    };

    this.filter = function ( /*x*/ ) true;

    // Attach one level list of child items to an item
    function _addVisibleDataChildren(vItem, parentIndex, isOpen) {
        var children = vItem.origItem.children;
        vItem.isOpen = isOpen;
        var len = children.length;
        vItem.children = [];
        var idx = parentIndex;
        for (let i = 0; i < len; ++i) {
            if (vItem.level == 0 && !_this.filter(children[i].name)) {
                children[i].index = -1;
                continue;
            }
            ++idx;
            vItem.children.push(_getVItem(children[i], idx, vItem.level + 1,
                i == 0, i == len - 1,
                // Closed subtree elements have 0-based parentIndex
                isOpen ? parentIndex : 0));
        }
        vItem.isContainerEmpty = vItem.children.length == 0;
    }

    this.sort = function sort(column, root) {
        var columnName, currentElement, tree, sortDirection, realOrder, order,
            sortDirs;
        tree = document.getElementById("rbrowser_objects_tree");
        sortDirection = tree.getAttribute("sortDirection");
        sortDirs = ["descending", "natural", "ascending", "descending"];
        realOrder = sortDirs.indexOf(sortDirection) - 1;

        try {
            currentElement = this.visibleData[this.selection.currentIndex].origItem;
        } catch (e) {
            currentElement = null;
        }
        if (currentElement) this.saveSelection();

        // If the column is passed and sort already done, reverse it
        if (column) {
            columnName = column.id;
            if (tree.getAttribute("sortResource") == columnName) {
                realOrder = ((realOrder + 2) % 3) - 1;
            } else {
                realOrder = 1;
            }
        } else {
            columnName = tree.getAttribute("sortResource");
        }

        var colNames = ["r-name", "r-dims", "r-class", "r-group", "r-fullName",
            "r-position"
        ];
        var sCol = colNames.indexOf(columnName);
        var defaultSortCol = 0;
        if (typeof (sCol) == "undefined") sCol = 0;

        // Sort using original element order
        if (realOrder == 0) {
            sCol = 4;
            order = 1;
        } else {
            order = realOrder;
        }

        var _sortCompare = (a, b) => {
            if (a.sortData[sCol] > b.sortData[sCol]) return 1 * order;
            if (a.sortData[sCol] < b.sortData[sCol]) return -1 * order;

            if (sCol != defaultSortCol) {
                if (a.sortData[defaultSortCol] > b.sortData[defaultSortCol])
                    return 1;
                if (a.sortData[defaultSortCol] < b.sortData[defaultSortCol])
                    return -1;
            }
            return 0;
        };

        var _sortComparePkgs = (a, b) => {
            // Index 1 is the package's position in the search path
            if (a.sortData[1] > b.sortData[1]) return 1;
            if (a.sortData[1] < b.sortData[1]) return -1;
            return 0;
        };

        var _sortRecursive = function recSort(arr) {
            arr.sort(_sortCompare);
            for (let i = 0; i < arr.length; ++i)
                if (typeof (arr[i].children) === "object")
                    recSort(arr[i].children);
        };
		
        sortDirection = sortDirs[realOrder + 1];

        // Setting these will make the sort option persist
        tree.setAttribute("sortDirection", sortDirection);
        tree.setAttribute("sortResource", columnName);

        var cols = tree.getElementsByTagName("treecol");
        for (let i = 0; i < cols.length; ++i)
            cols[i].removeAttribute("sortDirection");
        document.getElementById(columnName).setAttribute("sortDirection", sortDirection);

        if (!root || root == _this.treeData) {
            // Sort packages always by name
            _this.treeData.sort(_sortComparePkgs);
            for (let i = 0; i < _this.treeData.length; ++i) {
                if (typeof (_this.treeData[i].children) == "object") {
                    _sortRecursive(_this.treeData[i].children);
                }
            }
        } else if (root.children) _sortRecursive(root.children);

        _createVisibleData();

        if (currentElement) {
            this.selection.select(currentElement.index);
            this.treeBox.ensureRowIsVisible(currentElement.index);

            this.restoreSelection();
        }
    };

    this.foldAll = function (open) {
        if (!this.rowCount) return;

        var idx = this.selection.currentIndex;
        if (idx == -1) idx = 0;

        var curItem = this.visibleData[idx].origItem;
        var parentObject = curItem.parentObject;
        if (parentObject) {
            var siblings;
            if (parentObject.children) {
                siblings = parentObject.children;
            } else {
                siblings = parentObject;
            }
            for (var i = 0; i < siblings.length; ++i) {
                if (siblings[i].isOpen == open)
                    this.toggleOpenState(siblings[i].index);
            }
        }
    };

    this.toggleOpenState = function (idx) {
        var vd = this.visibleData, vd2;
        var item = vd[idx];
        var iLevel = item.level;
        var rowsChanged;
        var insertItems = [];

        if (!item) return;

        _this.selection.select(idx);
        if (item.isList && !item.origItem.isOpen && !item.origItem.childrenLoaded) {
            _addObject(item.origItem.env, item.origItem.fullName, this.parseObjListResult);
            return;
        }
        if (!item.childrenLength) {
            item.isContainer = item.origItem.isOpen = false;
            return;
        }

        if (item.origItem.isOpen) { // Closing subtree
            let k;
            for (k = idx + 1; k < vd.length && vd[k].level > iLevel; ++k) {}
            rowsChanged = k - idx - 1;
            item.children = vd.splice(idx + 1, rowsChanged);

            // Make parentIndexes of child rows relative
            for (let i = 0; i < item.children.length; ++i)
                item.children[i].parentIndex -= idx;

            // Decrease parentIndexes of subsequent rows
            for (let i = idx + 1; i < vd.length; ++i) {
                if (vd[i].parentIndex > idx)
                    vd[i].parentIndex -= rowsChanged;
                vd[i].origItem.index = i;
            }
        } else { // Opening subtree
            if (typeof (item.children) == "undefined")
                _addVisibleDataChildren(item, idx, false);

            // Filter child items
            for (let i = 0; i < item.children.length; ++i) {
                insertItems.push(item.children[i]);
            }

            rowsChanged = insertItems.length;
            // Change parentIndexes of child rows from relative to absolute
            for (let i = 0; i < insertItems.length; ++i) {
                insertItems[i].parentIndex += idx;
                insertItems[i].origItem.index = i + idx + 1;
            }

            vd2 = vd.slice(0, idx + 1).concat(insertItems, vd.slice(idx + 1));
            // Increase parentIndexes of subsequent rows:
            for (let i = idx + 1 + insertItems.length; i < vd2.length; ++i) {
                if (vd2[i].parentIndex > idx)
                    vd2[i].parentIndex += rowsChanged;
                vd2[i].origItem.index = i;
            }
            this.visibleData = vd2;
            item.children = null;
        }
        item.origItem.isOpen = !item.origItem.isOpen;
        if (rowsChanged)
            this.treeBox.rowCountChanged(idx + 1,
                (item.origItem.isOpen ? 1 : -1) * (rowsChanged));
        this.treeBox.invalidateRow(idx);
    };

    this.setTree = function (treeBox) {
        _this.treeBox = treeBox;
    };
    this.setCellText = function (idx, col, value) {
        _this.visibleData[idx].labels[col.index] = value;
    };
    this.setCellValue = function ( /*idx, col, value*/ ) {};
    this.getCellText = function (idx, column) _this.visibleData[idx].labels[column.index];
    this.isContainer = function (idx) _this.visibleData[idx].isContainer;
    this.isContainerOpen = function (idx) _this.visibleData[idx].origItem.isOpen;
    this.isContainerEmpty = function (idx) _this.visibleData[idx].isContainerEmpty;
    this.isSeparator = function ( /*idx*/ ) false;
    this.isSorted = function () false;
    this.isEditable = function ( /*idx, column*/ ) false;
    this.getParentIndex = function (idx) idx in _this.visibleData ? _this.visibleData[idx].parentIndex : -1;
    this.getLevel = function (idx) _this.visibleData[idx].level;
    this.hasNextSibling = function (idx /*, after*/ ) !_this.visibleData[idx].last;
    this.getImageSrc = function (row, col) {
        if (col.index == 0) {
            var Class = _this.visibleData[row].origItem.class;
            if (Class == "package" && this.visibleData[row].origItem.name
                .indexOf("package") != 0) {
                Class = "environment";
            } else if (iconTypes.indexOf(Class) == -1) {
                Class = _this.visibleData[row].origItem.group;
                if (iconTypes.indexOf(Class) == -1) return "";
            }
            return "chrome://komodor/skin/images/" + Class + ".png";
        } else
            return "";
    };
    this.getCellValue = function ( /*idx, column*/ ) 1;
    this.getColumnValue = function ( /*idx, column*/ ) 1;
    this.cycleHeader = function ( /*col, elem*/ ) {};
    this.selectionChanged = function () {};
    this.cycleCell = function ( /*idx, column*/ ) {};
    this.performAction = function ( /*action*/ ) {};
    this.performActionOnCell = function ( /*action, index, column*/ ) {};

    this.getRowProperties = function (idx, props) {
        if (!(idx in _this.visibleData)) return null;
        var item = _this.visibleData[idx];
        var origItem = item.origItem;

        if (props === undefined) {
            props = "type-" + origItem.type + " class-" + origItem.class;
            if (item.last) props += " lastChild";
            if (item.first) props += " firstChild";
            return props;
        } else { // XXX: Obsolete since Gecko 22 (komodo 9)
            props.AppendElement(atomSvc.getAtom("type-" + origItem.type));
            props.AppendElement(atomSvc.getAtom("class-" + origItem.class));
            if (item.last) props.AppendElement(atomSvc.getAtom("lastChild"));
            if (item.first) props.AppendElement(atomSvc.getAtom("firstChild"));
        }
        return null;
    };

    this.getCellProperties = function (idx, column, props) {
        if (column.id == "r-name") {
            var item = this.visibleData[idx];
            var origItem = item.origItem;

            if (props === undefined) {
                props = "icon" + " type-" + origItem.type +
                    " class-" + origItem.class +
                    " group-" + origItem.group;
                if (item.isContainerEmpty && origItem.class == "package")
                    props += " empty_package";
                return props;
            } else { // XXX: Obsolete since Gecko 22 (komodo 9)
                props.AppendElement(atomSvc.getAtom("icon"));
                props.AppendElement(atomSvc.getAtom("type-" + origItem.type));
                props.AppendElement(atomSvc.getAtom("class-" + origItem.class));
                props.AppendElement(atomSvc.getAtom("group-" + origItem.group));
                if (item.isContainerEmpty && origItem.class == "package")
                    props.AppendElement(atomSvc.getAtom("empty_package"));
            }
        }
        return null;
    };

    this.getColumnProperties = function ( /*column, element, prop*/ ) {};

    this.getSelectedRows = function () {
        var start = {};
        var end = {};
        var rows = [];
        if (!_this.selection) return rows;
        var numRanges = _this.selection.getRangeCount();
        for (let t = 0; t < numRanges; ++t) {
            _this.selection.getRangeAt(t, start, end);
            for (let v = start.value; v <= end.value; ++v)
                rows.push(v);
        }
        return rows;
    },

 
    // Drag'n'drop support
    this.draghandlers = {
        onDragStart(event) {
            if (_this.rowCount === 0) return;
            //_this.onEvent(event);
            var namesArr = _this.getSelectedNames(event.ctrlKey, event.shiftKey);
            event.dataTransfer.setData("text/plain", namesArr.join(', '));
            event.dataTransfer.effectAllowed = "copy"; 
        },
        onDrop(event) {
            event.preventDefault();
            var text;
            var data = event.dataTransfer;
            if (data.types == null) return;
            if (data.types.contains("text/plain")) {
                text = data.getData("text/plain").trim();
                let pos = _this.searchPath.indexOf(text);
                if (pos == -1) return;
                document.getElementById("rbrowser_searchpath_listbox").getItemAtIndex(pos).checked = true;
                _addObject(text, "", _this.parseObjListResult);
            } else if (data.types.contains("Files")) {
                // TODO check if RData and load/attach?
                //nsIFile
                //text/x-moz-url, text/uri-list, text/plain, application/x-moz-file, Files
            }            
        },
        onDragOver(event) {
            // TODO
            var dataTypes = event.dataTransfer.types;
            if (!dataTypes.contains("text/plain") &&
                !dataTypes.contains("text/x-r-package-name")
                )
                dataTypes.effectAllowed = "none"; 
        },
        
        onSearchPathDrop(event) {
            let data = event.dataTransfer;
            let filePath, text;
            if (data.types.contains("application/x-moz-file")) {
                filePath = data.getData("application/x-moz-file").path;
            } else if (data.types.contains("text/plain")) {
                filePath = String(data.getData("text/plain")).trim();
                if (!sv.file.exists(sv.file.path(filePath))) {
                    text = filePath;
                    filePath = null;
                }
            } /// else  if (data.contains("Files")) {

            // Attach the file if it is an R workspace
            if (filePath && filePath.search(/\.RData$/i) > 0) {
                sv.r.loadWorkspace(filePath, true, function (message) {
                    _this.getPackageList();
                    sv.addNotification("Upon attaching the workspace \"" + filePath +
                                       "\", R said: " + message);
                });
            } else if(text) {
                if(!/^(package:)?[a-zA-Z0-9\._]+$/.test(text))
                    return;
                if (text.indexOf("package:") === 0)
                    text = text.substring(8);
                
                sv.r.evalAsync("tryCatch(library(\"" + text +
                    "\"), error = function(e) {cat(\"<error>\"); message(e)})",
                    (message) => {
                        let pos;
                        if ((pos = message.indexOf('<error>')) > -1) {
                            message = message.substring(pos + 7);
                        } else {
                            _this.getPackageList();
                        }
                        if (message)
                            sv.addNotification("Upon loading the library \"" + text +
                                               "\", R said: " + message);
                    }
                );
            }
        },
        onSearchPathDragStart(event) {
            if (event.target.tagName != 'listitem')
                return;

            var text = _this.searchPath[document
                .getElementById("rbrowser_searchpath_listbox")
                .selectedIndex];
            event.dataTransfer.setData("text/plain", text);
            event.dataTransfer.effectAllowed = "copy"; 
            return;
        },
        
        onSearchPathDragOver(event) {
            // TODO
            var dataTypes = event.dataTransfer.types;
            if (!dataTypes.contains("text/plain") &&
                !dataTypes.contains("text/x-moz-file") &&
                !dataTypes.contains("text/x-r-package-name")
                )
                event.dataTransfer.effectAllowed = "none"; 
        }
  
    };

    this.canDrop = function () false;
    this.drop = function ( /*idx, orientation*/ ) {};

    // Get the list of packages on the search path from R
    this.getPackageList = function () {
        var data;
        try {
            data = sv.rconn.eval('cat(kor::objSearch(sep="' + sep + '", compare=FALSE))');
        } catch (e) {
            return;
        }
        if (!data) return;
        _this.searchPath = data.replace(/[\n\r\f]/g, "").split(sep);
        _this.displayPackageList(false);
    };

    // Display the list of packages in the search path
    this.displayPackageList = function () {
        var pack;
        var node = document.getElementById("rbrowser_searchpath_listbox");
        var selectedLabel = node.selectedItem ? node.selectedItem.label : null;

        while (node.firstChild) node.removeChild(node.firstChild);
        var packs = _this.searchPath;
        var selectedPackages = _this.treeData.map(x => x.name);

        if (!selectedPackages.length) selectedPackages.push(".GlobalEnv");

        for (let i = 0; i < packs.length; ++i) {
            pack = packs[i];
            var item = document.createElement("listitem");
            item.setAttribute("type", "checkbox");
            item.setAttribute("label", pack);
            item.setAttribute("checked", selectedPackages.indexOf(pack) != -1);
            node.appendChild(item);
        }

        if (selectedLabel != null) {
            for (let i = 0; i < node.itemCount; ++i) {
                if (node.getItemAtIndex(i).label == selectedLabel) {
                    node.selectedIndex = i;
                    break;
                }
            }
        } else {
            node.selectedIndex = 0;
        }

    };

    // Clear the list of packages on the search path (when quitting R)
    this.clearPackageList = function () {
        _this.searchPath = [];
        _this.displayPackageList(false);
        this.parseObjListResult("Env=.GlobalEnv\nObj=\n");
    };
    
    this.clearAll = function () {
        let rowCount =_this.visibleData.length;
        _this.visibleData.splice(0);
        let treeBox = _this.treeBox;
        _this.treeData.splice(0);
        treeBox.beginUpdateBatch();
        treeBox.invalidateRange(treeBox.getFirstVisibleRow(), treeBox.getLastVisibleRow());
        treeBox.rowCountChanged(0, -rowCount);
        treeBox.endUpdateBatch();
        //document.getElementById("rbrowser_objects_tree").disabled = true;
    };
    

    this.toggleViewSearchPath = function () {
        var button = document.getElementById("rbrowserSubpanelToggle");
        var deck = document.getElementById("rbrowserSubpanelBox");
        var state = button.getAttribute("state");
        switch (state) {
        case "collapsed":
            button.setAttribute("state", "open");
            deck.removeAttribute("collapsed");
            _this.refresh();
            break;
        case "open":
            /* falls through */
        default:
            button.setAttribute("state", "collapsed");
            deck.setAttribute("collapsed", "true");
            break;
        }
    };

    // Change the display status of a package by clicking an item in the list
    this.packageSelectedEvent = function (event) {
        var el = event.target;
        var pack = el.getAttribute("label");
        if (!pack) return;
        if (el.checked) {
            //_addObject(pack, "", _parseObjectList, pack);
            _addObject(pack, "", this.parseObjListResult);
        } else {
            _removeObjectList(pack);
        }
    };

    this.refreshGlobalEnv = function refreshGlobalEnv(data) {
        if (!data) {
            _addObject(".GlobalEnv", "", this.parseObjListResult);
        } else {
            this.parseObjListResult(data);
        }
    };

    this.removeSelected = function (doRemove) {
        var item, type, name, vItem, cmd = [];
        var rmItems = {},
            objectsToRemove = {},
            envToDetach = [];
        var objectsToSetNull = {};
        var rows = this.getSelectedRows();
        if (rows.length == 0) return false;

        var rxBackticked = /^`.*`$/;

        for (let i = 0; i < rows.length; ++i) {
            vItem = this.visibleData[rows[i]];
            item = vItem.origItem;
            name = item.fullName;
            type = item.type;

            // Remove backticks from names, as they are used as strings anyway
            if (rxBackticked.test(name)) name = name.substr(1, name.length - 2);

            switch (type) {
            case "environment":
                if (name != ".GlobalEnv" && name != "TempEnv")
                    envToDetach.push(name);
                break;
            case "object":
            case "sub-object":
                var env = item.env;
                thisItem: // FIXME: label

                    if (envToDetach.indexOf(env) == -1) {
                        var parent = vItem;
                        while (parent && parent.parentIndex &&
                            parent.parentIndex != -1) {
                            parent = this.visibleData[parent.parentIndex].origItem;

                            if (!parent || (rmItems[env] &&
                                    (rmItems[env].indexOf(parent.fullName) != -1)) ||
                                (parent.type == "environment" &&
                                    (envToDetach.indexOf(parent.name) != -1)))
                                break thisItem;
                        }
                        if (typeof (rmItems[env]) == "undefined")
                            rmItems[env] = [];
                        rmItems[env].push(name);

                        if (type == "sub-object") {
                            if (typeof (objectsToSetNull[env]) == "undefined")
                                objectsToSetNull[env] = [];
                            objectsToSetNull[env].push(name);
                        } else {
                            if (typeof (objectsToRemove[env]) == "undefined")
                                objectsToRemove[env] = [];
                            objectsToRemove[env].push(name);
                        }

                        var siblings = item.parentObject.children;
                        for (var j in siblings) {
                            if (siblings[j] == item) {
                                siblings.splice(j, 1);
                                break;
                            }
                        }
                    }
                break;
            default:
            }
        }

        for (let i = 0; i < envToDetach.length; ++i) {
            cmd.push('detach("' + sv.string.addslashes(envToDetach[i]) + '", unload = TRUE)');
            for (let j = 0; j < _this.treeData.length; ++j) {
                if (_this.treeData[j].name == envToDetach[i]) {
                    _this.treeData.splice(j, 1);
                    break;
                }
            }
        }

        for (let j in objectsToRemove)
            if (objectsToRemove.hasOwnProperty(j))
                cmd.push('rm(list = c("' + objectsToRemove[j].join('", "') +
                    '"), pos = "' + j + '")');

        for (let j in objectsToSetNull)
            if (objectsToSetNull.hasOwnProperty(j)) {
                cmd.push('eval(expression(' +
                    objectsToSetNull[j].join(" <- NULL, ") +
                    ' <- NULL), envir = as.environment("' + j + '"))');
            }

        _createVisibleData();

        if (!cmd.length) return false;

        if (doRemove) {
            // Remove immediately
            sv.r.evalAsync(cmd.join("\n"), function (res) {
                sv.cmdout.append(res);
                if (envToDetach.length) _this.refresh();
            });
        } else {
            // Insert commands to current document
            var view = ko.views.manager.currentView;
            if (!view) return false;
            //view.setFocus();
            var scimoz = view.scimoz;
            var nl = ";" + ["\r\n", "\n", "\r"][scimoz.eOLMode];
            scimoz.scrollCaret();
            scimoz.insertText(scimoz.currentPos, cmd.join(nl) + nl);
        }

        _this.selection.select(Math.min(rows[0], _this.rowCount - 1));
        //_this.selection.clearSelection();
        return true;
    };

    this.getSelectedNames = function (fullNames, extended) {
        if (extended === undefined) extended = false;
        let namesArr = [];
        let text, item;
		let modif;
		if(extended && !fullNames) 
			modif = (s) =>  '"' + s + '"';
		else if (extended && fullNames) 
			modif = (s, item) => {
				if (item.group == "function") {
                     s += "()";
                } else if (item.type == "args") {
                    s += "="; // Attach '=' to function args
                };
				return s;
			};
		else modif = (s) => s;
			
        let name = fullNames && !extended ? "fullName" : "name";
        let selectedItemsOrd = _this.selectedItemsOrd;
        for (let i = 0; i < selectedItemsOrd.length; ++i) {
            item = selectedItemsOrd[i];
            text = item[name];
            if (text) namesArr.push(modif(text, item));
        }
        return namesArr;
    };

    this.insertName = function (fullNames, extended) {
        // TODO: `quote` non-syntactic names of 1st level (.type = 'object')
        // extended mode: object[c('sub1', 'sub2', 'sub3')]
        var view = ko.views.manager.currentView;
        if (!view) return;
        var text = _this.getSelectedNames(fullNames, extended).join(', ');
        var scimoz = view.scimoz;
        if (!scimoz) return;
        var length = scimoz.length;

        if (scimoz.getWCharAt(scimoz.selectionStart - 1)
            .search(/^[\w\.\u0100-\uFFFF"'`,\.;:=]$/) != -1)
            text = " " + text;
        if (scimoz.getWCharAt(scimoz.selectionEnd)
            .search(/^[\w\.\u0100-\uFFFF"'`]$/) != -1)
            text += " ";

        scimoz.insertText(scimoz.currentPos, text);
        scimoz.currentPos += scimoz.length - length;
        scimoz.charRight();
    };

    this.setFilterBy = function (menuItem, column) {
        var newFilterBy = ['name', 'dims', 'class', 'group', 'fullName']
            .indexOf(column);
        if (newFilterBy == -1) return;

        if (newFilterBy != filterBy) {
            //var items = menuItem.parentNode.getElementsByTagName("menuitem");
            //for (var i = 0; i < items.length; i++)
            //items[i].setAttribute("checked", items[i] == menuItem);

            filterBy = newFilterBy;
            this.applyFilter();
        } else {
            //menuItem.setAttribute("checked", true);
        }

        var filterBox = document.getElementById("rbrowser_filterbox");

        filterBox.emptyText = menuItem.getAttribute("label") + "...";
        filterBox.focus();

        //document.getElementById("rbrowser_filterbox")
        //    .setAttribute("emptytext", menuItem.getAttribute("label"));
        //sv.alert(document.getElementById("rbrowser_filterbox")
        //    .getAttribute("emptytext"));
        return;
    };

    this.contextOnShow = function (event) {
        var currentIndex = _this.selection.currentIndex;
        if (currentIndex == -1) return;

        var isEnvironment, isPackage, isInPackage, noDelete, isFunction;
        var item, type, name;
        item = _this.visibleData[currentIndex].origItem;
        type = item.class;
        name = item.fullName;

        isEnvironment = item.type == "environment" || item.class == "environment";
        isPackage = isEnvironment && (item.name.indexOf("package:") == 0);
        isInPackage = !isPackage && item.env &&
            (item.env.indexOf("package:") == 0);

        noDelete = (isEnvironment && (nonDetachable.indexOf(name) != -1)) ||
            isInPackage;
        isFunction = type == "function";

        var cannotSaveToFile = ["data.frame", "matrix", "table"]
            .indexOf(item.class) == -1;
        var cannotSave = _this.selectedItemsOrd.filter(function (item) item.type == 'object' && item.group !=
            'function').length == 0;

        var multipleSelection = _this.selection.count > 1;

        // Help can be shown only for one object:
        var noHelp = isPackage || !isInPackage;

        //var menuNode = document.getElementById("rObjectsContext");
        var menuItems = event.target.childNodes;
        var testDisableIf, disable = false;

        for (var i = 0; i < menuItems.length; ++i) {
            if (!menuItems[i].hasAttribute('testDisableIf')) continue;
            testDisableIf = menuItems[i].getAttribute('testDisableIf').split(/\s+/);
            disable = false;

            for (var j = 0; j < testDisableIf.length && !disable; ++j) {
                switch (testDisableIf[j]) {
                case 't:multipleSelection':
                    disable = disable || multipleSelection;
                    break;
                case 't:noHelp':
                    disable = disable || noHelp;
                    break;
                case 't:isFunction':
                    disable = disable || isFunction;
                    break;
                case 't:isEnvironment':
                    disable = disable || isEnvironment;
                    break;
                case 't:isPackage':
                    disable = disable || isPackage;
                    break;
                case 't:cannotSaveToFile':
                    disable = disable || cannotSaveToFile;
                    break;
                case 't:cannotSave':
                    disable = disable || cannotSave;
                    break;
                case 't:noDelete':
                    disable = disable || noDelete;
                    break;
                default:
                    break;
                }
                if (disable) break;
            }
            menuItems[i].setAttribute('disabled', disable);
        }

    };
	
	var rCmdGetObject = (name, env) => 
		env == ".GlobalEnv" ?
             name : "evalq(" + name + ", envir=as.environment(\"" + 
			 sv.string.addslashes(env) + "\"))";


    this.doCommand = function (action) {
        var obj = _this.selectedItemsOrd;
        var command;
        switch (action) {
        case 'save':
            // Select only objects:
            obj = obj.filter(function (x) {
                if (x.type != "object") {
                    _this.selection.toggleSelect(x.index);
                    return false;
                } else return true;
            });

            var dup = sv.array.duplicates(obj.map(function (x) x.name));
            if (dup.length &&
                ko.dialogs.okCancel("Objects with the same names from different" +
                    "environments selected. Following object will be taken from the " +
                    "foremost location in the search path: " + dup.join(', '),
                    "Cancel") == "Cancel") return;

            var fileName = (obj.length == 1) ? obj[0].name
                .replace(/[\/\\:\*\?"<>\|]/g, '_') : '';

            var dir;
            try {
                dir = sv.file.path(sv.rconn.eval("cat(getwd())"));
            } catch (e) {
                return;
            }

            if (!dir) return;
			
			let oFilterIdx = {};
            fileName = sv.fileOpen(dir, fileName + '.RData', '', ["R data (*.RData)|*.RData"], false,
                true, oFilterIdx);

            if (!fileName) return;
            command = 'save(list=c(' + obj.map(x => '"' + x.name + '"')
                .join(',') + '), file="' + sv.string.addslashes(fileName) + '")';

            sv.r.eval(command);
            break;
            // Special handling for help
        case 'help':
            for (var i in obj) {
                // Help only for packages and objects inside a package
                if (obj[i].fullName.indexOf("package:") == 0) {
                    sv.r.help("", obj[i].fullName.replace(/^package:/, ''));
                } else if (obj[i].env.indexOf("package:") == 0) {
                    sv.r.help(obj[i].fullName, obj[i].env.replace(/^package:/, ''));
                } else {
                    sv.r.help(obj[i].fullName);
                }
            }
            break;

            //TODO: dump data for objects other than 'data.frame'
        case 'write.table':
        case 'writeToFile':
            for (let i in obj)
                if (obj.hasOwnProperty(i)) {
                    let expr = rCmdGetObject(obj[i].fullName, obj[i].env);
                    sv.r.saveDataFrame(expr, '', obj[i].name);
                }
            break;

            // Default is to just execute command and display results
        case 'summary':
        case 'plot':
        case 'str':
        case 'names':
            /* falls through */
        default:
            let commandArr = [];
            for (let i in obj)
                if (obj.hasOwnProperty(i)) {
                    /*cmd.push(action + "(evalq(" + obj[i].fullName +
                    ", envir = as.environment(\"" +
                    obj[i].env.addslashes() + "\")))");*/
                    let cmdObj = rCmdGetObject(obj[i].fullName, obj[i].env);
                    commandArr.push(action + "(" + cmdObj + ")");
                }
            sv.r.eval(commandArr.join("\n"));
        }
    };
	
    this.selectedItemsOrd = [];

    this.onEvent = function on_Event(event) {
        switch (event.type) {
        case "select":
            let selectedRows = _this.getSelectedRows();
            let selectedItems = [];

            if (selectedRows.some(x => x >= _this.visibleData.length))
                return false;

            for (let i = 0; i < selectedRows.length; ++i)
                selectedItems.push(_this.visibleData[selectedRows[i]].origItem);
            //let curRowIdx = selectedRows.indexOf(_this.selection.currentIndex);

            // This maintains array of selected items in order they were
            // added to selection
            let prevItems = _this.selectedItemsOrd;
            let newItems = [];
            for (let i = 0; i < prevItems.length; ++i) {
                if (selectedItems.indexOf(prevItems[i]) != -1) // Present in Prev, but not in Cur
                    newItems.push(prevItems[i]);
            }
            for (let i = 0; i < selectedItems.length; ++i) {
                if (prevItems.indexOf(selectedItems[i]) == -1) {
                    // Present in Cur, but not in Prev
                    newItems.push(selectedItems[i]);
                }
            }
            _this.selectedItemsOrd = newItems;

            return false;
        case "keyup":
        case "keypress":
            let key = event.keyCode ? event.keyCode : event.charCode;
            switch (key) {
            case 46: // Delete key
                _this.removeSelected(event.shiftKey);
                event.originalTarget.focus();
                return false;
            case 45: // Insert
            case 32: // Space
                break;
            case 65: // Ctrl + A
            case 97: // Ctrl + a
                if (event.ctrlKey) {
                    if (event.shiftKey)
                        _this.selectAllSiblings(_this.selection.currentIndex, false);
                    else
                        _this.selection.selectAll();
                }
                /* falls through */
            case 0:
                return false;
            case 93:
                // Windows context menu key
                let contextMenu = document.getElementById("rObjectsContext");
                _this.treeBox.ensureRowIsVisible(_this.selection.currentIndex);
                let y = ((2 + _this.selection.currentIndex -
                        _this.treeBox.getFirstVisibleRow()) *
                    _this.treeBox.rowHeight) + _this.treeBox.y;
                let x = _this.treeBox.x;
                contextMenu.openPopup(null, "after_pointer", x, y, true);
                /* falls through */
                // TODO: Escape key stops retrieval of R objects
            default:
                return false;
            }
            break;
        case "dblclick":
            if (event.button != 0) return false;
            if (_this.selection && (_this.selection.currentIndex == -1 ||
                    _this.isContainer(_this.selection.currentIndex)))
                return false;
            break;
        case "click":
        case "dragstart":
             return false;
        default:
        }

        // Default action: insert selected names
        _this.insertName(event.ctrlKey, event.shiftKey);

        // This does not have any effect
        //document.getElementById("rbrowser_objects_tree").focus();
        event.originalTarget.focus();
        return false;
    };

    this.packageListKeyEvent = function (event) {
        var keyCode = event.keyCode;
        switch (keyCode) {
        case 46: // Delete key
            let listbox = event.target;
            let listItem = listbox.selectedItem;
            let pkg = listItem.getAttribute("label");

            if (nonDetachable.indexOf(pkg) != -1) return;

            sv.r.evalAsync(
                'base::tryCatch(base::detach("' + sv.string.addslashes(pkg) +
                '", unload=TRUE), error=function(e) cat("<error>"));',
                function /*_packageListKeyEvent_callback*/ (data) {
                    logger.debug("packageListKeyEvent with data=" + data);
                    if (data.trim() != "<error>") {
                        _removeObjectList(pkg);
                        listbox.removeChild(listItem);
                        sv.cmdout.append(sv.translate("R: Database \"%S\" detached.", pkg));
                    } else {
                        sv.cmdout.append(sv.translate("R: Database \"%S\" could not be detached.",
                            pkg));
                    }
                });
            return;
        default:
            return;
        }
    };

    this.selectAllSiblings = function (idx, augment) {
        let startIndex = _this.visibleData[idx].parentIndex + 1;
        let curLvl = _this.visibleData[idx].level;
        let endIndex;
        for (endIndex = startIndex; endIndex < _this.visibleData.length &&
            _this.visibleData[endIndex].level >= curLvl;
            ++endIndex) {}
        --endIndex;
        _this.selection.rangedSelect(startIndex, endIndex, augment);
    };

    this.focus = function () {};

    this.onLoad = function ( /*event*/ ) {
        if (sv.r.isRunning) _this.refresh(true);
    };

}).apply(sv.rbrowser);