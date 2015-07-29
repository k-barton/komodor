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
     
    # XXX: couldn't find any better way to access port from R   
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
    
    def eval_in_R(self, command, timeout=0.5):
        rval = self.rconnect(command, self.port, timeout)
        if len(rval) == 0 or rval[0] == u'\x15':
            return u''
        return rval
    
    def rconnect(self, command, port, timeout):
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