**Object browser:**
* removal command for environment's items:
`rm(list = "svBrowseHere", envir = sv_CurrentEnvir)`
* on R close, packages other than .GlobalEnv remain
* make "R search path" a dropdown menu at the top

**Preferences:**
* add warning about restarting R if interpreter changed
* changing between R/Rgui: select the right version
* remove margin click preference
* K9: Preference page "Languages->R" does not open automatically 

**Package manager:**
* implement commands from the dropdown menu

**R help window:**
* search from address bar is broken

**Other**

**Code highlighting/completion**
* completion for Roxygen tags
* Roxygen: handling R code after @example 
* Lexer for Sweave and Stan
* Completion of attribute names in `attr(object, "<|>")`

**R**
* `svBrowseHere`: make `sys.frames` and `sys.calls` usable.
* Change prompt ":>" if commands not executed inside `.GlobalEnv`
  (like in `browser()`: "Browse[N]>")