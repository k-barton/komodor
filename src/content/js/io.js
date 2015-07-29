//res = csvToObj(data, ',', 0, true, ['', 'package', 'libPath', 'version', 'rVersion', 'reposVerion', 'repos' ])


sv.io = {};

(function(){

_this = this;

this.JSONDecode = function JSON_Decode(str) {
	var nativeJSON = Components.classes["@mozilla.org/dom/json;1"]
			.createInstance(Components.interfaces.nsIJSON);
	try {
		return nativeJSON.decode(str);
	} catch(e) {
		return null;
	}
}


function CSVRow(rowArr, colNames, hasRowNames) {
	if(rowArr.length != colNames.length)
		throw("Number of columns (" +  rowArr.length +
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
	if(colNames == undefined) {
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
		for(var i = 0, l = arr.length; i < l; i++)
 			 res[i] = new CSVRow(arr[i], colNames, false);
	}
	return header? [header, res] : res;
}

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
	while (arrMatches) {
		var strMatchedDelimiter = arrMatches[1];
		if (strMatchedDelimiter.length &&
			(strMatchedDelimiter != strDelimiter)) {
			arrData.push([]);
            }
		if (arrMatches[2]) {
			var strMatchedValue = arrMatches[2]
			   .replace(new RegExp( "\"\"", "g" ),	"\"");
		} else {
			var strMatchedValue = arrMatches[3];
		}
		arrData[arrData.length - 1].push(strMatchedValue);
		arrMatches = objPattern.exec(strData);
	}
	return(arrData);
}

}).apply(sv.io);
