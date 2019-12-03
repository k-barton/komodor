from xpcom import components, nsError, COMException
from xpcom.server.enumerator import SimpleEnumerator

import os, sys, re
import string

import threading, io, time

import logging
log = logging.getLogger('korScimozUtils')

class korScimozUtils:
    _com_interfaces_ = [components.interfaces.korIScimozUtils]
    _reg_desc_ = "KomodoR scimoz related utilities"
    _reg_clsid_ = "{c0111de2-19d6-44ee-9ce9-a410796f3528}"
    _reg_contractid_ = "@komodor/korScimozUtils;1"

    def __init__(self):
        self.scimoz = None
        self.STYLE_STDERR = 1
        self.STYLE_STDOUT = 0
        self.last_style = self.STYLE_STDOUT
        log.debug("korScimozUtils initilized")
    
    def encodeString(self, s, encoding, errors = "strict"):
        """
        possible values for "errors" are 'strict', 'ignore', 'replace', 
        'xmlcharrefreplace', 'backslashreplace'
        """
        try:
            return s.encode(encoding, errors)
        except Exception, e:
            return ''
    
    def UTF8Length(self, s):
        return len(s.encode('utf-8'))
    
    def unicodeUnescape(self, s):
        return re.sub("<U\\+([0-9A-F]{4})>",
            lambda m: unichr(int(m.group(1), 16)), s)
    
    @components.ProxyToMainThread
    def notifyObservers(self, subject, topic, data):
        obsSvc = components.classes["@mozilla.org/observer-service;1"]. \
                 getService(components.interfaces.nsIObserverService)
        obsSvc.notifyObservers(subject, topic, data)
        
    @components.ProxyToMainThread   
    def appendText(self, s):
        self.scimoz.appendText(self.UTF8Length(s), s);
        pass

    @components.ProxyToMainThread
    def printWithMarks(self, s, replace = False, lineNum = 0, colNum = 0):
        if self.scimoz is None:
            raise Exception("'scimoz' is not set")
            return
        scimoz = self.scimoz
        readOnly = scimoz.readOnly
        scimoz.readOnly = False
        styleMask = (1 << scimoz.styleBits) - 1
        p1 = 0
        p2 = -1
        chunks = []
        style = self.last_style
        for m in re.finditer('\x1b[\x02\x03];', s):
            p2 = m.start()
            if p2 > p1:
                chunk = s[p1:p2]
                chunks.append((style, self.UTF8Length(chunk), chunk))
            # log.debug("appended: i=%d, p2=%d, style=%" % (count, p2, style))
            p1 = m.end()
            style = self.STYLE_STDOUT if s[p2:p1] == '\x1b\x02;' else self.STYLE_STDERR
        if p1 < len(s):
            chunk = s[p1:]
            chunks.append((style, self.UTF8Length(chunk), chunk))
        
        s1 = ''.join([x[2] for x in chunks])
        # l1 = len(s1)
        style_arr = None
        if replace:
            # l1 = self.UTF8Length(s1)
            l1 = sum([x[1] for x in chunks])
            if lineNum < 0:
                # -1 is last line, 0 is line #0
                lineNum = max(0, scimoz.lineCount + lineNum) # last line = lineCount - 1
            else:
                lineNum = min(scimoz.lineCount - 1, lineNum)
            
            posline = scimoz.positionFromLine(lineNum)
            pos = posline if colNum == 0 else \
                scimoz.positionAtChar(0, scimoz.charPosAtPosition(posline) + colNum)
            
            # position = byte pos in utf8 string, charPos = actual pos in text
            # it's ok if arg2 goes beyond text length, retval never does.
            pend = scimoz.positionAtChar(0, scimoz.charPosAtPosition(pos) + len(s1))
            # Note this assumes s1 has no newlines (because of lineNum)
            pend = min(pend, scimoz.getLineEndPosition(lineNum))
            if scimoz.textLength > pend:
                style_arr = scimoz.getStyleRange(pend, scimoz.textLength) # scimoz.positionAfter(pend)?
            scimoz.targetStart = pos
            scimoz.targetEnd = pend
            scimoz.replaceTarget(-1, s1)
            endpos = scimoz.targetEnd
        else:
            pos = scimoz.textLength
            scimoz.appendText(-1, s1)
            endpos = scimoz.textLength
            
        # log.debug("[1] text added at pos=%d" % (pos))
        scimoz.startStyling(pos, styleMask)
        for style, length, _ in chunks:
            scimoz.setStyling(length, style)
            # log.debug("[1] styling with %d at pos=%d for %d" % (x[0], pos, x[2]))
            pos += length
        # TODO: use ranges for equal values: 00011000 => 3,2,3...
        self.last_style = style
        if style_arr is not None:
            for s in style_arr:
                scimoz.setStyling(1, s)
        scimoz.readOnly = readOnly
        return endpos
        
    def printResult(self, cmdinfo, unnnUnescape = False):
        self.printWithMarks(self.unicodeUnescape(cmdinfo.result) \
            if unnnUnescape else cmdinfo.result)


    @components.ProxyToMainThread
    def printLines(self, lines, pos):
        s = self.scimoz
        if (pos is None) or (pos < 0):
            pos = s.length
            replace = False
            linenum = 0
            col = 0
        else:
            replace = pos < s.length
            linenum = s.lineFromPosition(pos)
            col = pos - s.positionFromLine(linenum)
        
        lastpos = self.printWithMarks(''.join(lines), replace, linenum, col)
        self.scimoz.scrollToEnd()
        return lastpos

    @components.ProxyToMainThread
    def printLine(self, text, pos = None):
        s = self.scimoz
        if (pos is None) or (pos < 0):
            pos = s.length
            replace = False
        else:
            replace = pos < s.length
        matchendl = re.search('(\r\n|\r|\n)$', text)
        haseol = matchendl is not None

        if haseol:
            text = text[0:(matchendl.start())]
            if matchendl.group(0) == "\r":
                eol = 2
            else:
                eol = 1
                if not replace:
                    text += ["\r\n", "\r", "\n"][s.eOLMode]
        else:
            eol = 0

        if replace:
            line = s.lineFromPosition(pos)
            col = pos - s.positionFromLine(line)
        else:
            line = 0
            col = 0
        
        lastpos = self.printWithMarks(text, replace, line, col)
        if eol == 2:
            # move pos to line start
            lastpos = s.positionFromLine(s.lineFromPosition(lastpos))
        elif replace and eol == 1:
            # inserted text ending with newline
            # if this is last line - append EOL
            # otherwise, move pos to the start of a following line
            if s.lineFromPosition(lastpos) == s.lineFromPosition(s.length):
                s.appendText(["\r\n", "\r", "\n"][s.eOLMode])
                lastpos = s.length
            else:
                lastpos = s.positionFromLine(s.lineFromPosition(lastpos) + 1) 
        s.scrollToEnd()
        return lastpos
    
    @components.ProxyToMainThread
    def getEol(self):
        return ["\r\n", "\r", "\n"][self.scimoz.eOLMode]

    def _fileToConsole(self, filename, encoding, notify):
        """Synchronous read.
        
        File check interval changes with time. Currently the interval is
        hardcoded.
        """
        def vrange(interval, duration):
            l = map(lambda d, v: int(d / v), duration, interval)
            n = len(l)
            for i in range(n):
                y = interval[i]
                for j in xrange(l[i]):
                    yield y
        
        n1 = 300
        t1 = .1
        for i in xrange(n1):
            if os.path.isfile(filename):
                break
            time.sleep(t1)
        
        try:
            file = io.open(filename, 'r', encoding = encoding, newline = '')
        except IOError, e:
            log.error('cannot open file %s', filename)
            return
        try:
            eol = self.getEol()
            pos = None
            self.last_style = self.STYLE_STDOUT
            lines = []
            for interval in vrange([0.05, 0.1, 1, 2, 15], [5, 55, 240, 3300, 259200]):

                line = file.readline()
                if not line:
                    if len(lines) != 0:
                        pos = self.printLines(lines, pos)
                        del lines[:]
                    time.sleep(interval)
                elif line.endswith('\n'): # including \r\n
                    lines.append(line[:(-2 if line.endswith('\r\n') else -1)] + eol)
                    if len(lines) > 12:
                        pos = self.printLines(lines, pos)
                        del lines[:]
                else: # not \n
                    if len(lines):
                        pos = self.printLines(lines, pos)
                        del lines[:]
                    if line.endswith('\x1b\x04;'):
                        break
                    # pos = self.printLine("[%d] %s" % (i, line), pos)
                    pos = self.printLine(line, pos)
        except Exception, e:
            log.exception(e)
        finally:
            file.close()
            if notify:
                self.notifyObservers(None, 'file-reading-finished', filename)
        pass
    
    def fileToConsole(self, filename, encoding, notify = False):
        """Asynchronous read.
        """
        # max. waiting time for the file 10 sec.
        if self.scimoz is None:
            raise Exception("'scimoz' is not set")
            return
        t = threading.Thread(target = self._fileToConsole,
            args = (filename, encoding, notify))
        t.daemon = False
        t.start()
