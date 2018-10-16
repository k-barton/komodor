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
import socket
import threading
from uuid import uuid1

import logging
log = logging.getLogger('korRConnector')
#log.setLevel(logging.DEBUG)

class korRConnector:
    _com_interfaces_ = [components.interfaces.korIRConnector]
    _reg_desc_ = "KomodoR R connection mediator"
    _reg_clsid_ = "{22A6C234-CC35-D374-2F01-FD4C605C905C}"
    _reg_contractid_ = "@komodor/korRConnector;1"

    class CommandInfo:
        _com_interfaces_ = components.interfaces.korICommandInfo
        def __init__(self, cmd_id, cmd, mode, browserMode = False, message = '', result = ''):
            self.commandId = cmd_id
            self.command = cmd
            self.mode = mode
            self.browserMode = browserMode
            self.message = message
            self.result = result

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
        pass

    def setSocketInfo(self, host, port, outgoing):
        log.debug("setSocketInfo (%s): %s:%d" % ('outgoing' if outgoing else
                                                 'incoming', host, port))
        if outgoing: self.socketOut = (host, port)
        else: self.socketIn = (host, port)
        pass

    def _asSString(self, s):
        ret = components.classes["@mozilla.org/supports-string;1"] \
            .createInstance(components.interfaces.nsISupportsString)
        ret.data = unicode(s)
        return(ret)

    def _asSInt(self, n):
        ret = components.classes["@mozilla.org/supports-PRInt32;1"] \
            .createInstance(components.interfaces.nsISupportsPRInt32);
        ret.data = long(n)
        return(ret)

    def evalInR(self, command, mode, timeout = .5):
        return self.connect(command, mode, False, timeout, self.uid())

    def evalInRNotify(self, command, mode, uid):
        log.debug("evalInRNotify: command=%s ..." % command[0:10])
        t = threading.Thread(target=self.connect, args=(command, mode, True, None, uid))
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

    def connect(self, command, mode, notify, timeout, uid):
        # pretty_command = self.pushLeft(command, indent=3L, eol='\n', tabwidth=4)[3:]
        
        if command.startswith("\x05"):
            rcommand = command[command.find(";") + 1:]
        else:
            rcommand = command
 
        
        self.lastCommand = unicode(rcommand)
        ssLastCmd = self._asSString(rcommand)
        log.debug("connect: command was \n%s ... \n(notify=%d)" % (rcommand[0:36], notify))

        modeArr = mode.split(' ')

        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        try: s.connect(self.socketOut)
        except IOError, e:
            # Windows: timeout('timed out',)
            # Linux: error(111, '... rejected')
            # e.message or e.strerror
            return unicode('\x15' + (e.args[0] if (e.errno == None) else e.strerror))

        cmdInfo = self.CommandInfo(uid, rcommand, mode, False, 'Not ready')

        #wrappedCmdInfo = WrapObject(cmdInfo, components.interfaces.korICommandInfo)
        if notify:
            # self._proxiedObsSvc.notifyObservers(
                # WrapObject(cmdInfo, components.interfaces.korICommandInfo),
                # 'r-command-sent', None)
            self.notifyObservers(WrapObject(cmdInfo, 
                components.interfaces.korICommandInfo),
                'r-command-sent', None)
        

        rMode = 'h' if modeArr.count('h') else 'e'
        # if isinstance(command, unicode):
            # command = command.encode("UTF-8")
        full_command = '\x01a' \
            + rMode \
            + '<' + uid + '>' \
            + command.replace("\\", "\\\\"). \
                replace("\n", "\\n").replace("\r", "\\r").replace("\f", "\\f")

        s.send(full_command + os.linesep)
        ## command must end with newline
        s.shutdown(socket.SHUT_WR)
        all_data = []
        try:
            while True:
                data = s.recv(1024L)
                if not data: break
                all_data.append(data)
        except Exception, e:
            log.debug(e)
            pass
        s.close()
        
        message = ''
        resultObj = ''.join(all_data).rstrip().split("\x1f")
    
        ## NEW RESULT FORMAT "message<US>browserMode<US>output"
        ## US=\x1f, \037
        
        if len(resultObj) == 3:
            result = resultObj[2]
            # 1. <hh> => \\xhh
            # 2. \\ => \
            # 3. \032{<hh>} => <hh>, \032{\032} => \032
            # 4. to UTF-8
            result = re.sub("\x1a\{(\x1a|<[0-9a-f]{2}>)\}", "\\1",
                re.sub('(?<!\x1a\{)<([0-9a-f]{2})>', '\\x\\1', result)
                    .decode('string_escape')) \
                    .decode("utf-8") \
                    .replace('\x02\x03', '') # XXX: temporary fix
        else:
            resultObj = [ 'empty', 'FALSE', u'' ]
            log.info("%s. Result was:\n%s", e, resultObj)

        cmdInfo.result = unicode(result)
        cmdInfo.message = unicode(resultObj[0])
        cmdInfo.browserMode = resultObj[1] == "TRUE"

        self.lastMessage = message
        self.lastResult = result
        self.lastCommandInfo = WrapObject(cmdInfo, components.interfaces.korICommandInfo)
        if notify:
            self.notifyObservers(
                # XXX self.lastCommandInfo
                WrapObject(cmdInfo, components.interfaces.korICommandInfo),
                'r-command-executed',
                result)
            log.debug("connect notify: %s..." % result[0:50])
            return

        log.debug("connect return: %s..." % result[0:50])
        return unicode(result)

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
                log.debug('trying socket (%s, %d) ', host, port)
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
        self.notifyObservers(self._asSInt(port), 'r-server-started', None)
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
            log.debug('Socket server listening at %d', self.socketIn[1])
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
                data_all = u''
                try:
                    while connected:
                        log.debug('Connected by %s : %d', addr)
                        data = conn.recv(1024L)   # XXX: error: [Errno 10054]
                        data_all += unicode(data) # XXX , encoding?
                        if (not data) or (data[-1] == '\n'): break
                except Exception, e:
                    log.error(e.args)
                    conn.close()
                    break
                conn.shutdown(socket.SHUT_RD)
                log.debug('conn finished reading')
                try:
                    result = self.requestHandlerEvent(requestHandler, data_all)
                except Exception, e:
                    result = e.args[0]
                    log.debug('JS request exception: %s', result)
                if (result == None): conn.send('\n')
                else: conn.send(result + '\n')
            
                conn.shutdown(socket.SHUT_RDWR)
                conn.close()
                log.debug('conn closed')
        except Exception, e:
            log.debug(e.args)
        self.stopSocketServer()

        log.debug("Exiting after %d connections", count)
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
