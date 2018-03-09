from xpcom import components, nsError, COMException
from xpcom.server.enumerator import SimpleEnumerator

import os, sys, re
import string

import logging
log = logging.getLogger('korScimozUtils')

class korScimozUtils:
    _com_interfaces_ = [components.interfaces.korIScimozUtils]
    _reg_desc_ = "KomodoR scimoz related utilities"
    _reg_clsid_ = "{c0111de2-19d6-44ee-9ce9-a410796f3528}"
    _reg_contractid_ = "@komodor/korScimozUtils;1"

    def __init__(self):
        self.scimoz = None
        log.debug("korScimozUtils initilized")  
        pass
    
    def encodeString(self, s, encoding, errors = "strict"):
        """
        possible values for errors are 'strict', 'ignore', 'replace', 
        'xmlcharrefreplace', 'backslashreplace
        """
        try:
            return s.encode(encoding, errors)
        except Exception, e:
            return ''
        
        # try:
        #     return s.encode(encoding, errors)
        # except Exception, e:
        # # except UnicodeError, e:
        #     return u''
    
    def printResult(self, cmdinfo):
        self.printWithMarks(cmdinfo.result)
        # self.printResult2(cmdinfo.result)
    
    def UTF8Length(self, s):
        return len(s.encode('utf-8'))
    
    def appendText(self, s):
        self.scimoz.appendText(len(s.encode('utf-8')), s);
        pass
       
        
    def printWithMarks(self, s):
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
        style = 0
        total_len = 0
        cntr = 0
        for m in re.finditer('[\x02\x03]', s):
            cntr += 1
            p2 = m.start(0)
            total_len += p2 - p1
            if(p1 < p2):
                chunk = s[p1:p2]
                chunks.append((style, chunk, len(chunk.encode('utf-8'))))
                # log.debug("appended: i=%d, p2=%d, style=%" % (cntr, p2, style))
            p1 = p2 + 1
            style = 0 if s[p2] == '\x02' else 23
            
        if total_len + cntr < len(s):
            chunk = s[(p2 + 1):]
            chunks.append((style, chunk, len(chunk.encode('utf-8'))))
        pos = scimoz.textLength
        scimoz.appendText(sum([x[2] for x in chunks]), ''.join([x[1] for x in chunks]))
        # log.debug("[1] text appended at pos=%d" % (pos))
        for x in chunks:
            scimoz.startStyling(pos, styleMask)
            scimoz.setStyling(x[2], x[0])
            # log.debug("[1] styling with %d at pos=%d for %d" % (x[0], pos, x[2]))
            pos += x[2]
        scimoz.readOnly = readOnly

    def printResult2(self, result):
        """
        DEPRECATED
        """
        if self.scimoz is None:
            raise Exception("'scimoz' is not set")
            return
        scimoz = self.scimoz
        readOnly = scimoz.readOnly
        scimoz.readOnly = False
        # styleMask = (1 << scimoz.styleBits) - 1
        styleMask = (1 << scimoz.styleBits) - 1
        try:
            chunks = re.split('[\x03\x02]', result)
            s = ''.join(chunks)
            txtlen = len(s.encode('utf-8'))
            pos = scimoz.textLength
            scimoz.appendText(txtlen, s)
            log.debug("[2] text appended at pos=%d" % (pos))
            inStdOut = False
            for s in chunks:
                inStdOut = not inStdOut
                curStyle = 0 if inStdOut else 23
                txtlen = len(s.encode('utf-8'))
                scimoz.startStyling(pos, styleMask)
                scimoz.setStyling(txtlen, curStyle)
                log.debug("[2] styling with %d at pos=%d for %d" % (curStyle, pos, txtlen))
                pos += txtlen
        finally:
            scimoz.readOnly = readOnly

    #XXX use pushLeft to make pretty command at printing time
    def pushLeft(self, text, eol = os.linesep, indent = 0, tabwidth = 4):
        text = text.lstrip("\r\n\f")
        if not text: return ''
        re_line = re.compile('(^[\t ]*)(?=\S)(.*$)', re.MULTILINE)
        if type(indent) in (str, unicode):
           indentstr = indent
           indent = len(indentstr)
        else:
           indentstr = ' ' * indent
        lines = re.findall(re_line, text)
        indent_len = map(lambda line: len(string.expandtabs(line[0], tabwidth)), lines)
        ## XXX: indent_len = [ len(string.expandtabs(line[0], tabwidth)) for line in lines ]
        baseind = min(indent_len)
        if (baseind == 0 and indent == 0): return text
        return eol.join(map(lambda nspaces, line: \
                indentstr + (' ' * (nspaces - baseind)) + \
                line[1], indent_len, lines))
