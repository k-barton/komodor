**Classic styling in Komodo 9**

* Bringing back native styling in Komodo 10-11 is quite problematic (not impossible though), 
  but Komodo 9 is still available [here](http://downloads.activestate.com/Komodo/releases/9.3.2/) 
  and offers much the same functionality.

* This [userChrome.css stylesheet](userChrome.css) restores some of the system 
  styling under Windows ("HUD", buttons, preferences, autocompletion menu). To be
  placed in a directory named 'chrome' inside your user profile directory:
  
  Windows: `%LOCALAPPDATA%\ActiveState\KomodoEdit\9.3\XRE\chrome\userChrome.css`
  
  Linux: `~/.komodoedit/9.3\chrome\userChrome.css`
  
  (see [this MDN article](https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/Tutorial/Modifying_the_Default_Skin)).

* Add a patch for broken *Views* file filter in the *Places* panel. Replace the file  
  > **_\[Komodo program directory\]_/lib/mozilla/distribution/bundles/places\@activestate\.com/places\.jar**/content/manageViewFilters.js
  
  Note: A JAR file is a ZIP-compressed file.  
  [manageViewFilters.js](manageViewFilters.js)
