<img align="left" src="img/logo.png" alt="KomodoR logo" />
Provides [R](https://www.r-project.org/) language support and interface between 
R environment and Komodo.

***

This extension was initially a slimmed-down fork of
[Sciviews-K](http://komodoide.com/packages/addons/sciviews-r/) created by 
Philippe Grosjean, but since then it has been largely rewritten. 
It is compatible with Komodo Edit 7-9 (not tested on Komodo IDE and Mac).


**Features:**

* start R from Komodo
* execution of code in R from within editor:
      * output is shown in the Command output pane  
      * execute (or `source`) current line or selection, bookmark-delimited 
        block, function at cursor, or whole file 
* syntax highlighting:
      * R including [Roxygen](http://roxygen.org/) tags
      * R documentation (.Rd files, *work in progress*)
      * [Rmarkdown](https://cran.r-project.org/package=rmarkdown) 
        (.Rmd files, *work in progress*)
* syntax checking
* code completion
* R object browser (sidebar)
* toolbar with commonly used commands
* R help window
* R package manager
* change R working directory from Places (context menu)

Socket connection is used to communicate with **R**. No additional R 
packages are required, however the socket server in R environment is implemented
in Tcl, so your R installation needs to have Tcl capability 
(`capabilities("tcltk")`).


**Main API functions**

*  in Komodo: `sv.r.eval` and `sv.r.evalAsync` JavaScript functions execute a 
   command in R and return the output.
*  in R: `koCmd` executes a JavaScript command in Komodo and returns the result 
   if any.


**Known issues:**

* Output from R is displayed in the command output pane only at the end of 
  operation (and this is unlikely to change with the current way of 
  communication with R)
* Debugging in R using `browser()` or `recover`: these functions executed
  from within Komodo interrupt the communication and no output will be 
  displayed. Code containing `browser` calls should be used directly 
  in R console. Currently the only way to debug code within a function in a 
  similar way as `browser()` does is to change the current execution environment
  using `svBrowseHere()` within the function and afterwards set it back 
  to `.GlobalEnv` with `svSetEnv()`.  Note that the original call stack (i.e. 
  `sys.frames()` or `sys.calls()` etc.) will not be preserved.
  Example:

```r
    in.GlobalEnv <- TRUE
    test <- function(arg1 = 1, arg2 = 2) {
        in.test <- TRUE
        svBrowseHere() # instead of 'browser()'
    }

    test()
    ls() # we're inside 'test' now
    #> [1] "arg1"     "arg2"     "in.test"
    
    svSetEnv()
    ls() #  back to .GlobalEnv
    #> [1] "f1"           "f2"           "in.GlobalEnv"
```
* Problems with connection with Komodo server in R may cause R will not exit 
  properly (at least on Windows) and need to kill the R process.
* R object browser has to be refreshed manually (click sidebar's refresh button)
  This is for performance, otherwise a list of object would have to be passed 
  after each operation.
* Syntax highlighting: when R is a sub-language (in Rd or Rmarkdown files), the 
  colouring dissappears occassionally. This seems to be related to brace 
  counting in UDL (spush_check/spop_check, a bug in Komodo possibly?).
 
