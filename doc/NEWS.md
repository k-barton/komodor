---
title: "What's new in R Interface?"
output: html_document
css: chrome://komodor/skin/doc.css
---
(Version #VERSION#)


* R object browser:

    - "R Search Path" panel has been refurbished. It displays dependences for each
      item, and packages which depend on the item. Items (with 
      dependencies) can be detached via command buttons or by pressing Delete (or 
      Shift+Delete).
    - object list is being automatically updated after a command is executed by
      R. To go back to manual refresh uncheck the option in "R Preferences".

* "R preferences" page:

    - User can edit the command to start R.
    - Information about R version string is shown upon choosing the R 
	  application path.
    - Package `formatR` is detected (and installed) via command line, so also 
      when no R session is connected. 
    - On Linux, some additional terminal emulators to run R within have been 
      added.
    - On Mac, added option to use `xterm` (this has not been tested and is 
      likely not to work).
    
* "R Tools" toolbox has a new folder "Troubleshooting" with some tools that may 
  come in handy when things when something breaks.

* Command Output panel:
  
    - Large outputs from R no longer cause Komodo freeze.
    - R output's printing width is set to match the width of the Command Output 
	  panel. 

* R Package Manager has new style that matches application theme.

* A number of bug fixes and stability improvements.

* The code has been reorganized. Most JS code is now included in CommonJS 
  modules. 
  The global `sv` object is replaced by `kor`. For example:

	```r    
kor.r.evalUserCmd("runif(10)")
	```
    or (outside the main window)
	```r 
require("kor/r").evalUserCmd("runif(10)")
	```

* Most internal R commands is executed asynchronously.



(previous Version)

* Much improved "R object browser" widget:

    - browsing within R expression tree (e.g. `parse`d code, function `body`, 
	  or `formula`)
    - listing of objects' attributes (menu under 
	  <img src="chrome://komodor/skin/images/cog.svg" width="16" 
	  style="vertical-align: middle;" alt="cog" /> button on the widget's 
	  toolbar)
    - removal of formal function arguments (only non-package functions) and 
	  objects' attributes (Shift+Del)
    - listing of the current evaluation environment in the 
	  [debugging mode](chrome://komodor/content/doc/koDebug.html)
    - new SVG icons, simplified style
    - "Group" column is removed (which has been present only for historical 
	  reasons)
    - "R search path" panel: restored keyboard navigation
    
*  Large number of bug fixes and stability improvements.
   
