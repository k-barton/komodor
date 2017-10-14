
<img align="left" src="img/logo1.png" alt="KomodoR logo" style="float: left" />

Provides [R language](https://www.r-project.org/) support and interface between 
R environment and Komodo. 

***

This extension was initially a slimmed-down fork of
[Sciviews-K](http://komodoide.com/packages/addons/sciviews-r/) created by 
Philippe Grosjean, but since then it has been largely rewritten. 
It is compatible with Komodo Edit 7 to 11, but there are some
glitches with Komodo 10. It has not been tested on Komodo IDE and Mac.

**Note:** Komodo, since version 9.2 provides its own R syntax highlighting which 
is not compatible with this add-on. Therefore, starting from the current version, the language is 
renamed to "R_extended" to avoid this conflict.


**Features:**

* start R from Komodo
* execution of code in R from within editor:
  + output is shown in the Command output pane  
  + execute (or `source`) current line or selection, bookmark-delimited 
   block, function at cursor, or whole file 
* syntax highlighting:
  + R including [Roxygen](http://roxygen.org/) tags
  + R documentation (.Rd files, *work in progress*)
  + [Rmarkdown](https://cran.r-project.org/package=rmarkdown) 
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
(`capabilities("tcltk")`). See also "Known issues" below.


**Main API functions**

*  in Komodo: `sv.r.eval` and `sv.r.evalAsync` JavaScript functions execute a 
   command in R and return the output.
*  in R: `koCmd` executes a JavaScript command in Komodo and returns the result 
   if any.


**Known issues:**

* Output from R is displayed in the command output pane only at the end of 
  operation (and this is unlikely to change with the current way of 
  communication with R)
* Calculation can be interrupted only in R window (Ctrl+C or Escape key in RGui)
* Executing "Stop all computations" in R will also stop R's socket server and hence
  break the connection with Komodo. It also can cause R crash (at least on Windows).
* Problems with connection with Komodo server in R may cause R will not exit 
  properly (at least on Windows) and need to kill the R process.
* Debugging in R using `browser()` or `recover`: these functions executed
  from within Komodo interrupt the communication and no output will be 
  displayed. Code containing `browser` calls should be used directly 
  in R console. Currently the only way to debug code within a function in a 
  similar way as `browser()` does is to change the current execution environment
  using `koBrowseHere()` within the function and afterwards set it back 
  to `.GlobalEnv` with `koBrowseEnd()`. Note that the original call stack (i.e. 
  `sys.frames()` or `sys.calls()` et al.) is not preserved, and the execution
  of the function will not be resumed.
  Example:

```r
    in.GlobalEnv <- TRUE
    test <- function(arg1 = 1, arg2 = 2) {
        in.test <- TRUE
        koBrowseHere() # instead of 'browser()'
		# rest of the code will not be executed
    }

    test()
    ls() # we're inside 'test' now
    # [1] "arg1"     "arg2"     "in.test"
    
    koBrowseEnd()
    ls() #  back to .GlobalEnv
    # [1] "f1"           "f2"           "in.GlobalEnv"
```
  There is a __new, experimental function__ `koDebug` that allows debugging a function if it 
  produces an error. The execution stops and the user can debug inside the frame that caused the error.
  Example:
  
```r
    test <- function(x, y, inside.test = TRUE) x + y 
    dtest <- koDebug(test)
    dtest("1", 2)
    # Debug error:  non-numeric argument to binary operator
    # in: 
    # x + y
    ls() # we are now working inside `test`
    # [1] "inside.test", "x" "y"
    # when finished, use `koBrowseEnd()` to go back to .GlobalEnv
```

* Connection timeout on longer operations: prompt is shown as if the calculation in R 
  has finished and no output will be shown. There does not seem to be a way to set 
  socket timeout in Tcl.
* R object browser has to be refreshed manually (click sidebar's refresh button)
  This is for performance, otherwise a list of object would have to be passed 
  after each operation.
* Syntax highlighting: when R is a sub-language (in Rd or Rmarkdown files), the 
  colouring dissappears occassionally. This seems to be related to brace 
  counting in UDL (`spush_check`/`spop_check`, a bug in Komodo possibly).


**Improvements for Komodo 9**

* Komodo 9 is available [here](http://downloads.activestate.com/Komodo/releases/9.3.2/).

* A [userChrome.css stylesheet](userChrome.css) that restores some of the system 
  styling under Windows ("HUD", buttons, preferences, autocompletion menu). To be
  placed in a directory named 'chrome' inside your user profile directory
  (see [this MDN article](https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/Tutorial/Modifying_the_Default_Skin).

* Patch for broken *Views* file filter in the *Places* panel. Replace the file  
  > **_\[Komodo program directory\]_/lib/mozilla/distribution/bundles/places\@activestate\.com/places\.jar**/content/manageViewFilters.js
  
  Note: A JAR file is a ZIP-compressed file.  
  [manageViewFilters.js](manageViewFilters.js)

