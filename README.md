#![KomodoR logo](src/skin/images/appicon.png) komodor
===========================


**KomodoR** is an addon for **Komodo Edit** to turn it into an **R** interface.

Compatible with Komodo Edit 7-9, not tested with Komodo IDE and on Mac.

This extension was initially a slimmed-down fork of
[Sciviews-R](http://komodoide.com/packages/addons/sciviews-r/) created by 
Philippe Grosjean, but it has been almost completely rewritten since.

**KomodoR** uses socket connection to communicate with **R**. No additional R 
packages are required. In R environment, socket server is implemented in Tcl, so
your R installation needs to have Tcl capability (`capabilities("tcltk")`).

## *KomodoR*'s features:
* execution of R code from within Komodo:
      * execute/source line, selection, bookmark delimited block, function at 
        cursor, or whole file 
* syntax highlighting:
      * Roxygen comments
      * R documentation (Rd files, partly implemented)
      * Rmarkdown (partly implemented)
* code completion
* syntax checking
* R object browser (sidebar)
* R toolbar
* R help window inside Komodo
* R package manager
* execute Komodo JavaScript command from within **R** (`koCmd` function)


## Known issues:
* Debugging **R**'s functions using `browser()`: code using `browser` executed
 from within Komodo interrupts the communication and no output will be 
 displayed. Code containing `browser` calls should be used directly 
 in **R** console.
* Problems with connection with Komodo server in R may cause R will not exit 
properly (at least on Windows) and need to kill the process.
* FIXMEs:
    * Preferences->R->R application: dissappears on refresh
    * R package manager: available packages list does not show
    * R help window: search from address box does not work
    * Remove bookmark margin click preferences
    * Remove unused preferences
    * On Komodo9 .R files open as Text




