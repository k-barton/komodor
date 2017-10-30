
<img align="left" src="https://raw.githubusercontent.com/k-barton/komodor/master/img/logo1.png" alt="KomodoR logo" style="float: left" />

Provides [R language](https://www.r-project.org/) support and interface between 
R environment and Komodo. 

***

This extension has initially been a slimmed-down fork of
[Sciviews-K](https://community.komodoide.com/packages/addons/sciviews-k/) by 
Philippe Grosjean, but since then it has been largely rewritten. 
It is compatible with Komodo 7 to 11, and has been tested to work on Windows 
and Linux.

**Note:** Komodo, since version 9.3, provides its own R syntax highlighting 
which is not compatible with this add-on. Therefore "R" language provided by 
this extension has been renamed to __"R_extended"__ to avoid conflicts.


**Features:**

* start/close R from Komodo
* execution of R code from within editor:
   + output from R is shown in the _Command Output_ pane  
   + execute (or `source`) the current line or selection, bookmark-delimited 
     block, function at cursor, or a whole file 
* syntax highlighting:
   + R including [Roxygen](http://roxygen.org/) tags
   + R documentation (.Rd files, *experimental*)
   + [Rmarkdown](https://cran.r-project.org/package=rmarkdown) 
     (.Rmd files, *experimental*) 
* syntax checking
* code completion (objects, argument names, list items)
* R object browser (sidebar)
* toolbar with commonly used commands
* R help window
* R package manager
* R working directory can be changed from _Places_ pane (in the context menu)


A socket connection is used to communicate with **R**. No additional R packages 
are required, however your R installation needs to have Tcl capability 
(R: `capabilities("tcltk")`). See also "Known issues" below.


**Main API functions**

*  in Komodo: `sv.r.eval` and `sv.r.evalAsync` JavaScript functions execute a 
   command in R and return the output.
*  in R: `koCmd` executes a JavaScript command in Komodo and returns the result 
   if any.
   
**Debugging R code**

The extension provides some debugging capabilities, see 
[Debugging R code](debugging.md).   

**Known issues:**

* Output from R is displayed in the command output pane only at the end of 
  operation (dynamic output may be introduced in future version)
* Calculation can be interrupted only in R window (Ctrl+C in R terminal, Escape 
  key in RGui)
* Executing Rgui's command "Stop all computations" will also stop R's socket 
  server and hence break the connection with Komodo. It may also cause R crash 
  (happens sometimes on Windows).
* Problems with connection with Komodo server in R may cause R not exit 
  properly and need to kill the R process (happens very 
  rarely though - Windows only?).
* Connection timeout on longer operations: a prompt is shown as if the calculation
  in R has finished and no output will be shown. There does not seem to be a way
  to set socket timeout in Tcl.
* R object browser has to be refreshed manually (click sidebar's refresh button)
  This is for performance, yet it may become an option in future version.
* Syntax highlighting: when R is a sub-language (in Rd or Rmarkdown files), the 
  colouring dissappears occassionally. This seems to be related to brace 
  counting in UDL (`spush_check`/`spop_check`, possibly a bug in Komodo).


**[Hacks for classic Windows styling in Komodo Edit](improveKo9.md)**

