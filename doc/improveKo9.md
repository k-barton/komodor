**Classic styling in Komodo 9**

* Bringing back native styling in Komodo 10-11 is quite problematic (not impossible though), 
  but Komodo 9 is still available [here](http://downloads.activestate.com/Komodo/releases/9.3.2/) 
  offering much the same functionality (at least from R-user perspective), and
  is somewhat faster. Below is a list of modifications to make Komodo-Edit 9 a 
  (Windows) system-theme respecting editor, also fixing some bugs.
  
* This [userChrome.css stylesheet](userChrome.css) restores some of the system 
  styling under Windows ("HUD", buttons, preferences, autocompletion menu). To be
  placed in a directory named 'chrome' inside your user profile directory:
  
  Windows: *%LOCALAPPDATA%\ActiveState\KomodoEdit\9.3\XRE\chrome\userChrome.css*
  
  Linux: *~/.komodoedit/9.3\chrome\userChrome.css*
  
  (see [this MDN article](https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XUL/Tutorial/Modifying_the_Default_Skin)).

* Add a patch for broken *Views* file filter in the *Places* panel. Replace the file  
   *\[Komodo program directory]/lib/mozilla/distribution/bundles/places\@activestate.com/places\.jar /content/manageViewFilters.js*
  
    - [manageViewFilters.js](patch9/distribution_bundles_places@activestate.com_places.jar_content/manageViewFilters.js)
  
  Notes:
	- A JAR file is a ZIP-compressed file.
	- You need administrator rights to tamper with *Program Files*  

* Fix the annoyance of the *Find/Replace* panel disappearing when it looses focus.
   
  If this happens, the quick solution is setting the "pin_find_frame" preference manually (e.g. via user script):
  `ko.prefs.getBooleanPref("pin_find_frame")`. 

  The following files repair the Find panel adding a close-bar at the top like in Komodo 11.
  The stylesheet also makes the option buttons more visible.
  
  *[Komodo program directory]/lib/mozilla/chrome/komodo.jar /content/find/*
   
    - [findResultsTab.xul](patch9\chrome_komodo.jar_content_find\findResultsTab.xul)
    - [find_functions.js](patch9\chrome_komodo.jar_content_find\find_functions.js)
    - [embedded.xul](patch9\chrome_komodo.jar_content_find\embedded.xul)
 
  *[Komodo program directory]/lib/mozilla/chrome/komodo.jar /skin/dialogs/*
 
    - [find2.css](patch9\chrome_komodo.jar_skin_dialogs\find2.css)


