**Object browser:**
* add "current evaluation environment" as top branch if it is not `.GlobalEnv`
* on R close, packages other than .GlobalEnv remain
* make "R search path" a dropdown menu

**Preferences:**
* add warning about restarting R if interpreter changed
* changing between R/Rgui: select the right version

**Package manager:**
* implement commands from the toolbar's dropdown menu

**R help window:**
* printing, print preview, page saving

**Other**

**Code highlighting/completion**
* all tips for R
* completion for Roxygen tags
* Roxygen: handling R code after @example 
* lexer for Sweave, Bugs, Jags, Stan
* completion of attribute names in `attr(object, "<|>")`

**R**
* `koBrowseHere`: make `sys.frames` and `sys.calls` usable.
* Change prompt ":>" if commands not executed inside `.GlobalEnv`
  (like in `browser()`: "Browse[N]>")
