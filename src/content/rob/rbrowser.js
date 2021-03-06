/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *
 *  Copyright (c) 2015-2017 Kamil Barton
 *  Copyright (c) 2009-2015 Kamil Barton & Ph. Grosjean (phgrosjean@sciviews.org)
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */
/*
 * TODO: add context menu item for environments: remove all objects
 */

/* globals require, document, self */

var rob = {};

// Control characters + separators
//     \x15 - connection error
//     \x03 - stderr
//     \x02 - stdout
// robjects:
//     \x1e - record separator
//     \x1f - unit separator
//     \x1d - group separator

(function () {

    var logger = require("ko/logging").getLogger("komodoR");
   
    const { /*arr: ArrayUtils, */ str: StringUtils } = require("kor/utils");
    const fileUtils = require("kor/fileutils");
    const RConn = require("kor/connector");
    const R = require("kor/r");
    const UI = require("kor/ui");
    const rGlobalEnvStr = ".GlobalEnv";

    var _this = this;

    const sep = "\x1f", recordSep = "\x1e";
    var _listAllNames = false, _listAttributes = false, _listFuncBody = false;
    var dQuote = s => "\"" + s + "\"";
    var imagePrefix = "koicon://ko-svg/chrome/komodor/skin/images/rob/";
    var svgParams = "?size=16&color=" + encodeURIComponent("#004fd2");

    // XXX make internal
    this.evalEnv = { name: undefined, isNew: false };
    const evalEnvLabel = "<Current evaluation frame>",
          functionBodyLabel = "<function body>";
    var copyToClipboardSep = ", ";
    
    this.searchPath = {
        _data: [],
        getListBox() document.getElementById("rob_searchpath_listbox"),
        display() {
            logger.debug("searchPath.display");

            let list = this.getListBox();
            let selectedLabel = list.selectedItem ? list.selectedItem.label : null;
            let selectedIndex = list.selectedIndex;
            while (list.firstChild) list.removeItemAt(0);
            let checkedItems = _this.treeData.map(x => x.name);
            if (checkedItems.length === 0) checkedItems.push(rGlobalEnvStr);
            if (this._data.length === 0) return;
        
            let item, n = this._data.length, dataitem;
            
            logger.debug("searchPath.display: adding " + n + " items");
            
            for (let i = 0; i < n; ++i) {
                try {
                    item = document.createElement("richlistitem");
                    dataitem = this._data[i];
                    item.setAttribute("label", dataitem.name);
                    item.setAttribute("id", "rob-searchpath-" + dataitem.name);
                    if (dataitem.depends) item.setAttribute("depends", dataitem.depends);
                    if (dataitem.reverseDepends) item.setAttribute("reverseDepends", dataitem.reverseDepends);
                    item.setAttribute("checked", checkedItems.indexOf(dataitem.name) !== -1);
                    if (R.nonDetachable.has(dataitem.name)) item.setAttribute("nondetachable", "true");
                    list.appendChild(item);
                } catch (e) {
                    logger.exception(e, "in searchPath.display");
                }
            }
            
            if (_this.evalEnv.name && this._data[0].name === _this.evalEnv.name) {
                let firstItem = list.getItemAtIndex(0);
				firstItem.isEvalEnv = true;
                firstItem.className = "eval-env";
                if (_this.evalEnv.isNew) {
                    firstItem.setAttribute("checked", true);
                    addObjectList(_this.evalEnv.name);
                }
            }

            if (selectedLabel !== null) {
                let idx = this._data.findIndex(x => x.name === selectedLabel);
                if (idx !== -1) selectedIndex = idx;
            }
            list.selectedIndex = Math.min(selectedIndex, n - 1);
            logger.debug("searchPath.display() done");
        },
        parseString(str) {
            let result = str.replace(/[\n\r\f]/g, "").split(recordSep).map(x => {
                x = x.split(sep);
                return {
                    type: x[0].substr(0, 1),
                    name: x[0].substr(1), 
                    depends: (x.length > 1 && x[1]) ? x[1] : null,
                    reverseDepends: (x.length > 2 && x[2]) ? x[2] : null
                };
            });
            //<richlistitem label="package:aumtutumtu" depends="stats *aumtutumtu" nondetachable="true" />
            //let m = result[0].name.match(/^<EvalEnv(?:\[(.+)\]|)>/);
            if (result[0].type === "3") {
				let newEvalEnvName = result[0].name ? result[0].name : evalEnvLabel;
                _this.evalEnv.isNew = (_this.evalEnv.name === undefined) ||
                    (newEvalEnvName !== _this.evalEnv.name);
                result[0].name = _this.evalEnv.name = newEvalEnvName;
            } else
                _this.evalEnv.name = undefined;
       
            this._data.splice(0);
            Array.prototype.push.apply(this._data, result);
        },
        _refreshCallback(result, resolve){
            if (!result) this.clear();
            else {
                this.parseString(result);
                this.display();
            }
            resolve();
        },
        refresh(focus = false) { // synchronous. XXX: remove?
            let data;
            try {
                data = RConn.eval('base::cat(kor::objSearch("' + sep + '", "' +
                    recordSep  + '"))', 2);
            } catch (e) {
                logger.exception(e, "in searchPath.refresh.");
                return;
            }
            if (!data) {
                this.clear();
                return;
            }
            this.parseString(data);
            this.display();
            if (focus) this.getListBox().focus();
        },
        refreshAsync() {
             return new Promise((resolve, reject) => {
                RConn.evalAsync('base::cat(kor::objSearch("' + sep + '", "' + recordSep  + '"))',
                    'rob.searchPath.refreshAsync', RConn.HIDDEN, resolve);
             });
        },
        clear() {
            this._data.splice(0);
            this.display();
        },
        indexOf(name) this._data.findIndex(x => x.name === name),
        getItemAtIndex(index) this._data[index]
    };
    
    RConn.defineResultHandler('rob.searchPath.refreshAsync',
        this.searchPath._refreshCallback.bind(this.searchPath));

    
    var makeObjListCommand = (env, obj) => {
        env = !env ? "\"\"" : (_this.evalEnv.name &&
            env === _this.evalEnv.name ? "kor::getEvalEnv()" :
                dQuote(StringUtils.addslashes(env)));
        
        var rval = "kor::write.objList(kor::objls(" +
            (obj ? obj + ", " : "") +
            (env ? "envir=" + env + ", " : "") +
            "all.names=" + R.arg(_listAllNames) +
            ", attrib=" + R.arg(_listAttributes) +
            ", funcBody=" + R.arg(_listFuncBody) +
            "), sep=" + R.arg(sep) +
            ", eol=" + R.arg(recordSep) + ")";
        logger.debug("R-browser command: \n" + "\n" + rval);
        return rval;
    };

    // This should be updated if new icons are added
    var iconTypes = [
	    "S3", "S4", "missing-arg", "attrib", "function",
		"standardGeneric", "environment", "GlobalEnv", "package", 
        "character", "integer", "numeric", "logical", "hexmode", "octmode", 
        "list", "factor", "NULL", "DateTime",
		"array", "matrix", "data.frame", "Matrix4", "expression", "language",
		"histogram", "dist",
		"name", "srcfilecopy", "srcref", 
        "lm", "lme", "gam", "glm", "gls", "merMod", 
        "_lm", "_lme", "_glmm",
        "formula", "family", "terms",
		"logLik", "connection", "htest", "ts", "nls",
		"Raster", "RasterBrick", "SpatialLine_", "SpatialPoint_", "SpatialPolygon_", "Spatial_",
		"gg_"
		];

    var hasIcon = (name) => iconTypes.indexOf(name) !== -1;

    var filterBy = 0; // Filter by name by default
    var isInitialized = false;

    this.visibleData = [];
    this.treeData = []; // Fields: Class, Dims, Full.name, Group, Name, Recursive

    this.treeBox = null;
    this.selection = null;
    
    Object.defineProperties(this, {
        'rowCount' : {
        get: function () this.visibleData.length,
        enumerable: true
       }, 
       'toString' : { 
       value: () => "[object RObjectBrowser]" 
    }});
  

    function VisibleItem(obj, index, level, first, last, parentIndex) {
        if ((this.isList = obj.isRecursive)) {
            this.isContainer = true;
            this.isContainerEmpty = false;
            this.childrenLength = obj.children ? obj.children.length : 0;
            this.isOpen = typeof obj.isOpen !== "undefined" && obj.isOpen;
        } else {
            this.isContainer = typeof obj.children !== "undefined";
            this.isContainerEmpty = this.isContainer &&
                obj.children.length === 0;
            this.childrenLength = this.isContainer ? obj.children.length : 0;
        }
        this.isOpen = typeof obj.isOpen !== "undefined" && obj.isOpen;
        this.parentIndex = parentIndex;
        this.level = level;
        this.first = first;
        this.last = last;
        
        //TODO: obj.dims.replace(/x/g,"\u00d7");
        this.labels = [obj.name, obj.dims, /*obj.group,*/ obj.className, obj.fullName];
        this.origItem = obj;
        this.origItem.index = index;
        this.id = this.origItem.env + "::" + this.origItem.fullName;
        this.imageName = this.getImage();
    }
    
    var imageMap = new Map();
    
    VisibleItem.prototype = {
        isList: false,
        isContainer: false,
        isContainerEmpty: false,
        childrenLength: 0,
        isOpen: false,
        parentIndex: null,
        level: null,
        first: false,
        last: false,
        labels: undefined,
        origItem: null,
        id: undefined,
        imageName: "empty",
        
        // Attach one level list of child items to an item
        addChildren(parentIndex, isOpen) {
            let children = this.origItem.children;
            this.isOpen = isOpen;
            let len = children.length;
            this.children = [];
            let idx = parentIndex;
            for (let i = 0; i < len; ++i) {
                if (this.level === 0 && !_this.filter(children[i].name)) {
                    children[i].index = -1;
                    continue;
                }
                ++idx;
                this.children.push(new VisibleItem(children[i], idx, this.level + 1,
                    i == 0, i == len - 1,
                    // Closed subtree elements have 0-based parentIndex
                    isOpen ? parentIndex : 0));
            }
            this.isContainerEmpty = this.children.length === 0;
        },
        
        getImage() {
            let origName = this.origItem.className;
            if (imageMap.has(origName))
                return imageMap.get(origName);
            let name = origName;
            let noicon = !hasIcon(name);
            if (this.origItem.isTopLevelItem)
                name = this.origItem.isPackage ? "package" :
                    this.origItem.name === rGlobalEnvStr ? "GlobalEnv" : "environment";
            else if (name.endsWith("merMod") && /(^|\w)merMod$/.test(name))
                name = "merMod";
            else if (name.endsWith("Matrix"))
                name = "Matrix4";
			else if (name.startsWith("SpatialLine") || name.startsWith("Line") || 
                name === "sfc_LINESTRING" || name === "sfc_MULTILINESTRING"
                )
				name = "SpatialLine_";
			else if (name.startsWith("SpatialPoint") || 
                name.startsWith("Point") ||
                name === "sfc_POINT" || name === "sfc_MULTIPOINT"
                )
				name = "SpatialPoint_";
			else if (name.startsWith("SpatialPolygon") || 
                name.startsWith("Polygon") ||
                name === "sfc_POLYGON")
				name = "SpatialPolygon_";
			else if (name.startsWith("gg"))
				name = "gg_";
			else if (name === "tbl_df" || name == "data.table")
				name = "data.frame";
            else if (name === "bam")
                name = "gam";
			//.SpatialPolygons.*
			//SpatialPoints, SpatialGrid, SpatialPointsDataFrame, SpatialGridDataFrame
			else if (name.startsWith("Spatial") || name == "sf" || name.startsWith("sfc_"))
				name = "Spatial_";
            else if (name === "" && this.origItem.type === "args")
                name = "missing-arg";
            else if (noicon) {
                if (name.contains("glmm"))
                    name = "_glmm";
				else if (name.endsWith("lme"))
                    name = "_lme";
                else if (name.endsWith("lm"))
                    name = "_lm";
				else if (name.startsWith("Raster"))
					name = "Raster";
                else
                    name = this.origItem.group;
            }
            if (!hasIcon(name)) name = "empty";
            imageMap.set(origName, name);
            return name;
        }
    };

    var addVisibleDataItems = function rob_addVisibleDataItems(item, parentIndex, level = -1) {
        if (item === undefined) return parentIndex;
        if (!parentIndex) parentIndex = 0;

        var idx = parentIndex;
        var len = item.length;

        for (let i = 0; i < len; ++i) {
            if (level === 1 && !_this.filter(item[i].sortData[filterBy])) {
                item[i].index = -1;
                continue;
            }
            ++idx;
            let vItem = new VisibleItem(item[i], idx, level, i === 0, i === len - 1, parentIndex);
            _this.visibleData[idx] = vItem;

            if (vItem.isContainer && vItem.isOpen && vItem.childrenLength > 0) {
                let idxBefore = idx;
                idx = rob_addVisibleDataItems(item[i].children, idx, level + 1);
                // No children is visible
                if (idxBefore == idx) vItem.isContainerEmpty = true;
            }
        }
        return idx;
    };

    var createVisibleData = () => {
        if (!isInitialized) return;

        let rowsBefore = _this.visibleData.length;
        let firstVisibleRow = _this.treeBox ? _this.treeBox.getFirstVisibleRow() : 0;
       
        _this.visibleData.splice(0);
        addVisibleDataItems(_this.treeData, -1, 0);

        let rowsChanged = _this.visibleData.length - rowsBefore;
        if (rowsChanged) _this.treeBox.rowCountChanged(0, rowsChanged);

        if (_this.treeBox.view.rowCount > _this.visibleData.length)
            throw new Error("WTF?");

        if (firstVisibleRow < _this.visibleData.length)
            _this.treeBox.scrollToRow(firstVisibleRow);

        _this.treeBox.invalidateRange(
            _this.treeBox.getFirstVisibleRow(),
            _this.treeBox.getLastVisibleRow());
    };

    var parseRObjectName = (name, posObj) => {
    	var parents = [name], pos = 0, m, endpos, guard = 0;
        var rxattr = /^attr\((.+), "(?:[^"\\]|\\.)*"\)$/,
            rxqname = /(?:[@$]|^)`((?:[^`\\]|\\.)*)`$/,
            rxdblbrkt = /\[\[\d+\]\]$/,
            rx = /(?:[@$]|^)[a-zA-Z\u00c0-\uffef\.][\w\u00c0-\uffef\._]*$/;
    	while (name && ++guard < 64) {
    		if (name.startsWith("attr(") && name.endsWith(")")) {
    			m = name.match(rxattr);
    			if (Array.isArray(m)) {
    				name = m[1];
    				pos += 5;
    			} else name = "";
    		} else if (name.startsWith("body(") && name.endsWith(")")) {
    			name = name.substring(5, name.length - 1);
    			pos += 5;
    		} else { // remove last [@$]`?element`?
    			if (name.endsWith("`")) {
    				// match final `quoted name`
    				endpos = name.search(rxqname);
    				if (endpos > 0) {
    					name = name.substr(0, endpos);
    				} else name = "";
    			} else if (name.endsWith("]]")) { // match final syntactic.name
    				endpos = name.search(rxdblbrkt); // [[n]]
    				if (endpos > 0) {
    					name = name.substr(0, endpos);
    				} else name = "";
    			} else {
    				// Note: inline rx is faster than rx as variable. ???
    				endpos = name.search(rx);
    				if (endpos > 0) {
    					name = name.substr(0, endpos);
    				} else name = "";
    			}
    			// formals(A)$B -> A
    			if (name && name.endsWith(")")) {
    				if (name.startsWith("formals(args(") && name.endsWith("))")) {
    					name = name.substring(13, name.length - 2);
    					pos += 13;
    				} else if (name.startsWith("formals(")) {
    					name = name.substring(8, name.length - 1);
    					pos += 8;
    				}
    			}
    		}
    		if (name) parents.push(name);
    	}
    	if (typeof posObj === "object") posObj.value = pos;
    	return parents;
    };
 
    // RObjectItem constructor:
    function RObjectItem(env, obj, arr, index, parentElement) {

        var dimNumeric = 1;
        if (obj) { /// Objects
            if (/^(\d+x)*\d+$/.test(arr[2]))
                dimNumeric = arr[2].split(/x/).reduce((x, y) => x * parseInt(y));
            this.name = arr[0];
            this.fullName = arr[1] || this.name;
            this.dims = arr[2];
            this.group = arr[3];
            try {
                this.className = arr[4] || this.group;
                this.env = env;
                this._isRecursive = arr[5].contains('r');
                this.isHidden = arr[5].contains('h');
                this.isAttribute = arr[5].contains('a');
                this.hasAttributes = arr[5].contains('b');
                if (this.isRecursive) this.children = [];
                this.sortData = [this.name.toLowerCase(), dimNumeric, this.className.toLowerCase(),
                    this.group.toLowerCase(), index
                ];
            } catch (e) {
                logger.exception(e, "in RObjectItem constructor [" + arr + "]");
            }
            this.parentObject = parentElement;
            
            this.type = parentElement.isTopLevelItem ? "object" :
                        parentElement.group === "function" && !this.isAttribute ? "args" : "sub-object";
            
        } else { /// Environment
            let pos = _this.searchPath.indexOf(env);
            
            this.isCurrentEvalEnv = _this.evalEnv.name && env === _this.evalEnv.name;
            
            this.name = env;
            this.fullName = env;
            this.children = [];
            this.className = this.isCurrentEvalEnv || env === rGlobalEnvStr ? "environment" : "package";
            
            this.dims = dimNumeric = pos;
            this.sortData = [this.name.toLowerCase(), pos, this.className.toLowerCase(),
                             this.type.toLowerCase() ];
            this.isOpen = true;
            this.type = "environment";
            // sortData = [name, dim/pos, className, group/type, index/<none>]
        }
    }

    RObjectItem.prototype = {
        name: null,
        fullName: null,
        children: undefined,
        type: "environment",
        className: "package",
        group: "",
        env: null,
        _isRecursive: false,
        isHidden: false,
        isAttribute: false,
        hasAttributes: false,
        isOpen: false,
        dims: 0,
        sortData: [],
        index: -1,
        parentObject: this.treeData,
        childrenLoaded: false,  
        isCurrentEvalEnv: false,
        
        get isRecursive() this._isRecursive || _listAttributes && this.hasAttributes,

        toString() this.env + "::" + this.fullName + " (" + (this.isOpen ? "+" : ".") + ")" +
                (this.isOpen ? "->" + this.children : ''),
        
        isChildOf(b) {
            if (this === b) return false;
            let p = this;
            while((p = p.parentObject)) if(p === b) return true;
            return false;
        },
        get isTopLevelItem() !this.parentObject || this.parentObject.type === undefined,
        get getTopParent() { // Note: this returns 1-level object, not environment
            var p = this;
            if(!p.parentObject || p.isTopLevelItem) return null;
            while(!(p.parentObject.isTopLevelItem)) p = p.parentObject;
            return p;
        },
        get getEnvironment() this.getTopParent.parentObject,
        get getNSPrefix() {
            let tp = this.getTopParent;
            return tp && tp.env.startsWith("package:") ? tp.env.substring(8) + (tp.isHidden ? ":::" : "::") : "";
        },
        // XXX: cache
        get getFullName() {
            var pos = {};
            parseRObjectName(this.fullName, pos); // for pos.value
            return this.fullName.substr(0, pos.value) + this.getNSPrefix +
                this.fullName.substr(pos.value); 
        },
        
        get rExpression() {
            if(this.isTopLevelItem) {
                let posoff = _this.evalEnv.name ? 0 : 1;
                let pos = parseInt(this.dims) + posoff;
                if (pos === 1 && this.name === rGlobalEnvStr)
                    return this.name;
                if (pos === 0 && this.name === _this.evalEnv.name)
                   return "kor::getEvalEnv()";
                return "base::as.environment(" + pos + ")";
            }
            if(this.getEnvironment.dims === "0")
                return this.getFullName;
            var pos = {}, parsed, topParent, topName, name, envir;
            name = this.fullName;
            parsed = parseRObjectName(name, pos);
            topParent = this.getTopParent;
            topName = parsed[parsed.length - 1];
            envir = topParent.getEnvironment;
            
            var posArg;
            if(envir.fullName === _this.evalEnv.name && envir.dims === "0") { // double check
                //posArg = -1; // --> getEvalEnv()
                posArg = null; // --> no pos arg
            } else if (envir.fullName === rGlobalEnvStr && envir.dims === "0")
                posArg = null; // --> no pos arg
            else if (envir.isPackage)
                posArg = envir.name;
            else
                posArg = parseInt(envir.dims) + (Boolean(_this.evalEnv.name) ? 0 : 1);

      
            return name.substring(0, pos.value) + 
                R.get(topName, posArg, topParent.isHidden) +
                name.substring(pos.value + topName.length);
        },
         
        get isPackage() this.className === "package" && this.name.startsWith("package:"),
        get isInPackage() Boolean(this.env) && this.env.startsWith("package:"),

        getLevel() {
            let p = this, i = 0;
            while((p = p.parentObject)) ++i;
            return i;
            },
    };
    
    Object.defineProperty(RObjectItem.prototype, "toString", {
        enumerable: false, 
        configurable: false, 
        writable: false});
    
    var updateTopLevelItem = (object, pos = null, doUpdVisDat = false) => {
        if(!object.isTopLevelItem) return;
        if (pos === null) pos = _this.searchPath.indexOf(object.name);
        object.dims = pos.toString();
        object.sortData[1] = pos;
        if (doUpdVisDat) {
            _this.visibleData[object.index].labels[1] = pos;
            _this.treeBox.invalidateRow(object.index);
        }
    };
    
    var cleanupObjectLists = () => {
        if (!_this.treeData) return;
        // TODO: filter + Array.from ?
        var pos;
        for (let i = _this.treeData.length - 1; i >= 0; --i) {
            pos = _this.searchPath.indexOf(_this.treeData[i].name);
            if (pos === -1) _this.treeData.splice(i, 1);
            else 
                updateTopLevelItem(_this.treeData[i], pos, false);    
        }
        _this.sort(null, null);
        //createVisibleData();
    };
   
    var getBranchByName = (name, env) => {
        var p = _this.treeData, res;
        if (!p.length) return null;
        
        var findFullName = (arr, nm) => arr.find(o => o.fullName === nm);
        res = findFullName(p, env);
        if(res === undefined) return null;
        if (!name) return res;
        
        var ancestry = parseRObjectName(name);
        var res1;
        p = res;
        for(let k = ancestry.length - 1; k >= 0; --k) {
           res1 = findFullName(p.children, ancestry[k]);
           if(res1 === undefined) return null;
           p = res1;
        }
        return p;
    };
    
    var _storedSelection;
    var saveSelection = () => {
        var vd = this.visibleData;
        _storedSelection = this.getSelectedRows().map(i => vd[i].id);
    };
    var restoreSelection = () => {
            if (!this.selection) return;
            this.selection.clearSelection();
            if (Array.isArray(_storedSelection) && _storedSelection.length > 0) {
                let vd = this.visibleData;
                // TODO: use findIndex
                for (let j = 0; j < _storedSelection.length; ++j) 
                    for (let i = 0; i < vd.length; ++i)
                        if (_storedSelection[j] === vd[i].id) {
                            this.selection.toggleSelect(i);
                            break;
                        }
            }
        };

    var parseObjListResult = (data, rebuild, scrollToRoot) => {

        //logger.debug("parseObjListResult: \n" + data.replace(/[^\w ]/g, "."));
        //var closedPackages = {};
        // var currentPackages = _this.treeData.map(x => {
            // closedPackages[x.name] = !x.isOpen;
            // return x.name;
        // });
        
        var topLevelItemIsClosed = {};
        for(let i = 0; i < _this.treeData.length; ++i)
            topLevelItemIsClosed[_this.treeData[i].name] =  !_this.treeData[i].isOpen;
        var currentTopLevelItems = Object.keys(topLevelItemIsClosed);

        if (rebuild) _this.treeData.splice(0);

        saveSelection();

        var lastAddedRootElement;
        data = data.trim();
        if (!data) return;
        var lines = data.split(/[\r\n]{1,2}/);

        const LF = { Env: 0, Obj: 1, Data: 2 };
        var lookFor = LF.Env;

        // debug:
        //var prettyLine = l => l.replace(new RegExp(sep, "g"), "·")
        //    .replace(new RegExp(recordSep, "g"), "\n")
        //    .substring(0, 100);

        let branch, envName, objName;
        for (let i = 0; i < lines.length; ++i) {
            let itemConsumed = false;
            //logger.debug(
            //    `parseObjListResult: \nline ${i}, looking for ${['env', 'obj', 'data'][lookFor]} in: \n` +
            //    prettyLine(lines[i]));

            // TODO Env= Obj=objname[start:end]
            //      /\[(\d+):(\d+)\]$/
            //      ... ... NNNN <truncated> r
            switch (lookFor) {
            case LF.Env:
                if (lines[i].indexOf("Env=") != 0) break;
                envName = lines[i].substr(4).trim();
				if(_this.evalEnv.name && envName == "getEvalEnv()")
					 envName = _this.evalEnv.name;
				
                lookFor = LF.Obj;
                itemConsumed = true;
                break;
            case LF.Obj:
                if (lines[i].indexOf("Obj=") != 0) break;
                objName = lines[i].substr(4).trim();
                branch = getBranchByName(objName, envName);
                logger.debug(
                    `parseObjListResult: \nfound Obj="${objName}", Env="${envName}". Exists in tree: ${branch? 'yes' : 'no'}`
                );
                if (!branch && !objName) { // This is environment
                    branch = new RObjectItem(envName, false);
                    _this.treeData.push(branch);
					logger.debug("parseObjListResult: adding new top-level item: " + branch.name + "\n" +
						"treeData = " + _this.treeData.map(x => x.name).join("; "));
                    if (currentTopLevelItems.indexOf(envName) == -1)
                        lastAddedRootElement = branch;
                }
                if (branch) {
                    //var isEmpty = (lines.length == i + 2) || (lines[i + 2].indexOf('Env') == 0);
                    if (!objName) { // XXX: one-liner
                        if (topLevelItemIsClosed[envName]) branch.isOpen = false;
                    } else branch.isOpen = true;
                
                    branch.children = []; 
                    // XXX: skip if Appending
                    // XXX: There will be problems with appending on refresh
                    //      how to tell the desired object length to return?
                    
                    branch.childrenLoaded = true;
                    lookFor = LF.Data;
                } else lookFor = LF.Env; // this object is missing, skip all children
                itemConsumed = true;
                break;
            case LF.Data:
                if (lines[i].indexOf("Env=") === 0) { // previous Env is empty
                    lookFor = LF.Env;
                    --i;
                    break;
                }
                if (!lines[i].contains(sep)) break;
                try {
                    let objlist = lines[i].split(recordSep);
					let leaf;
                    for (let k = 0; k < objlist.length; ++k) {
                        if (objlist[k].length === 0) break;
                        leaf = new RObjectItem(envName, true, objlist[k].split(sep), k /* or i?*/,
                            branch);
                        branch.children.push(leaf);
                    }
                    logger.debug(`parseObjListResult: \nfound data n=${objlist.length}`);
                } catch (e) {
                    logger.exception(e);
                }

                itemConsumed = true;
                lookFor = LF.Env;
                break;
            default:
            } // switch lookFor
            if (!itemConsumed) logger.warn(`parseObjListResult: skipped item[${i}]: \n${lines[i]}`);
        } // for i

        cleanupObjectLists();
        //_this.sort(null, null); // .index'es are generated here

        if (scrollToRoot && lastAddedRootElement) { //only if rebuild, move the selection
            let idx = lastAddedRootElement.index;
            if (idx != -1) {
                //_this.treeBox.ensureRowIsVisible(idx);
                _this.treeBox.scrollToRow(Math.min(idx, _this.rowCount - _this.treeBox.getPageLength()));
                _this.selection.select(idx);
            }
        }
        restoreSelection();
		
		logger.debug("parseObjListResult: \n" + "treeData = " + _this.treeData.toString());
		
    };
    
    RConn.defineResultHandler('rob.parseObjListResult', parseObjListResult, false, true);

    this.getOpenItems = function () {
        let vd = _this.visibleData;
        let ret = [];
        for (let i = 0; i < vd.length; ++i)
            if (_this.isContainerOpen(i)) {
                let oi = vd[i].origItem;
                let env = oi.env || oi.fullName;
                let objName = oi.type == "environment" ? "" : oi.fullName;
                ret.push([env, objName]);
            }
        return ret;
    };

    Object.defineProperties(this, {
        'listAllNames': {
            get: () => _listAllNames,
            set: function (val) {
                _listAllNames = Boolean(val);
                _this.refresh();
            },
            enumerable: true
        },
        'listFuncBody': {
            get: () => _listFuncBody,
            set: function (val) {
                _listFuncBody = Boolean(val);
                _this.refresh();
            },
            enumerable: true
        },
        'listAttributes': {
            get: () => _listAttributes,
            set: function (val) {
                _listAttributes = Boolean(val);
                _this.refresh();
            },
            enumerable: true
        },  
    });
    
    // begin instaPack
    RConn.defineResultHandler("rob.instaPackRefresh", (output) => {
        var pkgNames = output.split(" ");
        var list = document.getElementById("robInstalledPackagesList");
        var selectedName = list.selectedItem ? list.selectedItem.value : null;
        list.removeAllItems();
        for (let a of pkgNames) list.appendItem(a, a);
        if(selectedName) list.selectedIndex = pkgNames.indexOf(selectedName);
        var box = document.getElementById("robInstalledPackagesBox");
        for (let el of box.childNodes) el.removeAttribute("disabled");
    }, false, true);    
    
    this.instaPackRefresh = function(state) {
        logger.debug("[Rbrowser.instaPackRefresh]");
    	if (state) {
            // skip loaded packages, update on searchPath refresh
            RConn.evalAsync("kor::.instapack()", "rob.instaPackRefresh", true);
    	} else {
    		let box = document.getElementById("robInstalledPackagesBox");
    		for (let el of box.childNodes) el.setAttribute("disabled", "true");
    	}
    };
    
    this.instaPackLoadSelected = function() {
        var list = document.getElementById("robInstalledPackagesList");
        RConn.evalAsync("base::library(" + R.arg(list.selectedItem.value) + ")",
            () => _this.searchPath.refreshAsync());
    };

    this.instaPackListKeyEvent = function(event) {
    	let listbox = event.target;
  
        let onItemSelect = (listbox, event, idx) => {
            listbox.selectedIndex = idx;
            listbox.ensureIndexIsVisible(listbox.selectedIndex);
/* Error: TypeError: listbox.ensureIndexIsVisible is not a function */
            event.preventDefault();
        };

    	switch (event.key) {
    		case "End":
    			onItemSelect(listbox, event, listbox.itemCount - 1);
    			return;
    		case "Home":
    			onItemSelect(listbox, event, 0);
    			return;
    		case "Up":
    			/* falls through */
    		case "ArrowUp":
    			onItemSelect(listbox, event, (listbox.selectedIndex > 0) ?
    				listbox.selectedIndex - 1 : 0);
    			return;
    		case "Down":
    			/* falls through */
    		case "ArrowDown":
    			onItemSelect(listbox, event,
    				(listbox.selectedIndex < listbox.itemCount - 1) ?
    				listbox.selectedIndex + 1 : listbox.selectedIndex);
    			return;
            case "PageDown":
                onItemSelect(listbox, event, Math.min(listbox.itemCount - 1, listbox.selectedIndex + 25));
                return;
            case "PageUp":
                onItemSelect(listbox, event, Math.max(0, listbox.selectedIndex - 25));
                return;
    		default:
    			return;
    	}
    };
    // end instaPack

    this.refresh = function (force = false) {
		logger.debug("[Rbrowser.refresh]");
    	if(!require("kor/command").isRRunning) return;

        _this.searchPath.refreshAsync().then(() => {
            var cmd, init;
            init = !isInitialized || force || !_this.treeData.length || !_this.treeBox;
            if (init) {
                let globalEnvIdx = _this.searchPath.indexOf(rGlobalEnvStr);
                if (globalEnvIdx < 1)
                    cmd = makeObjListCommand(rGlobalEnvStr, "");
                else {
                    cmd = "";
                    for (let i = 0; i <= globalEnvIdx; ++i)
                        cmd += makeObjListCommand(_this.searchPath.getItemAtIndex(i).name, "") + "\n"; 
                }     
            } else {
                let spItems = _this.searchPath._data.map(a => a.name);
                let openItems = _this.getOpenItems() // [[env, fullName], ...]
                    .filter(a => spItems.indexOf(a[0]) != -1);
                let topItems = _this.treeData.map(x => [x.fullName, ""])
                    .filter(a => spItems.indexOf(a[0]) != -1);

                let allItems = openItems.concat(topItems);
                let map = new Map(allItems.map(x => [x.join("::"), x])); // unique values
                let cmdArr = [];
                for (let [k, v] of map.values()) cmdArr.push(makeObjListCommand(k, v));
                cmd = cmdArr.join("\n");
            }
            if (init) {
                let thisWindow = self;
                if (thisWindow.location.pathname.indexOf("komodo.xul") !== -1)  // in main window
                    thisWindow = document.getElementById("robViewbox").contentWindow;
                thisWindow.document.getElementById("rob_objects_tree").view = _this;
            }
            
            //RConn.evalAsync(cmd, parseObjListResult, true);
            RConn.evalAsync(cmd, 'rob.parseObjListResult', true);
            setTimeout(_this.instaPackRefresh, 2500, true); // XXX: should happen afterwards
            isInitialized = true;
        }).catch((e) => logger.exception(e));
    };
    
    var removeObjectList = (pack) => {
        //if (pack === evalEnvName)
            //pack = _this.evalEnv.name;
        for (let i = 0; i < _this.treeData.length; ++i)
            if (_this.treeData[i].name === pack) {
                _this.treeData.splice(i, 1);
                break;
            }
        cleanupObjectLists();
        //createVisibleData();
    };

    var addObjectList = (env, objName = "") => {
        // if no object name - adding a package and scroll to its item
        logger.debug(`[addObjectList] ${env}, ${objName}\n${makeObjListCommand(env, objName)} \n`);
        cleanupObjectLists();
        RConn.evalAsync(makeObjListCommand(env, objName), 'rob.parseObjListResult', true,
            /*args for parseObjListResult = */ false, !objName  /* = scrollToRoot*/ );
        //RConn.evalAsync(makeObjListCommand(env, objName), parseObjListResult,
            //RConn.HIDDEN | RConn.STDOUT,
            ///*args for parseObjListResult = */ false, !objName  /* = scrollToRoot*/ );
    };
    
    

    // filtering by exclusion: prepend with "~"
    var _getFilter = () => {
        var tb = document.getElementById("rob_filterbox");
        var obRx, text, not;
        text = tb.value;
        not = (text[0] == "~");
        if (not) text = text.substr(1);
        if (!text) return ( /*x*/ ) => true;
        try {
            obRx = new RegExp(text, "i");
            tb.className = "";
            if (not) return x => !(obRx.test(x));
            else return x => obRx.test(x);
        } catch (e) {
            tb.className = "badRegEx";
            return x => (x.indexOf(text) != -1);
        }
    };

    this.applyFilter = function () { // keep as a method
        _this.filter = _getFilter();
        createVisibleData();
    };

    this.filter = ( /*x*/ ) => true;

    this.sort = function sort(column, root) {
        var columnName, currentElement, tree, sortDirection, realOrder, order,
            sortDirs;
        tree = document.getElementById("rob_objects_tree");
        sortDirection = tree.getAttribute("sortDirection");
        sortDirs = ["descending", "natural", "ascending", "descending"];
        realOrder = sortDirs.indexOf(sortDirection) - 1;

        try {
            currentElement = this.visibleData[this.selection.currentIndex].origItem;
        } catch (e) {
            currentElement = null;
        }
        if (currentElement) saveSelection();

        // If the column is passed and sort already done, reverse it
        if (column) {
            columnName = column.id;
            if (tree.getAttribute("sortResource") == columnName)
                realOrder = ((realOrder + 2) % 3) - 1;
            else
                realOrder = 1;
        } else
            columnName = tree.getAttribute("sortResource");


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
                if (Array.isArray(arr[i].children))
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

        if (!root || root === _this.treeData) {
            // Sort packages always by name
            _this.treeData.sort(_sortComparePkgs);
            for (let i = 0; i < _this.treeData.length; ++i) {
                if (Array.isArray(_this.treeData[i].children))
                    _sortRecursive(_this.treeData[i].children);
    
            }
        } else if (root.children) _sortRecursive(root.children);

        createVisibleData();

        if (currentElement) {
            this.selection.select(currentElement.index);
            this.treeBox.ensureRowIsVisible(currentElement.index);
            restoreSelection();
        }
    };
    
    this.canFoldAll = () => {
        if (!_this.rowCount) return 0;
        var idx = _this.selection.currentIndex;
        if (idx === -1) idx = 0;
        var curItem = _this.visibleData[idx].origItem;
        /* Error: TypeError: _this.visibleData[idx] is undefined */
        var parentObject = curItem.parentObject;
        if (!parentObject) return 0;
        var siblings = parentObject.children ? parentObject.children : parentObject;
        return siblings.some(a => a.isRecursive && !a.isOpen) | (2 * siblings.some(a => a.isOpen));
    };

    this.foldAll = function(open) {
        if (!this.rowCount) return;
        var idx = this.selection.currentIndex;
        if (idx === -1) idx = 0;
        var curItem = this.visibleData[idx].origItem;
        var parentObject = curItem.parentObject;
        if (!parentObject) return;
        var siblings = parentObject.children ?
            parentObject.children : parentObject; // if an environment, take parentObject
        for (let i = 0; i < siblings.length; ++i)
            if (siblings[i].isOpen === open)
                this.toggleOpenState(siblings[i].index);
    
    };

    this.toggleOpenState = function (idx) {
        var vd = this.visibleData, vd2;
        var item = vd[idx], iLevel = item.level, rowsChanged, insertItems = [];

        if (!item) return;

        // XXX: update already loaded children?
        _this.selection.select(idx);
        if (item.isList && !item.origItem.isOpen && !item.origItem.childrenLoaded) {
            addObjectList(item.origItem.env, item.origItem.fullName);
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
            if (typeof item.children === "undefined") item.addChildren(idx, false);

            // Filter child items
            for (let i = 0; i < item.children.length; ++i)
                insertItems.push(item.children[i]);

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
                (item.origItem.isOpen ? 1 : -1) * rowsChanged);
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
    this.getParentIndex = function (idx) idx in _this.visibleData ? _this.visibleData[idx].parentIndex :
        -1;
    this.getLevel = function (idx) _this.visibleData[idx].level;
    this.hasNextSibling = function (idx /*, after*/ ) !_this.visibleData[idx].last;
    // TODO: method of VisibleItem
    
    this.getImageSrc = function (row, col) {
        if (col.index === 0) {
            let name = _this.visibleData[row].imageName;
            return imagePrefix + name + ".svg" + svgParams;
        } else return "";
    };
    
    this.getCellValue = function ( /*idx, column*/ ) 1;
    this.getColumnValue = function ( /*idx, column*/ ) 1;
    this.cycleHeader = function ( /*col, elem*/ ) {};
    this.selectionChanged = function () {};
    this.cycleCell = function ( /*idx, column*/ ) {};
    this.performAction = function ( /*action*/ ) {};
    this.performActionOnCell = function ( /*action, index, column*/ ) {};

    // this works only on Komodo >= 9 (Gecko 22)
    this.getRowProperties = function (idx) {
        if (!(idx in _this.visibleData)) return null;
        let item = _this.visibleData[idx];
        let origItem = item.origItem;
        return "type-" + origItem.type +
           //" class-" + getClassName(origItem) + 
           (origItem.isHidden ? " hidden" : "") + 
           (item.last ? " lastChild" : "") +
           (item.first ? " firstChild" : "");
    };

    this.getCellProperties = function (idx, column) {
        let item = _this.visibleData[idx];
        let origItem = item.origItem;
        return (column.index === 0 ? "icon" : "") +
            " type-" + origItem.type +
            //" class-" + getClassName(origItem) +
            " group-" + (origItem.group || origItem.className) +
            " col-" + column.id +
            (origItem.isAttribute? " attr" : "") +
            (item.isContainerEmpty ? " empty" : "") +
            (origItem.isHidden ? " hidden" : "");
    };
    
    this.getColumnProperties = function ( /*column, element, prop*/ ) {};

    this.getSelectedRows = function () {
            if (!_this.selection) return [];
            let start = {}, end = {}, rows = [];
            let numRanges = _this.selection.getRangeCount();
            for (let t = 0; t < numRanges; ++t) {
                _this.selection.getRangeAt(t, start, end);
                if (start.value < 0) continue;
                for (let v = start.value; v <= end.value; ++v)
                    rows.push(v);
            }
            return rows;
    };
    
    //var searchPathDropTarget = null;
    var setSearchPathDropTarget = (element, remove) => {
        if(element.label === "package:base") element = element.previousElementSibling;
        //if (searchPathDropTarget && searchPathDropTarget !== element)
        if (remove) {
           element.classList.remove("dragTarget");
        } else {
           element.classList.add("dragTarget"); 
        }
    };

    // Drag'n'drop support
    this.draghandlers = {
        onDragStart(event) {
            if (_this.rowCount === 0) return;
            //_this.onEvent(event);
            var namesArr = _this.getSelectedNames(event.ctrlKey, event.shiftKey);
            event.dataTransfer.setData("text/plain", namesArr.join(', '));
            event.dataTransfer.effectAllowed = "copy";
        },
        onDragEnd(event) {
            event.preventDefault();
        },
        onDrop(event) {
            event.preventDefault();
            var data = event.dataTransfer;
            if (data.types == null) return;
            if (data.types.contains("text/plain")) {
                let text = data.getData("text/plain").trim();
                let pos = _this.searchPath.indexOf(text);
                if (pos == -1) return;
                document.getElementById("rob_searchpath_listbox").getItemAtIndex(pos).checked =
                    true;
                addObjectList(text);
            } else if (data.types.contains("Files")) {
                // TODO check if RData and load/attach?
                //nsIFile
                //text/x-moz-url, text/uri-list, text/plain, application/x-moz-file, Files
            }
        },
        onDragOver(event) {
            // TODO
            var dataTypes = event.dataTransfer.types;
            if (!dataTypes.contains("text/plain") && !dataTypes.contains("text/x-r-package-name"))
                dataTypes.effectAllowed = "none";
        },

		onSearchPathDragEnter(event) {
			if(!event.relatedTarget || document.getBindingParent(event.relatedTarget) === event.target)
				return;
            setSearchPathDropTarget(event.target);
		},
		onSearchPathDragLeave(event) {
			if(!event.relatedTarget || document.getBindingParent(event.relatedTarget) === event.target)
				return;
			setSearchPathDropTarget(event.target, true);
		},		
		
        onSearchPathDrop(event) {
			let el = event.target;
            setSearchPathDropTarget(el, true);
			
			let data = event.dataTransfer;
            let filePath, text;
            if (data.types.contains("application/x-moz-file")) {
                filePath = data.getData("application/x-moz-file").path;
            } else if (data.types.contains("text/plain")) {
                filePath = String(data.getData("text/plain")).trim();
                if (!fileUtils.exists(fileUtils.path(filePath))) {
                    text = filePath;
                    filePath = null;
                }
            } /// else  if (data.contains("Files")) {
            
			try {
				if(el._isEvalEnv) el = el.nextElementSibling;
				if(el.label === rGlobalEnvStr) el = el.nextElementSibling;
			} catch(e) {
				el = null;
			}
			var pos = el && el.label ? el.label : 2;

            // Attach the file if it is an R workspace
            if (filePath && /\.RData$/i.test(filePath)) {
                R.loadWorkspace(filePath, (message) => {
                    _this.searchPath.refresh();
                    UI.addNotification("Upon attaching the workspace \"" + filePath +
                        "\", R said: " + message);
                }, pos);
				
				event.preventDefault();
                event.stopPropagation();
				
            } else if (text) {
                if (!/^(package:)?[a-zA-Z0-9\._]+$/.test(text))
                    return;
                if (text.startsWith("package:"))
                    text = text.substring(8);
				
				event.preventDefault();
				
                RConn.evalAsync("kor::doCommand(\"library\", " + R.arg(text) + ", " + 
				    R.arg(pos) + ")",
                    (message) => {
                        let pos;
                        if ((pos = message.indexOf('<error>')) > -1) {
                            message = message.substring(pos + 7);
                        } else  _this.searchPath.refresh();
                        if (message)
                            UI.addNotification("Upon loading the library \"" + text +
                                "\", R said: " + message);
                    }, RConn.HIDDEN); // not using autoupdate - always need to update
            }
        },
        onSearchPathDragStart(event) {
            if (event.target.tagName !== 'richlistitem') {
				logger.debug("searchPath dragstart: item=" + event.target.tagName);
                return;
			}

            let text = _this.searchPath.getItemAtIndex(
				//document.getElementById("rob_searchpath_listbox").selectedIndex
				event.target.parentElement.getIndexOfItem(event.target)
				).name;
            event.dataTransfer.setData("text/plain", text);
            event.dataTransfer.effectAllowed = "copy";
            return;
        },
		
        onSearchPathDragOver(event) {
            // TODO
            let dataTypes = event.dataTransfer.types;
            if (!dataTypes.contains("text/plain") &&
                !dataTypes.contains("text/x-moz-file") &&
                !dataTypes.contains("text/x-r-package-name")
            )
                event.dataTransfer.effectAllowed = "none";
        }
    };
    
    this.canDrop = function () false;
    this.drop = function ( /*idx, orientation*/ ) {};
    
    this.clearAll = function () {
        if (!isInitialized) return;
        
        _this.searchPath.clear();
        _this.instaPackRefresh(false);
        //_this.displayPackageList();      
        
        let rowCount = _this.visibleData.length;
        _this.visibleData.splice(0);
        _this.treeData.splice(0);
        let treeBox = _this.treeBox;
        if (!treeBox) return;
        treeBox.beginUpdateBatch();
        treeBox.invalidateRange(treeBox.getFirstVisibleRow(), treeBox.getLastVisibleRow());
        treeBox.rowCountChanged(0, -rowCount);
        treeBox.endUpdateBatch();
        //document.getElementById("rob_objects_tree").disabled = true;
    };

    this.searchPathToggleView = function () {
        var button = document.getElementById("robSubpanelToggle");
        var deck = document.getElementById("robSubpanelBox");
        var state = button.getAttribute("state");
        switch (state) {
        case "collapsed":
            button.setAttribute("state", "open");
            deck.collapsed = false;
            _this.refresh();
            break;
        case "open":
            /* falls through */
        default:
            button.setAttribute("state", "collapsed");
            deck.collapsed = true;
            break;
        }
    };

    // Change the display status of a package by clicking an item in the list
    this.packageSelectedEvent = function (event) {
        logger.debug("packageSelectedEvent: target.id=" + event.target.id + " [" + event.target.tagName + "]");
        var el = event.target;
        var pack = el.label;
        if (!pack) return;
        if (el.checked) addObjectList(pack);
        else removeObjectList(pack);
    };

    this.selectedItemsOrd = [];
    
    this.removeSelected = function (doRemove) {

        var items = Array.from(_this.selectedItemsOrd);
        if (items.length === 0) return false;
        
        var lastSelectedRow = items[items.length - 1].index;
        items = items.filter(o => /*o.type !== "args" &&*/
            (o.type !== "environment" || !R.nonDetachable.has(o.name)) && !o.isInPackage);
        items = items.filter(a => items.findIndex(b => a.isChildOf(b)) === -1);
        
        let objToRm = {}, cmdDetach = [], cmdRm, cmdRmElement = [];
        let findIndex = (item, a) => a.findIndex(o => o === item);
        
        // sort by level and position, i.e. // x[[5]][[3]] -> x[[5]][[1]] -> x[[4]] -> x[[2]]
        let sortComp = (a, b) => {
            if (a.sortData[5] > b.sortData[5]) return -1;
            if (a.sortData[5] < b.sortData[5]) return 1;
            if (a.sortData[4] > b.sortData[4]) return -1;
            if (a.sortData[4] < b.sortData[4]) return 1;
            return 0;
        };
        items.forEach(o => { o.sortData[5] = o.getLevel(); });
        items = items.sort(sortComp);
        
        for (let i = 0; i < items.length; ++i) {
            let item = items[i];
            if (item.type === "environment") {
                let k = findIndex(item, _this.treeData);
                if (k !== -1) _this.treeData.splice(k, 1);
                cmdDetach.push(
                    item.isCurrentEvalEnv ? "kor::koBrowseEnd()" :
                        `base::detach(${R.arg(item.name)}, unload=TRUE)`
                               );
            } else {
                if (item.type === "object") {
                    if(Array.isArray(objToRm[item.env])) objToRm[item.env].push(item.name);
                        else objToRm[item.env] = [item.name];
                } else if (item.type === "sub-object" || item.type === "args")
                    cmdRmElement.push(
                        `kor::rmElement(${item.getFullName}, ${R.arg(item.env)})`);

                let siblings = item.parentObject.children;
                siblings.splice(findIndex(item, siblings), 1);
            }
        }

        cmdRm = Object.keys(objToRm).map(i =>
            `base::rm(list=${R.arg(objToRm[i])}, pos=${i === _this.evalEnv.name ? "kor::getEvalEnv()" : R.arg(i)})`);
        
        let cmd = Array.concat(cmdDetach, cmdRm, cmdRmElement);
        
        createVisibleData();

        if (!cmd.length) return false;

        if (doRemove) {
            // Remove immediately
            RConn.evalAsync(cmd.join("\n"), (/*res*/) => {
                if (cmdDetach.length) _this.refresh();
            }); // XXX RConn.AUTOUPDATE
        } else {
            // Insert commands to current document
            let view = require("ko/views").current();
            if (!view) return false;
            let scimoz = view.scimoz;
            let nl = ";" + UI.eOLChar(scimoz);
            scimoz.scrollCaret();
            scimoz.insertText(scimoz.currentPos, cmd.join(nl) + nl);
        }

        _this.selection.select(Math.min(lastSelectedRow, _this.rowCount - 1));
        //_this.selection.clearSelection();
        return true;
    };
    
    this.getSelectedNames = function (fullNames, extended = false) {
        let namesArr = [], text, item, modif;
        if (extended && !fullNames)
            modif = dQuote;
        else if (extended && fullNames)
            modif = (s, item) => {
                if (item.group === "function") s += "()";
                else if (item.type === "args") s += "="; // Attach '=' to function args
                return s;
            };
        else modif = (s) => s;

        let getName;
        if (fullNames && !extended)
            getName = item => item.getFullName;
            else
            getName = item => item.name;
        
        let selectedItemsOrd = _this.selectedItemsOrd;
        for (let i = 0; i < selectedItemsOrd.length; ++i) {
            item = selectedItemsOrd[i];
            text = getName(item);
            if (text) namesArr.push(modif(text, item));
        }
        return namesArr;
    };

    this.insertName = function(fullNames, extended) {
        // TODO: `quote` non-syntactic names of 1st level (.type = 'object')
        // extended mode: object[c('sub1', 'sub2', 'sub3')]
        var view = require("ko/views").current();
        if (!view) return;
        var text = _this.getSelectedNames(fullNames, extended).join(', ');
        var scimoz = view.scimoz;
        if (!scimoz) return;
        var length = scimoz.length;
    
        if (/^[\w\.\u00C0-\uFFFF"'`,\.;:=]$/
            .test(scimoz.getWCharAt(scimoz.selectionStart - 1)))
            text = " " + text;
        if (/^[\w\.\u00C0-\uFFFF"'`]$/
            .test(scimoz.getWCharAt(scimoz.selectionEnd)))
            text += " ";
    
        scimoz.insertText(scimoz.currentPos, text);
        scimoz.currentPos += scimoz.length - length;
        scimoz.charRight();
    };

    this.setFilterBy = function (menuItem, column) {
        var newFilterBy = ['name', 'dims', 'class', 'group', 'fullName']
            .indexOf(column);
        if (newFilterBy === -1) return;
        if (newFilterBy !== filterBy) {
            filterBy = newFilterBy;
            this.applyFilter();
        }
        var filterBox = document.getElementById("rob_filterbox");
        filterBox.emptyText = menuItem.getAttribute("label") + "...";
        filterBox.focus();

        return;
    };

    this.contextOnShow = function (event) {
        var currentIndex = _this.selection.currentIndex;
        if (currentIndex === -1) return;

        var item = _this.visibleData[currentIndex].origItem;
        
        // Help can be shown only for one object:
        var menuItems = event.target.childNodes;
        var testDisableIf, disable;
        for (let i = 0; i < menuItems.length; ++i) {
            if (!menuItems[i].hasAttribute('testDisableIf')) continue;
            testDisableIf = menuItems[i].getAttribute('testDisableIf').split(/\s+/);
            disable = false;
            for (let j = 0; j < testDisableIf.length && !disable; ++j) {
                switch (testDisableIf[j]) {
                case 't:multipleSelection':
                    disable = _this.selection.count !== 1;
                    break;
                case 't:isFunction':
                    disable = item.className === "function";
                    break;
                case 't:isEnvironment':
                    disable = item.className === "package" || item.className === "environment";
                    break;
                case 't:isPackage':
                    disable = item.isPackage;
                    break;
                case 't:noPrint':
                    disable = false; //item.isTopLevelItem;
                    break;
                case 't:noDelete':
                    disable = (item.isTopLevelItem && R.nonDetachable.has(item.fullName)) || item.isInPackage;
                    break;
                case 't:noHelp':
                    disable = !(item.isPackage || (item.isInPackage && item.type === "object" && !item.isHidden));
                    break;
                case 't:noSaveToFile':
                    disable = ["data.frame", "matrix", "table"].indexOf(item.className) === -1;
                    break;
                case 't:noPlot':
                    disable = item.isPackage || ["language", "function"].indexOf(item.group) !== -1;
                    break;
                case 't:noSave':
                    disable = _this.selectedItemsOrd.findIndex((item) => item.type == 'object') == -1;
                    break;
                case 't:notViewable':
                    disable = !item.isRecursive || !(/^\d+x\d+$/.test(item.dims));
                    break;
                default:
                    break;
                }
            }
            menuItems[i].setAttribute('disabled', disable);
        }
    };
    
    this.loadSelectedPackage = function() {
    	var list = document.getElementById("robInstalledPackagesList");
        if(!list.selectedItem.value) return;
    	R.evalAsync("base::library(" + R.arg(list.selectedItem.value) + ")");
    };   
    
    this.doRCommand = function (action, ...args) {
        switch (action) {
        case "browse-end":
             R.endBrowse();
             break;
        case "detach":
            if (!args) return;
            R.detach(args[0]);
            break;
        default:
            break;
        }
    };

    const clipboardHelper = 
        Components.classes['@mozilla.org/widget/clipboardhelper;1']
            .getService(Components.interfaces.nsIClipboardHelper);

    // XXX: dims property is a string 
    var rEnvir = (n, prefix = "") => {
        var off = _this.evalEnv.name ? 0 : 1;
        switch(String(n)) {
            case "0":
                return ""; // current environment, no need to specify
            case "1": 
                if(!off) return prefix + rGlobalEnvStr; 
                /* falls through */
            default:
                return prefix + "base::as.environment(" + 
                    (parseInt(n) + off) + ")";
        }
    };    
    
    this.treeItemCommand = function (action) {
        var items = Array.from(_this.selectedItemsOrd);
        //let command;
        switch (action) {
        case 'save':
            // Select only objects:
            items = items.filter(x => {
                if (x.type !== "object") {
                    _this.selection.toggleSelect(x.index);
                    return false;
                } else return true;
            });

            let fileName = items.length == 1 ? items[0].name
                .replace(/[\/\\:\*\?"<>\|]/g, '_') : '';
            
            let robj = new Map();
            //let posoff = _this.evalEnv.name ? 0 : 1;
            let key;
            for (let it of items) {
                // key = parseInt(it.getTopParent.parentObject.dims) + posoff;
                key = it.getTopParent.parentObject.dims;
                if (!robj.has(key)) robj.set(key, []);
                robj.get(key).push(it);
            }
            let moreEnvironments = Array.from(robj.keys()).length > 1;
            if(moreEnvironments &&
               !require("ko/dialogs").confirm("Objects from different " +
                    "environments will be saved into separate files. " +
                    "The environment index will be appended to file names.",
                    {response: "Cancel", title: "R interface: save R objects",
                        icon: "warning"}))
                    return;

            RConn.evalAsync("base::cat(base::getwd())", (output, fileName, robj)=> {
            	var dir;
                try {
            		dir = fileUtils.path(output);
            	} catch (e) {
            		logger.exception(e, "in 'treeItemCommand'");
            		return;
            	}
                if (!dir) return;
                var oFilterIdx = {};
                fileName = UI.browseForFile(dir, fileName + '.RData', '',
                    ["R data (*.RData)|*.RData"], false,
                    true, oFilterIdx);
                if (!fileName) return;
                
                var rCommand;
                                
                if(moreEnvironments) {
                   let rCommands = []; 
                   for (let [key, value] of robj) rCommands.push(
                        "base::save(list=" +
                        R.arg(value.map(x => x.name)) +
                        rEnvir(key, ", envir=") +
                        ", file=" + R.arg(fileName.replace(/(\.([^\.]+)|)$/,
                            "[" + key + "]$1")) +
                        ")");
                    rCommand = rCommands.join("\n");
                } else {
                    let [key, value] = robj.entries().next().value;
                    rCommand = "base::save(list=" +
                          R.arg(value.map(x => x.name)) +
                          rEnvir(key, ", envir=") +
                          ", file=" + R.arg(fileName) + ")";
                } 
                RConn.evalAsync(rCommand);
            }, RConn.HIDDEN | RConn.STDOUT, fileName, robj);

            //Services.koOs.path.relpath(path, cwd)
            break;
        case 'help':
            let item = items[0]; // help only for first item    
            // Help only for packages and objects inside a package
            // TODO: help for packages, package argument for R.help
            if (item.isPackage)
                R.help(item.name.replace(/^package:/, '') + "-package");
            else if (item.isInPackage)
                R.help(item.name, item.env.replace(/^package:/, ''));
           
            break;
        //TODO: dump data for objects other than 'data.frame'
        case 'write.table':
        case 'writeToFile':
            for (let i = 0; i < items.length; ++i)
                R.saveDataFrame(items[i].rExpression, '', items[i].name);
            break;

        case 'view.table':
            R.viewTable(items[0].rExpression);
            break;
            
        case 'copyToClipboard':
            clipboardHelper.copyString(items.map(a => a.getFullName).join(copyToClipboardSep));        
            break;

            // Default is to just execute command and display results
        case 'summary':
        case 'plot':
        case 'str':
        case 'names':
            /* falls through */
        default:
            let commandArr = [];
            for (let i in items)
                if (items.hasOwnProperty(i)) {
                    /*cmd.push(action + "(evalq(" + obj[i].fullName +
                    ", envir = base::as.environment(\"" +
                    obj[i].env. !!!addslashes() + "\")))");*/
                    commandArr.push(action + "(" + items[i].rExpression + ")");
                }
            R.evalUserCmd(commandArr.join("\n"));
        }
    };

    this.onEvent = function onEvent(event) {
        switch (event.type) {
        case "select":
            let selectedRows = _this.getSelectedRows();

            if (selectedRows.some(x => x >= _this.visibleData.length))
                return false;

            let selectedItems = [];
            for (let i = 0; i < selectedRows.length; ++i)
                selectedItems.push(_this.visibleData[selectedRows[i]].origItem);

            let newItems = _this.selectedItemsOrd.filter(item => selectedItems.indexOf(item) !== -1)
                .concat(selectedItems.filter(item => _this.selectedItemsOrd.indexOf(item) === -1));

            //A.filter(item => B.has(item)));
            //B.filter(item => !A.indexOf(item)));

            _this.selectedItemsOrd.splice(0);
            Array.prototype.push.apply(_this.selectedItemsOrd, newItems);
            
            
            // enable/disable foldAll buttons can-open, can-close
            let test = _this.canFoldAll();
            document.getElementById("rob_foldAll_button").disabled =
                (test & 2) === 0;
            document.getElementById("rob_ExpandAll_button").disabled =
                (test & 1) === 0;
            
            return false;
        case "keyup":
        case "keypress":
            let key = event.keyCode ? event.keyCode : event.charCode;
            switch (key) {
            case 46: // Delete key
                //_this.removeSelected(event.shiftKey);
                _this.removeSelected(true);
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
                return false;
            case 67: // Ctrl + C
            case 99: // Ctrl + c
                if (event.ctrlKey && !event.shiftKey) 
                    _this.treeItemCommand("copyToClipboard");
                return false;
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
            case 112: // F1
                event.preventDefault();
                if(!event.shiftKey) return false;
                
                let currentIndex = _this.selection.currentIndex;
                if(currentIndex < 0 || currentIndex >= _this.visibleData.length)
                    return false;
                //if(selectedRows.length != 1) return false;
                let item = _this.visibleData[currentIndex].origItem;
                
                if(!(item.isPackage || (item.isInPackage && item.type === "object" && !item.isHidden)))
                   return false; 
                _this.treeItemCommand("help");
                return false;
            default:
                return false;
            }
            break;
        case "dblclick":
            if (event.button != 0) return false;
            if (_this.selection && (_this.selection.currentIndex === -1 ||
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
        //document.getElementById("rob_objects_tree").focus();
        event.originalTarget.focus();
        return false;
    };

    this.onSearchPathKeyEvent = function(event) {
    	let listbox = _this.searchPath.getListBox();
    	let target = event.originalTarget;

    	let onItemSelect = (listbox, event, idx) => {
    		listbox.selectedIndex = idx;
    		listbox.selectedItem._checkbox.focus();
    		listbox.ensureIndexIsVisible(listbox.selectedIndex);
    		event.preventDefault();
    	};

    	switch (event.key) {
    		case " ":
    			if (target.getAttribute("anonid") !== "checkbox") { // only handle this event when checkbox not in
    				// focus
    				let item = listbox.selectedItem;
    				item.check();
    				if (!item.label) return;
    				if (item.checked) addObjectList(item.label);
    				else removeObjectList(item.label);
    				return;
    			}
    			break;
    		case "Clear":
    			/* falls through */
    		case "Delete":
    			/* falls through */
    		case "Del":
    			let listItem = listbox.selectedItem;
    			if (listItem.hasAttribute("evalEnv"))
    				_this.doRCommand("browse-end");
    			else {
    				if (listItem._detachableItems && listItem._detachableItems.length !== 0)
    					_this.doRCommand("detach", event.shiftKey ?
    						listItem._detachableItems : listItem._detachableItems[0]);
    			}
    			return;
    			// for some reason arrow keys/home/end do not work by default, pgup/pgdown do.
    		case "End":
    			onItemSelect(listbox, event, listbox.itemCount - 1);
    			return;
    		case "Home":
    			onItemSelect(listbox, event, 0);
    			return;
    		case "Up":
    			/* falls through */
    		case "ArrowUp":
    			onItemSelect(listbox, event, (listbox.selectedIndex > 0) ?
    				listbox.selectedIndex - 1 : 0);
    			return;
    		case "Down":
    			/* falls through */
    		case "ArrowDown":
    			onItemSelect(listbox, event,
    				(listbox.selectedIndex < listbox.itemCount - 1) ?
    				listbox.selectedIndex + 1 : listbox.selectedIndex);
    			return;
    		default:
    			return;
    	}
    };

    this.selectAllSiblings = function(idx, augment) {
    	let startIndex = _this.visibleData[idx].parentIndex + 1,
    		endIndex;
    	let curLvl = _this.visibleData[idx].level;
    	for (endIndex = startIndex; endIndex < _this.visibleData.length &&
    		_this.visibleData[endIndex].level >= curLvl;
    		++endIndex) {}
    	--endIndex;
    	_this.selection.rangedSelect(startIndex, endIndex, augment);
    };

    this.focus = function() {
        _this.refresh();
    };

    this.toggleValue = function(event) {
        var control = event.target;
        var value = Boolean(control.getAttribute("checked"));
        var command = document.getElementById(control.observes);
        if(!command) throw new Error("event target observes no command");
        if (value) command.setAttribute("checked", "true");
            else command.removeAttribute("checked");
        var relpref = control.getAttribute("relatedpref");
        _this[relpref] = value;
    };
    
    this.toggleValues = function(event, relprefs) {
        var control = event.target;
        var command = document.getElementById(control.observes);
        if(!command) throw new Error("event target observes no command");
        var cmdset = command.parentNode;
        if(!cmdset || cmdset.tagName !== "commandset") return;
        if(!Array.isArray(relprefs)) throw new Error("command not in a commandset");
        var name, coll, el;
        var value = Boolean(control.getAttribute("checked"));
        if (value) command.setAttribute("checked", "true");
            else command.removeAttribute("checked");
        for(name of relprefs) {
            coll = cmdset.getElementsByAttribute("relatedpref", name);
            if(coll.length === 0) continue;
            el = coll[0];
            if(value) el.removeAttribute("disabled");
                else el.setAttribute("disabled", "true");
            _this[name] = value ? Boolean(el.getAttribute("checked")): false;
        }
    };
    
    this.isActive = function() {
        var viewbox = document.getElementById("rbrowserViewbox_rbrowser");
        return Boolean(viewbox) && viewbox.hasAttribute("active");
    };
    
    // activate(true) -> refresh(true); activate(false) -> clearAll()
    this.activate = function(state) {
        state = Boolean(state);
        logger.debug("Rbrowser.activate: start (state=", state, ")");
        var viewbox = document.getElementById("rbrowserViewbox_rbrowser");
        if (!viewbox || state == viewbox.hasAttribute("active")) return; // keep "=="
        var controls = document.getElementById("robToolbar").childNodes;
        if(state) {
            //_this.refresh(true);
            logger.debug("Rbrowser.activate: refreshing R browser");
            viewbox.setAttribute("active", "true");
            for(let el of controls) el.removeAttribute("disabled");
            setTimeout(() => {
			   logger.debug("Rbrowser.activate->on timeout (delayed refresh)");
			   _this.refresh(true); 
			   }, 256);
        } else {
            logger.debug("Rbrowser.activate: clearing R browser");
            _this.clearAll();
            viewbox.removeAttribute("active");
            for(let el of controls) el.setAttribute("disabled", "true");
        }
        logger.debug("Rbrowser.activate: end (active=" + this.isActive() + ")");

    };
    
    var onRStatusChange = function(event) {
        try {
			logger.debug("Rbrowser.onRStatusChange: " + event.detail.running);
            _this.activate(event.detail.running);
            if(event.detail.running)
                setTimeout(() => {
                    if(!require("kor/command").isRRunning) return;
                    if(!_this.isActive()) _this.activate(); // XXX: needed?
                    else _this.searchPath.refreshAsync();
                }, 2048);
         } catch(e) {
            logger.exception(e);
        }
    };
        
    this.onRCommandRequestEvent = function(event) {
        let commandType = event.detail.type;
        if (!commandType) throw(new Error("incomplete 'r_command_request' event"));
        logger.debug("received R command request event of type " + commandType);

        switch (commandType) {
            case "detach":
                if (event.detail.isEvalEnv)
                    R.endBrowse();
                else
                    R.detach(event.detail.name);
                break;
            default:
        }
    };
    
    var onREnvironmentChange = function(event) {
        logger.debug(
        `[onREnvironmentChange] Event type: ${event.type}`
        );
        var panel = require("ko/windows").getMain()
            .document.getElementById("robViewbox").parentElement;
        if(panel.parentNode.selectedPanel != panel) return;
        _this.refresh();
    };
    
    var autoUpdate, needUpdating = false;
    var autoUpdatePrefObserver = {
        observe(prefset, prefName, data) {
            logger.debug("setting R browser autoupdate");
            autoUpdate = prefset.getBooleanPref(prefName);
        }
    };
    var onREvalEnvChange = (/*event*/) => {
        needUpdating = true;
    };
    
    var onAutoUpdate = (event) => {
        if(!event.detail.autoUpdate) return;
        if(autoUpdate || needUpdating)
            onREnvironmentChange(event);
        needUpdating = false;
    };
    
    Components.classes["@mozilla.org/observer-service;1"]
        .getService(Components.interfaces.nsIObserverService)
        .addObserver({
            observe: (subject, topic, data) => {
                onAutoUpdate({detail: {autoUpdate: true}});
            }}, "file-reading-finished", false);
        
    this.onLoad = function(/*event*/) {
        logger.debug("Rbrowser.onLoad (R is " + 
			(require("kor/command").isRRunning ? "on" : "off") + ")");
        
		let _w = require("kor/main").mainWin;

		_w.addEventListener('r_status_change', onRStatusChange, false);
		_w.addEventListener('r_evalenv_change', onREvalEnvChange, false);
		_w.addEventListener('r_environment_change', onREnvironmentChange, false);
        window.addEventListener("r_command_request", _this.onRCommandRequestEvent, false);   

        // needed if rob widget is loaded after initial "r_status_change" event.
        let checkCounter = 0;
        let intervalID = setInterval(() => {
            let rIsOn = require("kor/command").isRRunning;
            logger.debug("Rbrowser.onLoad -> checking R connection[" + checkCounter + 
                "]: R is " + (rIsOn ? "on" : "off"));     
            if(rIsOn) {
                if(_this.isActive()) 
                    clearInterval(intervalID);
                else _this.activate(true);
            } else if(checkCounter++ > 5)
                clearInterval(intervalID);
 
        }, 1024);

        const prefs = require("ko/prefs");
        const auPrefName = "RInterface.rBrowserAutoUpdate";
		
		if(!prefs.hasBooleanPref(auPrefName))
			prefs.setBooleanPref(auPrefName, true);
        
        autoUpdate = prefs.getBooleanPref(auPrefName);
        
        if(autoUpdate) logger.debug("Rbrowser.onLoad: setting R browser autoupdate");
        
        require("kor/main").mainWin.addEventListener('r_command_executed',
                    onAutoUpdate, false);
        
        prefs.prefObserverService.addObserver(autoUpdatePrefObserver, auPrefName, true); 
    };
    window.addEventListener("DOMContentLoaded", this.onLoad.call(this), false);
	
    this.debug = {
        getSelProps(column = "r-name") {
            return _this.getCellProperties(_this.selection.currentIndex, _this.treeBox.columns[column]);
        },
        getSelObj() {
            if (_this.selectedItemsOrd.length === 0) return null;
            return _this.selectedItemsOrd[_this.selectedItemsOrd.length - 1];
        },
        createVisibleData: createVisibleData,
        cleanupObjectLists: cleanupObjectLists,
        getWindow: () => require("ko/windows").getWidgetWindows().find(x => x.name === "robViewbox"),
        imageMap: () => imageMap
    };

}).apply(rob);
