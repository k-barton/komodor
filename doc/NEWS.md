---
title: "What's new in R Interface for Komodo?"
output: html_document
css: doc.css
---

(Version #VERSION#)


* better handling of different encodings in non-Unicode systems (Windows). 
  However, unlike in the R console, Unicode characters from outside of the 
  current set are either displayed as a closest matching character or as
  <U+NNNN> (this is a shortcoming of R's `sink` / `format`).

  Example (assuming Latin2 character locale in R):
  
  __R code in Komodo (UTF-8)__
  ```{r}
    "Cyryllic: Щурячий бугай із їжаком-харцизом в\'ючись підписали ґешефт у єнах."
    "Gaelic: Mus d\'fhàg Cè ròp Ì le aon tiùb."
  ```
  
  __R output__
  
  Previous version:
    ```no-highlight
    [1] "Cyryllic: ??????? ????? ?? ??????-???????? ?'????? ????????? ?????? ? ????."
    [1] "Gaelic: Mus d'fhag Ce rop I le aon tiub."
    ```
   Current version:
    ```no-highlight
    [1] "Cyryllic: <U+0429><U+0443><U+0440><U+044F><U+0447><U+0438><U+0439>
    <U+0431><U+0443><U+0433><U+0430><U+0439> <U+0456><U+0437> [...]"
    [1] "Gaelic: Mus d'fhag Ce rop I le aon tiub."
    ```
   Using &lt;U+NNNN&gt; replacement workaround: 
    ```no-highlight
    [1] "Cyryllic: Щурячий бугай із їжаком-харцизом в'ючись підписали ґешефт у єнах."
    [1] "Gaelic: Mus d'fhag Ce rop I le aon tiub."
    ```
  Note that the substitution is in the display only, the strings are correctly
  interpreted in R as UTF-8 strings.

* stderr is correctly styled in Command Output console (although it appears 
  clickable it does not take to the error line). 
* fixed a problem with "Back to GlobalEnv" button not being activated in some 
  cases.



(Version 0.3.232b)

* Fixed: dropping an "*.RData" file path onto Attached Packages list (R Browser 
  widget) no longer opens the file in the editor.
* After installation/update, the R toolbar is restored if needed (workaround 
  for a bug in Komodo 11).
* Fixed 0.3.210b regression that caused some item icons in the R Browser 
  to disappear.
* R Package Manager -> Set Repositories: checking/unchecking additional 
  repository now triggers an update of the available packages list.
  Improved keyboard/mouse navigation in the repository list.

(Version 0.3.210b)

* __Note:__ if the R Toolbar disappears (due to a bug in Komodo), it can be 
   restored with a new tool:
  `Toolbox -> R Tools -> Troubleshooting -> Restore missing R toolbar`
* `data.frame`s content can be shown in a browser window. Access the command 
  from the R Object Browser item context menu ("View") or use an R command:
  `view(<data.frame object>)`.
* Preferences: Startup options get new checkboxes to edit the command line.
* Codeintel: fixed problems with non-ASCII names in code completion. _Still, 
  the issue with completions being left-trimmed when there are multibyte 
  characters in the completed line remains (issue #26)_.
* Improved output from R (in some special cases errors or warnings were not 
  printed correctly or were omitted. For example when an error occurred both in the 
  function and in its `on.exit` code) (issue #12)
* Added option for browsing R function body code (activated with the 
  Object Browser toolbar's cog menu item).
* New button on R Toolbar to switch back to the evaluation in `.GlobalEnv` 
  (globe icon). It becomes active when the current R evaluation environment 
  (frame) is not the Global Environment (the "R user's workspace").
  Use `setEvalEnv(new.env(())` R command to temporarily switch to a local
  environment (new variables and assigned values will not go into `.GlobalEnv`).
  See [here](./koDebug.html) for more info on debugging R code in Komodo.
* Improved detection of the R application at startup (when the previously 
  connected R session had been open when Komodo was re/started the R Object 
  Browser sometimes failed to activate). In the Toolbox, there is also a tool 
  that reconnects with R session in case of a disruption 
  (`Toolbox -> R Tools -> Troubleshooting -> Fix R Connection settings`). 
* R code formatting now calls `style_file` from R package `styler` with hardcoded 
  `tidyverse_style` formatting options. Ultimately, the code formatter will be implemented internally in JS.
* Slightly refurbished "R Help window" and "R Package Manager" (SVG icons etc.)
  
(Version 0.3.52)

* R: Fixed error with file listing when objects' required packages were not 
  available.
* R object browser: evaluation environment's tree was not displayed when 
  `EvalEnv` had been set manually via `setEvalEnv()`.
* R object browser: new icons for Spatial* and Raster* objects.
* R: attempting to unlock `baseenv()`s bindings (issue #11).

(Version 0.3.45b)

* Added workaround to replace the generic language icon for R_extended.

(Version 0.3.40b)

* Code completion: repaired wrapped argument rows, SVG images replace old
  PNG icons.
* R Search Path panel: is updated on a successful drop.
* original R window title is restored when package "kor" is detached.

(Version 0.3.22b)

* Fixed (?) R object tree panel not being activated at startup.
* Improved socket server restarting procedure.
* Fixed broken R object removal (from R object browser).
* Dropping a package name or workspace file name (*.RData) on the "search path" panel now attaches the package/workspace at the position where it was dropped (previously, it was always immediately following `.GlobalEnv`).
* R Preferences panel: icons visibility in menu lists (country flags should now be visible in the dropdown menu; application type has got icons 
  /gui or console/).
* Updated __R Tools__

(Version 0.3.10b)

* R object browser:

    - large "start R session" button is displayed in place of the R objects tree if no R session is connected.
    - "R Search Path" panel has been refurbished. It displays dependences for each item and packages which depend on the item. Items (with dependencies) can be detached via command buttons or by pressing Delete (or Shift+Delete).
    - object list is being automatically updated after a command is executed by R. To use manual refresh uncheck the option in "R Preferences".

* "R preferences" page:

    - User can edit the command to start R.
    - Information about R version string is shown upon choosing the R application path.
    - Package `formatR` is detected (and installed) via command line, so also when no R session is connected. 
    - On Linux, some additional terminal emulators to run R within have been added.
    - On Mac, added an option to use `xterm` (this has not been tested and is likely not to work).
    
* "R Tools" toolbox has a new folder "Troubleshooting" with some tools that may 
  come in handy when things when something breaks.

* Command Output panel:
  
    - Large outputs from R no longer cause Komodo freeze.
    - R output's printing width is set to match the width of the Command Output panel. 

* R Package Manager has a new style that matches application theme.

* A number of bug fixes and stability improvements.

* The code has been reorganized. Most JS code is now included in CommonJS 
  modules. 
  The global `sv` object is replaced by `kor`. For example:

    ```r    
    kor.r.evalUserCmd("runif(10)")
    ```
    or (outside the main `window`)
    ```r 
    require("kor/r").evalUserCmd("runif(10)")
    ```

* Most internal R commands are executed asynchronously.



(Previous Version)

* Much improved "R object browser" widget:

    - browsing within R expression tree (e.g. `parse`d code, function `body`, 
      or `formula`)
    - listing of objects' attributes (menu under 
      <img src="chrome://komodor/skin/images/cog.svg" width="16" 
      style="vertical-align: middle;" alt="cog" /> button on the widget's toolbar)
    - removal of formal function arguments (only non-package functions) and objects' attributes (Shift+Del)
    - listing of the current evaluation environment in the 
      [debugging mode](chrome://komodor/content/doc/koDebug.html)
    - new SVG icons, simplified style
    - "Group" column is removed (which has been present for historical reasons)
    - "R search path" panel: restored keyboard navigation
    
*  Large number of bug fixes and stability improvements.
   
