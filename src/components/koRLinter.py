#!python
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
# The Original Code is Komodo code
#
# Contributor:
#   Kamil Barton
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

from xpcom import components, nsError, COMException, ServerException
from xpcom._xpcom import PROXY_SYNC, PROXY_ALWAYS, PROXY_ASYNC
from koLintResult import *
from koLintResults import koLintResults
import os, sys, re
import tempfile
import string
#import process
#import koprocessutils
import logging

log = logging.getLogger('RLinter')
log.setLevel(logging.ERROR)

class KoRLinter:
    _com_interfaces_ = [components.interfaces.koILinter]
    _reg_desc_ = "Komodo R Linter"
    _reg_clsid_ = "{E5B7415C-81C6-4185-8B53-B527193D251E}"
    _reg_contractid_ = "@activestate.com/koLinter?language=R;1"
    _reg_categories_ = [
         ("category-komodo-linter", 'R'),
         #  ("komodo-linter", "R Linter"), 
         ]

    def __init__(self):
        self.pattern = re.compile('^(?:.*:)?(?P<line>\d+):(?P<col>\d+):(?P<descr>.*?)(?=[\r\n])')
        ##self.pattern = re.compile('^(.*):(?P<line>\d+):(?P<col>\d+):(?P<descr>.*?)(?=[\r\n])[\s\S]*(?<=[\r\n])(?P=line): (?P<code>.*?)(?=[\r\n])')
        self.sv_utils = components.classes["@komodor/svUtils;1"].\
            getService(components.interfaces.svIUtils)
        pass

        # 'lint' first evaluates in R 'sv_quickParse(filename)' which returns R-style
        # formatted error or empty string. Then it retrieves from the error message
        # the position within text and description
    def lint(self, request):
        text = request.content.encode("utf-8")
        tabWidth = request.koDoc.tabWidth
        log.debug("linting %s" % text[1:15])

        results = koLintResults()
        try:
            tmp_filename = tempfile.mktemp()
            fout = open(tmp_filename, 'wb')
            fout.write(text)
            fout.close()
            command = 'cat(sv_quickParse(\"' + tmp_filename.replace('\\', '/') \
                + '", encoding = "UTF-8"))'
            #log.debug(command)
        except Exception, e:
            log.exception(e)
        try:
            lines = self.sv_utils.evalInR(command, "json h", 1.5).rstrip() \
                .replace('\x03', '').replace('\x02', '')
            if lines.startswith('\x15'): # connection error
                pass
                #raise ServerException(nsError.NS_ERROR_NOT_AVAILABLE)

            log.debug('lint: ' + lines)
            ma = self.pattern.match(lines)
            if (ma):
                lineNo = int(ma.group('line'))
                datalines = re.split('\r\n|\r|\n', request.content, lineNo) # must not to be encoded
                columnNo = int(ma.group("col"))
                description = ma.group("descr")
                #code = ma.group("code")

                result = KoLintResult()
                result.severity = result.SEV_ERROR
                result.lineStart = result.lineEnd = lineNo
                l1 = datalines[lineNo - 1][:columnNo]

                ntabs = l1.count("\t")
                result.columnStart = columnNo - (ntabs * 7)
                result.columnEnd = len(datalines[lineNo - 1]) + 1
                log.debug("tabWidth = %d" % tabWidth)

                result.description = "Syntax error: %s (on column %d)" % \
                    (description, columnNo - (ntabs * (8 - tabWidth)))
                results.addResult(result)

        except Exception, e:
            log.exception(e)
        finally:
            os.unlink(tmp_filename)
            pass
        return results
