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
#   Philippe Grosjean
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


log = logging.getLogger("koRLanguage")
log.setLevel(logging.DEBUG)


def registerLanguage(registry):
    log.debug("Registering language R")
    registry.registerLanguage(KoRLanguage())


class KoRLanguage(KoUDLLanguage):
    name = "R"
    lexresLangName = "R"
    _reg_desc_ = "%s Language" % name
    _reg_contractid_ = "@activestate.com/koLanguage?language=%s;1" % name
    _reg_clsid_ = "{7a558f4c-5326-41c3-a037-f3003cadd61b}"
    _reg_categories_ = [("komodo-language", name)]
    defaultExtension = '.R'
    extraFileAssociations = ['*.r', '*Rprofile', '*Rhistory']
    #shebangPatterns = [ re.compile(ur'\A#!.*ruby.*$', re.IGNORECASE | re.MULTILINE),]
    
    primary = 1
    lang_from_udl_family = {'SSL': name, 'TPL': 'Roxygen'}
 
    commentDelimiterInfo = {
        "line": [ "#'", "#", ],
    }

    downloadURL = "http://cran.r-project.org/"
    #searchURL = "http://www.rseek.org/"

    _dedenting_statements = [u'return', u'break', u'else', u'next']
    _indenting_statements = [u'switch', u'if', u'ifelse', u'while', u'for',
                             u'repeat', u'break', u'local']
    supportsSmartIndent = "brace"

    #styleStdin = components.interfaces.ISciMoz.SCE_C_STDIN
    #styleStdout = components.interfaces.ISciMoz.SCE_C_STDOUT
    #styleStderr = components.interfaces.ISciMoz.SCE_C_STDERR

    sample = """#' Useless random maths example.
#' @description
#' \code{foo} returns the result of random operations on its arguments.
#' @param x,y Numeric vectors.
#' @paramx,y,z Numeric vectors.
#' @param na.rm Logical, ignored. Missing values are removed anyway. 
#' @details
#' This function sums two of its arguments, removing \code{NA}s,
#' See \code{\link[stats]{na.omit}} for \sQuote{details}
#' @examples
#' foo(1,2)
#' foo(1,2,3)
#' foo(100, 101, 102)
#' @keywords random example
foo <- function(x, y, z = NULL, na.rm = TRUE) {
	x <- x[,
		# we drop unused levels here in case x is not numeric
		drop = FALSE]
	mode(x) <- "integer"
	if(is.null(z)) z <- rnorm(1, mean = y[1L], sd = x[1L])
	median(y[!is.na(y)] + log(z, base = 10) / sum(.Machine$integer.min, 10L),
		   na.rm = TRUE)
	list(item1 = 1, `item 2` = 2, item.3 = 3)$element1[['item 2']]
	S4.object()@slot1 [["item 2"]]
	package:::element
	package::S4.object()@slot1 [["item 2"]]
	lapply(1:10, FUN = function(x, mean = weighted.mean(rnorm(x, sd = sd),
			                    w = wts), sd, wts) {
		rnorm(x, mean = mean, sd = sd)
	}, mean = 1, sd = 2, wts = 1:10)
	invisible(NA)
}
"""

    # Overriding these base methods to work around bug 81066.
    def get_linter(self):
        return self._get_linter_from_lang("R")
    def get_interpreter(self):
        None
