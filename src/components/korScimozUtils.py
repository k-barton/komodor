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
        self.STYLE_STDERR = 1
        self.STYLE_STDOUT = 0
        
        log.debug("korScimozUtils initilized")
        
        pass
    
    def encodeString(self, s, encoding, errors = "strict"):
        """
        possible values for errors are 'strict', 'ignore', 'replace', 
        'xmlcharrefreplace', 'backslashreplace'
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
    
    def UTF8Length(self, s):
        return len(s.encode('utf-8'))
    
    def appendText(self, s):
        self.scimoz.appendText(self.UTF8Length(s), s);
        pass
       
        
    def printWithMarks(self, s, replace = False, lineNum = 0):
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
                chunks.append((style, chunk, self.UTF8Length(chunk)))
                # log.debug("appended: i=%d, p2=%d, style=%" % (cntr, p2, style))
            p1 = p2 + 1
            style = self.STYLE_STDOUT if s[p2] == '\x02' else self.STYLE_STDERR
        if total_len + cntr < len(s):
            chunk = s[(p2 + 1):]
            chunks.append((style, chunk, self.UTF8Length(chunk)))
        
        s1 = ''.join([x[1] for x in chunks])
        # l1 = len(s1)
        style_arr = None
        if replace:
            # l1 = self.UTF8Length(s1)
            l1 = sum([x[2] for x in chunks])
            if lineNum < 0:
                lineNum = max(0, scimoz.lineCount + lineNum) # last line = lineCount - 1
            else:
                lineNum = min(scimoz.lineCount - 1, lineNum)
            
            pos = scimoz.positionFromLine(lineNum)
            
            # position = byte pos in utf8 string, charPos = actual pos in text
            pend = scimoz.positionAtChar(0, scimoz.charPosAtPosition(pos) + len(s1))
            pend = min(pend, scimoz.getLineEndPosition(lineNum))
            if scimoz.textLength > pend:
                style_arr = scimoz.getStyleRange(pend, scimoz.textLength) # scimoz.positionAfter(pend)?
            scimoz.targetStart = pos
            scimoz.targetEnd = pend
            scimoz.replaceTarget(-1, s1)
        else:
            pos = scimoz.textLength
            scimoz.appendText(-1, s1)
        
        # log.debug("[1] text added at pos=%d" % (pos))
        scimoz.startStyling(pos, styleMask)
        for x in chunks:
            scimoz.setStyling(x[2], x[0]) # length, style
            # log.debug("[1] styling with %d at pos=%d for %d" % (x[0], pos, x[2]))
            pos += x[2]
        # TODO: use ranges for equal values: 00011000 => 3,2,3... 
        if style_arr is not None:
            for s in style_arr:
                scimoz.setStyling(1, s)
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
