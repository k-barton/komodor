/*  
 *  This file is a part of "R Interface (KomodoR)" add-on for Komodo Edit/IDE.
 *  Copyright (c) 2011-2017 Kamil Barton
 *  
 *  License: MPL 1.1/GPL 2.0/LGPL 2.1
 */

/* globals Components, sv */
 
sv.io = {};

(function(){

var _this = this;

function CSVRow(rowArr, colNames, hasRowNames) {
	if(rowArr.length != colNames.length)
		throw new Error("Number of columns (" +  rowArr.length +
			") does not match the header (" + colNames.length + ").");
	for(var j = hasRowNames ? 1 : 0, k = rowArr.length; j < k; j++)
		this[colNames[j]] = rowArr[j];
}
//CSVRow.prototype = {
//	toString: function() "[CSVRow1 Object]"
//}

this.csvToObj = function csvToObj(data, sep, omitNRows, hasHeader, colNames) {
	var arr = _this.csvToArray(data, sep);
	var header = omitNRows ? arr.splice(0, omitNRows) : null;
	if(colNames === undefined) {
		colNames = arr[0];
		arr.shift();
	} else if(hasHeader)
		arr.shift();
	var res;
	if(!colNames[0]) {
		res = {};
		for(var i = 0, l = arr.length; i < l; i++)
			 res[arr[i][0]] = new CSVRow(arr[i], colNames, true);
	} else {
		res = new Array(arr.length);
		for(let i = 0, l = arr.length; i < l; i++)
 			 res[i] = new CSVRow(arr[i], colNames, false);
	}
	return header? [header, res] : res;
};

// From: http://www.bennadel.com/index.cfm?dax=blog:1504.view
this.csvToArray = function CSVToArray(strData, strDelimiter){
	strDelimiter = (strDelimiter || ",");
	var objPattern = new RegExp((
		// Delimiters.
		"(\\" + strDelimiter + "|\\r?\\n|\\r|^)" +
		// Quoted fields.
		"(?:\"([^\"]*(?:\"\"[^\"]*)*)\"|" +
		// Standard fields.
		"([^\"\\" + strDelimiter + "\\r\\n]*))"
		), "gi");
	var arrData = [[]];
	var arrMatches = objPattern.exec(strData);
	 var strMatchedValue;
	while (arrMatches) {
		var strMatchedDelimiter = arrMatches[1];
		if (strMatchedDelimiter.length &&
			(strMatchedDelimiter != strDelimiter)) {
			arrData.push([]);
            }
		if (arrMatches[2]) {
			strMatchedValue = arrMatches[2]
			   .replace(new RegExp( "\"\"", "g" ),	"\"");
		} else {
			strMatchedValue = arrMatches[3];
		}
		arrData[arrData.length - 1].push(strMatchedValue);
		arrMatches = objPattern.exec(strData);
	}
	return(arrData);
};

}).apply(sv.io);
