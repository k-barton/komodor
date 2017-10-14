# Komodo R-documentation language service

import logging
from koUDLLanguageBase import KoUDLLanguage
from xpcom import components #, nsError, COMException, ServerException

log = logging.getLogger("koRdocLanguage")
log.setLevel(logging.DEBUG)
#log.setLevel(logging.ERROR)

def registerLanguage(registry):
    log.debug("Registering language R documentation")
    registry.registerLanguage(KoRmarkdownLanguage())

class KoRdocLanguage(KoUDLLanguage):
    name = "R documentation"
    lexresLangName = "Rdoc"
    _reg_desc_ = "%s Language" % name
    _reg_contractid_ = "@activestate.com/koLanguage?language=%s;1" % name
    _reg_clsid_ = "{43e2ac05-0e3e-431a-a679-9791dd05e8bc}"
    _reg_categories_ = [("komodo-language", name)]
    defaultExtension = '.Rd'
     
    lang_from_udl_family = {'TPL': name, 'SSL': 'R_extended'}
    commentDelimiterInfo = {
        "line": [ "%", ],
    }
    
    supportsSmartIndent = "brace"
    
    sample = """
% File src/library/base/man/load.Rd
\name{load}
\alias{load}
\title{Reload Saved Datasets}
\description{
  Reload the datasets written to a file with the function
  \code{save}.
}
\usage{
load(file, envir = parent.frame())
}
\arguments{
  \item{file}{a connection or a character string giving the
    name of the file to load.}
  \item{envir}{the environment where the data should be
    loaded.}
}
\seealso{
  \code{\link{save}}.
}
\examples{
## save all data
save(list = ls(), file= "all.RData")

## restore the saved values to the current environment
load("all.RData")

## restore the saved values to the workspace
load("all.RData", .GlobalEnv)
}
\keyword{file}
"""

# # Overriding these base methods to work around bug 81066.
def get_linter(self):
    None
def get_interpreter(self):
    None
