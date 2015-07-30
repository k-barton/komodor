#![KomodoR logo](src/skin/images/appicon.png)
This extension provides language support and interface for [R](https://www.r-project.org/) in Komodo.

It is compatible with Komodo Edit 7-9 (not tested on Komodo IDE and Mac).

This extension was initially a slimmed-down fork of
[Sciviews-R](http://komodoide.com/packages/addons/sciviews-r/) created by 
Philippe Grosjean, but it has been almost completely rewritten since.

**Features:**

* execution of code in R from within editor:
      * output is shown in the Command output pane  
      * execute (or `source`) current line or selection, bookmark delimited block, function at 
        cursor, or whole file 
* syntax highlighting:
      * R including Roxygen tags
      * R documentation (Rd files, *work in progress*)
      * Rmarkdown (Rmd files, *work in progress*)
* code completion
* syntax checking
* R object browser (sidebar)
* R toolbar
* R help window inside Komodo
* R package manager
* execute a JavaScript command in Komodo from within R (use `koCmd` function in R)

**KomodoR** uses socket connection to communicate with **R**. No additional R 
packages are required. The socket server in R environment is implemented in Tcl, so
your R installation needs to have Tcl capability (`capabilities("tcltk")`).


**Known issues:**

* Output from R is displayed in the command output pane only at the end of operation
* Debugging R's functions using `browser()`: code using `browser` executed
 from within Komodo interrupts the communication and no output will be 
 displayed. Code containing `browser` calls should be used directly 
 in R console.
* Problems with connection with Komodo server in R may cause R will not exit 
properly (at least on Windows) and need to kill the process.
* Syntax highlighting: when R is a sub-language (in Rd or Rmarkdown files), the 
  colouring dissappears occassionally. This seems to be related to brace 
  counting in UDL (spush_check/spop_check).
* Minor bugs :
    * Preferences->R->R application: dissappears on refresh
    * R package manager: available packages list does not show
    * R help window: search from address box does not work
    * Dead bookmark margin click preference
    * Some preferences are unused
    * On Komodo9 .R files open as Text

