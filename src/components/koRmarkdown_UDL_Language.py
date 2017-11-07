# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License
# Version 1.1 (the "License"); you may not use this file except in
# compliance with the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS"
# basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
# License for the specific language governing rights and limitations
# under the License.
#
# The Original Code is SciViews-K by Philippe Grosjean et al.
#
# Contributor(s):
#   Kamil Barton
#   ActiveState Software Inc (code inspired from)
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

# Komodo R language service

import logging
from koUDLLanguageBase import KoUDLLanguage
from xpcom import components #, nsError, COMException, ServerException

log = logging.getLogger("koRmarkdownLanguage")
# log.setLevel(logging.DEBUG)

def registerLanguage(registry):
    log.debug("Registering language Rmarkdown")
    registry.registerLanguage(KoRmarkdownLanguage())


class KoRmarkdownLanguage(KoUDLLanguage):
    name = "Rmarkdown"
    lexresLangName = "Rmarkdown"
    _reg_desc_ = "%s Language" % name
    _reg_contractid_ = "@activestate.com/koLanguage?language=%s;1" % name
    _reg_clsid_ = "{b1336637-7bf1-4a4c-a16b-3372f1744e52}"
    _reg_categories_ = [("komodo-language", name)]
    defaultExtension = '.Rmd'
     
    lang_from_udl_family = {'SSL': 'R_extended', 'M': 'Rmarkdown'}
	
    
    sample = """
# Header 1
## Header 2
Plain text
*italics* and _italics_
**bold** and __bold__
superscript^2^
~~strikethrough~~
[link](cran.r-project.org)
ellipsis: ...
inline equation: $A = \pi*r^{2}$
image: ![](path/to/smallorb.png)
horizontal rule (or slide break): ***
Inline R code: 2+3 is `r 2 + 3`. 
"""


# # Overriding these base methods to work around bug 81066.
def get_linter(self):
    None
def get_interpreter(self):
    None
