**Object browser:**
* removal command for environment's items:
`rm(list = "svBrowseHere", envir = sv_CurrentEnvir)`
* on R close, packages other than .GlobalEnv remain
* make "R search path" a dropdown menu at the top

**Preferences:**
* add warning about restarting R if interpreter changed
* changing between R/Rgui: select the right version
* remove margin click preference

**Package manager:**
* available packages do not show
* implement commands from the dropdown menu

**R help window:**
* search from address bar is broken

**Other**
* On Komodo 9, .R files opened as "REBOL" or"Text" (need to manually replace
  association for .r (lowercase) to "R")

**Code highlighting/completion**
* completion for Roxygen tags
* Roxygen: handling R code after @example 
