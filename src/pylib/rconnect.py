#!/usr/bin/env python
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
# Contributor(s):
#   Kamil Barton
#   ActiveState Software Inc (based on Komodo code)
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


# r connect:
import socket
import re
import os
import json
import logging

log = logging.getLogger("RConn")

class RConn(object):
    port = None
    default_port = 2222
    def __init__(self, port):
        self.port = port if port > 0 else self.default_port
     
    # XXX: couldn't find any other way to access port from R   
    def read_port_no(self):
        filename = os.path.realpath(os.path.join(__file__, '..', '..', 'R', '~port'))
        if os.path.exists(filename):
            try:
                fi = open(filename, 'r')
                portno = fi.read().strip()
                fi.close()
                return int(portno)
            except:
                pass
        return self.default_port
    
    def eval_in_r(self, command, timeout=0.5):
        rval = self.connect(command, self.port, timeout)
        if len(rval) == 0 or rval[0] == u'\x15':
            return u''
        return rval
    
    def connect(self, command, port, timeout):
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(timeout)
            try: s.connect(('localhost', port))
            except IOError, e:
                return unicode('\x15' + (e.args[0] if (e.errno == None) else e.strerror))
    
            full_command = '\x01h<cicpl>' \
                    + command.replace("\\", "\\\\"). \
                    replace("\n", "\\n").replace("\r", "\\r").replace("\f", "\\f")
            
            s.send(full_command + os.linesep)
            # # command must end with newline
            s.shutdown(socket.SHUT_WR)
            result = u''
            try:
                while True:
                    data = s.recv(1024L)
                    if not data: break
                    result += unicode(data)
            except Exception, e:
                log.debug(e)
                pass
            s.close()
            result = result.rstrip()
            message = ''
            result = re.sub('(?<=\\\\)[0-9]{3}', lambda x: ("u%04x" % int(x.group(0), 8)), result)
            result = re.sub('[\x00-\x08\x0e-\x1f]', lambda x: "\\u%04x" % ord(x.group(0)), result)
            try:
                resultObj = json.loads(result)
                if(isinstance(resultObj, dict)):
                    message = resultObj.get('message')
                    result = resultObj.get('result')
                    if isinstance(result, list):
                        result = os.linesep.join(result)
                    result = result.replace('\x02\x03', '')  # XXX: temporary fix
            except Exception, e:
                pass
            return unicode(result)