"use strict";

var CSV = {
    
    toString() "[object KorCSV]",

    CSVRow(rowArr, colNames, hasRowNames) {
        if (rowArr.length != colNames.length)
            throw new Error("Number of columns (" + rowArr.length +
                ") does not match the header (" + colNames.length + ").");
        for (let j = hasRowNames ? 1 : 0, k = rowArr.length; j < k; ++j)
            this[colNames[j]] = rowArr[j];
    },

    // parses CSV string to array of objects (column names -> property names)
    parse(data, delim, omitNRows = 0, hasHeader = false, colNames = undefined) {
        var arr = this.toArray(data, delim);
        var header = omitNRows ? arr.splice(0, omitNRows) : null;
        if (colNames === undefined) {
            colNames = arr[0];
            arr.shift();
        } else if (hasHeader)
            arr.shift();
        var res;
        if (!colNames[0]) {
            res = {};
            for (let i = 0, l = arr.length; i < l; ++i)
                res[arr[i][0]] = new this.CSVRow(arr[i], colNames, true);
        } else {
            res = new Array(arr.length);
            for (let i = 0, l = arr.length; i < l; ++i)
                res[i] = new this.CSVRow(arr[i], colNames, false);
        }
        return header ? [header, res] : res;
    },

    // From: http://www.bennadel.com/index.cfm?dax=blog:1504.view
    toArray(data, delim) {
        delim = (delim || ",");
        var objPattern = new RegExp((
            // Delimiters.
            "(\\" + delim + "|\\r?\\n|\\r|^)" +
            // Quoted fields.
            "(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
            // Standard fields.
            "([^\"\\" + delim + "\\r\\n]*))"
        ), "gi");
        var arrData = [ [] ];
        var arrMatches = objPattern.exec(data);
        var strMatchedValue;
        while (arrMatches) {
            var strMatchedDelimiter = arrMatches[1];
            if (strMatchedDelimiter.length && (strMatchedDelimiter !== delim))
                arrData.push([]);
            
            if (arrMatches[2])
                strMatchedValue = arrMatches[2]
                    .replace(new RegExp("\"\"", "g"), "\"");
            else 
                strMatchedValue = arrMatches[3];
            arrData[arrData.length - 1].push(strMatchedValue);
            arrMatches = objPattern.exec(data);
        }
        return arrData;
    }
};

if (typeof module === "object") {
    module.exports = CSV;
} else {
    this.EXPORTED_SYMBOLS = ["CSV"]; // jshint ignore: line
}

