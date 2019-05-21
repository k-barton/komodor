
<img align="left" src="https://raw.githubusercontent.com/k-barton/komodor/master/img/logo1.png"
alt="Komodo.R logo" style="float: left" />

Provides [R language](https://www.r-project.org/) support and interface between 
R environment and Komodo. 

***

<br clear="both" />

This extension forked from 
[“Sciviews-K”](https://community.komodoide.com/packages/addons/sciviews-k/) by 
Philippe Grosjean, and since then has been largely rewritten. 

**Features:**

* Connect to “R” session from Komodo (R application runs independently)
* Execution of R code directly from within editor:
   + output from R is shown in the _Command Output_ pane
   + execute (or `source`) the current line or selection, bookmark-delimited 
     block, function at cursor, or a whole file.
* Syntax highlighting:
   + R language including [Roxygen](http://roxygen.org/) tags
   + R documentation (*.Rd* files, partially implemented)
   + [Rmarkdown](https://cran.r-project.org/package=rmarkdown) 
     (*.Rmd* files, partially implemented)
* Code completion (objects, argument names, list items)
* Syntax checking
* R object browser pane with fully expandable tree allows for inspecting
  objects' structure including attributes and hidden objects.
* Toolbar with commonly used commands
* R help window
* R package manager
* R working directory can be changed from _Places_ pane (in the context menu)

 ![R Interface screenshot](https://raw.githubusercontent.com/k-barton/komodor/master/docs/komodor-main.png)

This add-on provides a file type named __“R\_extended”__ to avoid conflict with
Komodo's built-in R syntax highlighter. Code completion and syntax checking
works only with “R\_extended” not “R”.

No additional R packages are required, however your R installation needs to have
Tcl capability (by default it does. In R, check it with `capabilities("tcltk")`).
See also _Known issues_ below.
   
**Other, obscure features:**

* *_Places_ panel*:
    * load workspace from “.RData” files or source script from “.R” files: 
      select a command from the context menu.
* *R browser*:
    * drag an item to the editor to insert R objects' names,
          * hold "Shift" key during the drag start to drop quoted names,  
          * hold "Ctrl" key during the drag start to drop full object names
            (e.g. `list$data$column`. Non-syntactic names will be
            backtick-quoted).
          * hold "Ctrl+Shift" to insert “name()” for functions, “name=” for function
            arguments.
    * filter items either by object name or class name (toggle the "filter by"
      button next to the search box), using regular expressions. Prefix the
      search term with "~" to filter *out* matching names.
    * modify the function code or R `expression` by deleting its elements. 
      Enable browsing of a function body (Depress the ![eye](https://raw.githubusercontent.com/k-barton/komodor/master/img/eye-red.png) button and check the option under the ![cog](https://raw.githubusercontent.com/k-barton/komodor/master/img/cog.png) menu), and navigate to 
      the `<function body>` item located after the function arguments (an argument can 
      be removed as well). It is not possible to modify functions inside packages
      or locked environments.
    
* *R search path* box:
    * drop a package name onto it to load the package;
    * press "delete" to unload the selected package; 
    * drag an item to the editor to insert package name.
* *R help* window:
    * press Ctrl+R to run selected text in R (or choose the command from the 
	  context menu).
* Editor:
    * Make code blocks foldable by putting `#{{` and `#}}` around them (at the beginning of a line);
    * While in an *R_extended* document, press Shift+F1 once to search for the 
      selected keyword in the __loaded__ packages.
      Press Shift+F1 again to search in __all__ packages.
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
*  For more advances uses, CommonJS module `"kor/r"` (or `kor.r` object in the
   main `window`) has functions to perform various tasks _via_ R, and the
   `"kor/connector"` module has more low level functions for communication
   between R and Komodo, of which `require("kor/connector").evalAsync(command,
   callback)` is the most useful.

**Known issues:**

* Output from R is displayed in the command output pane only __at the end of
  operation__ (real-time output will be introduced in version 0.4)
* Connection timeout on longer operations: a prompt is shown as if the
  calculation in R has finished and no output is shown (version < 0.4)
* Calculation can be interrupted only in R window (Ctrl+C in R terminal, Escape
  key in RGui)
* __On MAC OS X__: problems with starting R.app and connection with R 
* __On Windows__: Executing Rgui's command “Stop all computations” will also stop R's socket
  server and hence break the connection with Komodo. In rare cases, tt may also cause R to crash.
* __On Linux__: Tk-Gui sometimes does not close properly. It is not recommended to
  use Tk-Gui with this add-on.
* In rare cases, there may be problems with connection between R and Komodo server
  which cause R not to exit properly and it is necessary to manually kill the R process.
* Syntax highlighting: when R is a sub-language (in Rd or Rmarkdown files), the
  colouring dissappears occassionally. There is also some flickering inside
  Roxygen comments. This is due to a bug in Komodo related to brace counting.

