# komodor
===========================
**KomodoR** is an addon for **Komodo Edit** to turn it into an **R** interface.

This extension was initially a slimmed-down fork of [Sciviews-R](http://komodoide.com/packages/addons/sciviews-r/) created by Philippe Grosjean. Currently it is almost completely rewritten with focus on simplicity.

**KomodoR** uses socket connection to communicate with **R**. No additional **R** packages are required. In **R** environment, socket server is implemented in Tcl, so your **R** installation needs to have Tcl capability (`capabilities("tcltk")`).

**KomodoR**'s features:
* execution of **R** code from within **Komodo**
      * execute/source line, selection, bookmark delimited block, function at cursor, or whole file 
* syntax highlighting
      * Roxygen comments
      * R documentation (partly implemented)
      * Rmarkdown (partly implemented)
* code completion
* syntax checking
* **R** object browser
* **R** package manager
* execute Komodo JavaScript command from within **R** (`koCmd` function)


