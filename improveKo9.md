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
