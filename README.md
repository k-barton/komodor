
<img align="left" src="https://raw.githubusercontent.com/k-barton/komodor/master/img/logo1.png"
alt="KomodoR logo" style="float: left" />

Provides [R language](https://www.r-project.org/) support and interface between 
R environment and Komodo. 

***

<br clear="both" />

This extension forked from [“Sciviews-K”](https://community.komodoide.com/packages/addons/sciviews-k/) by 
Philippe Grosjean, and since then has been largely rewritten. 

**Features:**

* Connect to “R” session from Komodo
* Execution of R code directly from within editor:
   + output from R is shown in the _Command Output_ pane
   + execute (or `source`) the current line or selection, bookmark-delimited 
     block, function at cursor, or a whole file.
* Syntax highlighting:
   + R language including [Roxygen](http://roxygen.org/) tags
   + R documentation (*.Rd* files, partially implemented.)
   + [Rmarkdown](https://cran.r-project.org/package=rmarkdown) 
     (*.Rmd* files, partially implemented.)
* Code completion (objects, argument names, list items)
* Syntax checking
* R object browser pane
* Toolbar with commonly used commands
* R help window
* R package manager
* R working directory can be changed from _Places_ pane (in the context menu)

This add-on provides a file type named __“R\_extended”__ to avoid conflict with Komodo's 
built-in R syntax highlighter. Code completion and syntax checking works only with “R\_extended” not “R“.

No additional R packages are required, however your R installation needs to have Tcl capability 
(R: `capabilities("tcltk")`). See also _Known issues_ below.

**Some other, obscure features:**

* *_Places_ panel*:
    * load workspace from “.RData” files or source script from “.R” files: 
      select a command from the context menu.
* *R browser*:
    * drag an item to the editor to insert R objects' names,
        * hold "Shift" key during the drag start to drop quoted names,  
        * hold "Ctrl" key during the drag start to drop full object names
          (e.g. `list$data$column`. Non-syntactic names will be backtick-quoted).
		* hold both to insert “name()” for functions, “name=” for function 
		  arguments.
    * you can filter items either by object name or class name (toggle the "filter by" button next to the search box), using regular expressions. Prefix the search term with "~" to filter *out* matching names.
* *R search path* box:
    * drop a package name onto it to load the package;
    * press "delete" to unload the selected package; 
    * drag an item to the editor to insert package name.
* *R help* window:
    * press Ctrl+R to run selected text as R code (or choose command from the 
	  context menu).
* R language help (Shift+F1 while in an *R_extended* document):
    * the selected keyword is searched for in the loaded packages. If nothing is 
	  found, press Shift+F1 again to search in all packages.
* The *R tools* toolbox has some more or less useful commands:
    * R markdown preview;
    * Insert result of the selected text evaluated in R;
	* Color picker (inserts hex code to the text);
	* Duplicate line or selection (assign to Ctrl+D to restore the good old 
	  pre-8 behaviour).
	* “_Smart_ highlight” marks all occurences of the word under the cursor in 
	  the current document.

	  
**Debugging R code**

The extension provides some code debugging capabilities, see 
[Debugging R code](debugging.md).   

**Main API functions**

*  in Komodo: `kor.r.evalUserCmd` JavaScript function sends a command to R.
*  in R: `koCmd` executes a JavaScript command in Komodo and returns the result 
   if any.
*  For more advances uses, CommonJS module `"kor/r"` (or `kor.r` object in the main `window`) has functions to perform various tasks _via_ R, and the `"kor/connector"` module has more low level functions for communication between R and Komodo, of which `require("kor/connector").evalAsync(command, callback)` is the most useful.

**Known issues:**

* Output from R is displayed in the command output pane only at the end of 
  operation (real-time command output will be introduced in version 0.4)
* Calculation can be interrupted only in R window (Ctrl+C in R terminal, Escape 
  key in RGui)
* Executing Rgui's command “Stop all computations” will also stop R's socket 
  server and hence break the connection with Komodo. It may also cause R crash 
  (it happens sometimes on Windows).
* On Linux, Tk-Gui sometimes does not close properly. It is not recommended to 
  use it with this add-on.
* Problems with connection with Komodo server in R may cause R not exit 
  properly and need to kill the R process (it happens rarely - perhaps a 
  Windows-specific problem).
* If something went wrong and Komodo shows R is running when it is not, 
  run “R: check connection” macro in “R Tools” toolbox.
* Connection timeout on longer operations: a prompt is shown as if the calculation
  in R has finished and no output is shown. (version < 0.4)
* Syntax highlighting: when R is a sub-language (in Rd or Rmarkdown files), the 
  colouring dissappears occassionally. There is also some flickering inside
  Roxygen comments. This seems to be related to brace counting in UDL 
  (bug in Komodo).


**[Hacks for classic Windows styling in Komodo Edit](improveKo9.md)**
