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

import os, re, sys
import socket
# import logging

#log = logging.getLogger("RConn")
#log.setLevel(logging.INFO)


class RConn(object):
    port = None
    default_port = 8888
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

        encoded_command = u''.join(('<cicpl>',
                                    command.replace("\\", "\\\\"). \
                                    replace("\n", "\\n").replace("\r", "\\r"). \
                                    replace("\f", "\\f"), os.linesep))
        # command must end with newline
        # mode = 'hax' # hidden + encoded + returnASCII
        try:
            s.send(''.join(('\x01', 'hax', encoded_command.encode('utf-8'))))
        # except UnicodeEncodeError, e:
        except Exception, e:
           return u''

        s.shutdown(socket.SHUT_WR)

        all_data = []
        try:
            while True:
                data = s.recv(1024L)
                if not data: break
                all_data.append(data)
        except Exception, e:
            print e
            pass
        s.close()
        all_data = "".join(all_data).rstrip()

        result = all_data.split("\x1f")[2]
        result = re.sub("\x1a\{(\x1a|<[0-9a-f]{2}>)\}", "\\1",
                        re.sub('(?<!\x1a\{)<([0-9a-f]{2})>', '\\x\\1', result)
                        .decode('string_escape')) \
                        .decode("utf-8") \
                        .replace('\x02\x03', '')
        
        return unicode(result)
