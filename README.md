
<img align="left" src="img/logo1.png" alt="KomodoR logo" style="float: left" />

Provides [R language](https://www.r-project.org/) support and interface between 
R environment and Komodo. 

***

This extension has initially been a slimmed-down fork of
[Sciviews-K](http://komodoide.com/packages/addons/sciviews-r/) by 
Philippe Grosjean, but since then it has been largely rewritten. 
It is compatible with Komodo Edit 7 to 11. It has not been tested on Komodo IDE 
and Mac.

**Note:** Komodo, since version 9.2, provides its own R syntax highlighting 
which is not compatible with this add-on. Therefore "R" language provided by 
this extension has been renamed to __"R_extended"__ to avoid conflicts.


**Features:**

* start/quit R from Komodo
* execution of R code from within editor:
  + output is shown in the _Command Output_ pane  
  + execute (or `source`) current line or selection, bookmark-delimited 
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
* change R working directory from _Places_ pane (in the context menu)

A socket connection is used to communicate with **R**. No additional R packages 
are required, however the socket server in R environment is implemented
in Tcl, so your R installation needs to have Tcl capability 
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
  operation (and this is unlikely to change with the current way of 
  communication with R)
* Calculation can be interrupted only in R window (Ctrl+C in R terminal, Escape 
  key in RGui)
* Executing Rgui's command "Stop all computations" will also stop R's socket 
  server and hence break the connection with Komodo. It may also cause R crash 
  (at least on Windows).
* Problems with connection with Komodo server in R may cause R will not exit 
  properly (at least on Windows) and need to kill the R process (happens very 
  rarely though).
* Connection timeout on longer operations: prompt is shown as if the calculation
  in R has finished and no output will be shown. There does not seem to be a way
  to set socket timeout in Tcl.
* R object browser has to be refreshed manually (click sidebar's refresh button)
  This is for performance, otherwise a list of object would have to be passed 
  after each operation.
* Syntax highlighting: when R is a sub-language (in Rd or Rmarkdown files), the 
  colouring dissappears occassionally. This seems to be related to brace 
  counting in UDL (`spush_check`/`spop_check`, a bug in Komodo possibly).


**[Improvements for Komodo 9](improveKo9.md)**

