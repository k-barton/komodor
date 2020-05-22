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
# Creator:
# Kamil Barton <kamil.barton__at__go2.pl>

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

# This is an interface for communication with R through socket connection
# with additional utilities

from xpcom import components, nsError, COMException
from xpcom.server import WrapObject #, UnwrapObject
import os, sys, re
import string
from xpcom.server.enumerator import SimpleEnumerator
import socket, threading, json
from uuid import uuid1

import logging
log = logging.getLogger('korRConnector')

class korRConnector:
    _com_interfaces_ = [components.interfaces.korIRConnector]
    _reg_desc_ = "KomodoR R connection mediator"
    _reg_clsid_ = "{22A6C234-CC35-D374-2F01-FD4C605C905C}"
    _reg_contractid_ = "@komodor/korRConnector;1"

    class CommandInfo:
        _com_interfaces_ = components.interfaces.korICommandInfo
        _counter = 0
        def __init__(self, cmd_id, cmd, mode, browserMode = False, message = '', result = ''):
            self.id = cmd_id
            self.uid = korRConnector.CommandInfo._counter
            self.command = cmd
            self.mode = mode
            self.browserMode = browserMode
            self.message = message
            self.result = result
            korRConnector.CommandInfo._counter += 1

    def __init__(self):
        # observerSvc = components.classes["@mozilla.org/observer-service;1"].\
        #    getService(components.interfaces.nsIObserverService)

        # self._proxiedObsSvc = getProxyForObject(1, \
        #     components.interfaces.nsIObserverService, \
        #     observerSvc, PROXY_ALWAYS | PROXY_SYNC)

        self.lastCommand = u''
        self.lastResult = u''
        self.lastMessage = u''
        self.runServer = False
        self.socketOut = ('localhost', 8888L)
        self.socketIn = ('localhost', 7777L)
        self.serverConn = None
        self.lastCommandInfo = None
        self.outScimoz = None
        self.charCode = 'CP1250'
        self.proc_out_str = None
        self.setCharSet(self.charCode)
        pass
    
    def setSocketInfo(self, host, port_in, port_out):
        log.debug("setSocketInfo (in: %s,%d, out: %s,%d)" % ('127.0.0.1', port_in, host, port_out))
        self.socketOut = (host, port_out)
        self.socketIn = ('127.0.0.1', port_in)
        pass

    def setCharSet(self, charcode):
        log.debug("setCharSet: %s" % charcode)
        if charcode is None:
            return
        self.charCode = charcode
        if charcode.lower() == 'utf-8':
            self.proc_out_str = lambda s: \
                s.replace('<', '<3c>').replace('\\', '<5c>'). \
                encode(self.charCode, "ignore")
                # .replace("\\", "\\\\")
        else:
            self.proc_out_str = lambda s: \
                re.sub("\\\\x([0-9a-f]{2})", "\\u00\\1", \
                    s.replace('<', '<3c>').replace('\\', '<5c>'). \
                    encode(self.charCode, "backslashreplace")). \
                encode("utf-8")
        pass

    def evalInR(self, text, mode, timeout = .5):
        return self.connect(text, mode, False, timeout, self.uid())

    def evalInRNotify(self, text, mode, uid):
        log.debug("evalInRNotify: text=%s ..." % text[0:10])
        t = threading.Thread(target = self.connect, args = (text, mode, True, None, uid))
        t.daemon = True
        t.start()
        
    @components.ProxyToMainThread
    def notifyObservers(self, subject, topic, data):
        obsSvc = components.classes["@mozilla.org/observer-service;1"]. \
                 getService(components.interfaces.nsIObserverService)
        obsSvc.notifyObservers(subject, topic, data)

    @components.ProxyToMainThread
    def requestHandlerEvent(self, requestHandler, data):
        return requestHandler.onDone(data)

    def connect(self, text, mode, notify, timeout, uid):
        if text.startswith("\x05"):
            rcommand = text[text.find(";") + 1:]
        else:
            rcommand = text
 
        self.lastCommand = unicode(rcommand)
        log.debug("connect: 'text' was \n%s ... \n(notify=%d, mode=%s)" %
                  (rcommand[0:36], notify, mode))

        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        try: s.connect(self.socketOut)
        except IOError, e:
            # Windows: timeout('timed out',)
            # Linux: error(111, '... rejected')
            # e.message or e.strerror
            return unicode('\x15\x15' + (e.args[0] if (e.errno == None) else e.strerror))

        cmdInfo = self.CommandInfo(uid, rcommand, mode, False, 'Not ready')

        if notify:
            self.notifyObservers(WrapObject(cmdInfo, components.interfaces.korICommandInfo),
                'r-command-sent', None)
        
        modeArr = mode.split(' ')
        rMode = 'h' if modeArr.count('h') else 'e'
        if modeArr.count('r'):
            rMode += 'r'
            
        full_command = '\x01a' \
            + rMode \
            + '<' + uid + '>' \
            + self.proc_out_str(text). \
              replace("\n", "\\n").replace("\r", "\\r").replace("\f", "\\f")

        # command syntax:
        # \x01 {mode byte} \x0b uid or filename \x0b command \n

        # encode('utf-8') must be matched by R/pkg/exec/rserver.tcl:
        # fconfigure $sock ... -encoding "utf-8"
        
        # XXX os.linesep or \n ?
        s.send(full_command + os.linesep) ## text must end with newline
        s.shutdown(socket.SHUT_WR)
        all_data = []
        try:
            while True:
                data = s.recv(4096L)
                if not data: break
                all_data.append(data)
        except Exception, e:
            log.debug(e)
            pass
        s.close()
        
        message = ''
        result = ''
        result_arr = ''.join(all_data).rstrip().split("\x1f")
    
        ## NEW RESULT FORMAT "message<US>browserMode<US>output"
        ## US=\x1f, \037
        
        if len(result_arr) == 3:
            # 1. <hh> => \\xhh # <hh> sequences generated by R's iconv(sub = "bytes") 
            # 2. \\ => \ # decode("string_escape")
            # 3. to UTF-8
            result = \
                re.sub('<([0-9a-f]{2})>', '\\x\\1', result_arr[2]) \
                .decode('string_escape') \
                .decode('utf-8', 'ignore')
            # re.sub('\x1b[\x02\x03];', '', # XXX: temporary? fix
            # )
                     
        else:
            result_arr = [ 'empty', 'FALSE', u'' ]
            log.info("Malformed result received. Contents:\n%s", result_arr)

        cmdInfo.result = unicode(result)
        cmdInfo.message = unicode(result_arr[0])
        cmdInfo.browserMode = result_arr[1] == "TRUE"

        self.lastMessage = message
        self.lastResult = result
        self.lastCommandInfo = WrapObject(cmdInfo, components.interfaces.korICommandInfo)
        if notify:
            self.notifyObservers(
                WrapObject(cmdInfo, components.interfaces.korICommandInfo),
                'r-command-executed', None)
            log.debug("connect notify:\n%s[...]" % result[0:256])
            return

        log.debug("connect return:\n%s[...]" % result[0:256])
        return cmdInfo.result

    def __del__(self):
        try:
            log.debug("destructor called: closing server")
            self.serverConn.close()
        except:
            pass

    def serverIsUp(self):
        try:
            self.serverConn.fileno()
            return True
        except:
            return False

    def startSocketServer(self, requestHandler):
        if(self.serverIsUp()): return -1L
        self.runServer = True
        host = self.socketIn[0L]
        port = self.socketIn[1L]
        if(port > 70000L): port = 10000L
        port_max = port + 32L
        while port < port_max:
            try:
                self.serverConn = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                self.serverConn.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 0)
                self.serverConn.settimeout(5)
                log.debug('trying socket (%s, %d) ' % (host, port))
                self.serverConn.bind((host, port))
                break
            except Exception, e:
                log.error(e.args)   # ERROR 10048, ERROR 98: Address already in use
                self.serverConn.close()
                port += 1L
        if (port >= port_max): return 0L # TODO: fix this
        self.socketIn = (host, port)
        log.debug('startSocketServer: starting thread')
        t = threading.Thread(target=self._Serve,
                             kwargs={ 'requestHandler': requestHandler })
        t.start()
        log.debug('Serving on port %d' % port)
        self.notifyObservers(None, 'r-server-started',
            json.dumps({'port': port}))
        return port

    def stopSocketServer(self):
        try:
            self.serverConn.close()
        except:
            pass
        self.runServer = False
        log.debug('Told socket server to stop')

    def _Serve(self, requestHandler):
        # requestHandler is a Javascript object with component 'onDone'
        # which is a function accepting one argument (string), and returning
        # a string
        try:
            self.serverConn.listen(1)
            log.debug('Socket server listening at %d' % self.socketIn[1])
            count = 0
            connected = False
            while self.runServer:
                while self.runServer and self.serverIsUp():
                    connected = False
                    try:
                        conn, addr = self.serverConn.accept()
                        connected = True
                        conn.setblocking(1)
                        self.serverConn.settimeout(10)
                        count += 1L
                        break
                    except Exception: continue
                if not connected: continue
                data = u''
                try:
                    while connected:
                        log.debug('Connected by %s : %d' % addr)
                        data_chunk = conn.recv(1024L)   # XXX: error: [Errno 10054]
                        data += unicode(data_chunk) # XXX , encoding?
                        if (not data_chunk) or (data_chunk[-1] == '\n'): break
                except Exception, e:
                    log.error(e.args)
                    conn.close()
                    break
                conn.shutdown(socket.SHUT_RD)
                log.debug('conn finished reading')
                try:
                    data = re.sub('<([0-9a-f]{2})>', '\\x\\1', data) \
                        .decode('string_escape').decode('utf-8', 'ignore')
                    result = self.requestHandlerEvent(requestHandler, data)
                except Exception, e:
                    result = e.args[0]
                    log.debug('JS request exception: %s' % result)
                if (result == None): conn.send('\n')
                else: conn.send(result + '\n')
            
                conn.shutdown(socket.SHUT_RDWR)
                conn.close()
                log.debug('conn closed')
        except Exception, e:
            log.debug(e.args)
        self.stopSocketServer()

        log.debug("Exiting after %d connections" % count)
        try:
            self.notifyObservers(None, 'r-server-stopped', None)
        except Exception, e:
            log.debug(e)
            pass
        pass

    def uid(self):
        return(uuid1().hex)

    def escape(self):
        self.evalInRNotify('\x1b', '', 'esc')
        pass
        
# //JS:
# var sm = kor.cmdout.scimoz
# function sty2num(sty) sty.split('').map(function(x) x.charCodeAt(0))
# sty = svu.makeStyledText(res.replace(/\r\n/g, '; '))
# res = svu.evalInR('message("abc>");message("123>"); message("456>")', 'json h', true)
