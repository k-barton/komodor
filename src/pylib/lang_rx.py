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

"""
R_extended support for codeintel.
"""
import os
import sys
# import logging
import operator

from codeintel2.common import *
from codeintel2.citadel import CitadelBuffer, CitadelLangIntel
from codeintel2.langintel import LangIntel
from codeintel2.langintel import ParenStyleCalltipIntelMixin, ProgLangTriggerIntelMixin
from codeintel2.udl import UDLLexer, UDLBuffer, UDLCILEDriver
from codeintel2.util import CompareNPunctLast
# from codeintel2.accessor import AccessorCache, Accessor


#from SilverCity import find_lexer_module_by_id, PropertySet, WordList

from SilverCity.ScintillaConstants import (
    SCE_UDL_SSL_DEFAULT, SCE_UDL_SSL_IDENTIFIER, SCE_UDL_SSL_OPERATOR,
    SCE_UDL_SSL_VARIABLE, SCE_UDL_SSL_WORD, SCE_UDL_SSL_COMMENT,
    SCE_UDL_SSL_COMMENTBLOCK, SCE_UDL_SSL_STRING
)

try:
    from xpcom import components
    from xpcom.server import UnwrapObject
    _xpcom_ = True
except ImportError:
    _xpcom_ = False
    
    
try:
    from rconnect import RConn
except ImportError:
    sys.path.append(os.path.dirname(__file__))
    from rconnect import RConn
   
#from xpcom import components
#R = components.classes["@komodor/korRConnector;1"].\
#    getService(components.interfaces.korIRConnector)

#---- Globals
lang = "R_extended"
# log = logging.getLogger("codeintel.R")

# These keywords and builtin functions are copied from "Rlex.udl".
# Reserved keywords
keywords = [
    "...", "break", "else", "FALSE", "for", "function", "if", "in", "Inf", "NA",
    "NaN", "next", "NULL", "repeat", "TRUE", "while",
]


#---- Lexer class
class RxLexer(UDLLexer):
    lang = lang

# TODO: how to update keyword lists dynamically?
    #def __init__(self):
    #self._properties = SilverCity.PropertySet()
    #self._keyword_lists = [
        #SilverCity.WordList(SilverCity.Keywords.perl_keywords),
        #SilverCity.WordList("")
    #]
    #SilverCity.WordList("fsfsd fsfsdf")

# possible R triggers:
# library|require(<|>     available packages
# detach(<|>      loaded namespaces
# data(<|>        available datasets
# func(<|>        calltip or argument names
# func(arg,<|>    argument names
# func(firstar<|>    argument names
# func(arg, secondar<|>    argument names
# list $ <|>        list elements
# s4object @ <|>    slots
# namespace:: <|>  objects within namespace
# namespace::: <|>  objects within namespace
# variab<|>       complete variable names
# "<|>            file paths
# Note that each name may be single, double or backtick quoted, or in multiple
# lines

# TODO:
#  object$func(<|>) complete arguments

#---- LangIntel class
class RxLangIntel(CitadelLangIntel, ParenStyleCalltipIntelMixin,
                   ProgLangTriggerIntelMixin):
    lang = lang

    # Used by ProgLangTriggerIntelMixin.preceding_trg_from_pos()
    #trg_chars = tuple('$@[( ')
    #calltip_trg_chars = tuple('(,')

    # named styles used by the class
    whitespace_style = SCE_UDL_SSL_DEFAULT
    operator_style   = SCE_UDL_SSL_OPERATOR
    identifier_style = SCE_UDL_SSL_IDENTIFIER
    keyword_style    = SCE_UDL_SSL_WORD
    variable_style   = SCE_UDL_SSL_VARIABLE
    string_style     = SCE_UDL_SSL_STRING
    comment_styles   = (SCE_UDL_SSL_COMMENT, SCE_UDL_SSL_COMMENTBLOCK)
    comment_styles_or_whitespace = comment_styles + (whitespace_style, )
    word_styles      = (variable_style, identifier_style, keyword_style)
    ##
    namespace_style  = keyword_style
    argument_style   = variable_style
    element_style    = variable_style
    varname_styles   = (identifier_style, keyword_style)
    
    # R functions that accept graphical parameters (par)
    func_graphics = ('plot', 'boxplot', 'bxp', 'box', 'curve', 'line', 'points',
                'text', 'mtext', 'title', 'image',)

    type_sep = u'\u001e'
    pathsep = os.sep + ("" if(os.altsep is None) else os.altsep)
    
    _rconn = None
    def _rconn_set_r_port(self, env, pref_name):
        # TODO: put this together with RConn.read_port_no'
        port = None
        if _xpcom_:
            koPrefs = components.classes["@activestate.com/koPrefService;1"] \
                .getService(components.interfaces.koIPrefService).prefs
            if koPrefs.hasPref(pref_name):
                try: port = int(koPrefs.getDouble(pref_name))
                except: port = int(koPrefs.getLong(pref_name))
                finally: port = None if port == 0 else port
        if port is None:
            try:
                # XXX: this does not work: how to access the preferences without xpcom?
                port = int(env.get_pref(pref_name))
            except:
                port = self._rconn.read_port_no()
        if port is not None:
            self._rconn.port = port
        pass
    
    def _eval_in_r(self, cmd, env):
        """evaluate cmd in R.
        """
        if self._rconn is None:
            self._rconn = RConn(-1)
            self._rconn_set_r_port(env, "RInterface.RPort")
            # env.add_pref_observer("RInterface.RPort", self._rconn_set_r_port)
        return self._rconn.eval_in_r(cmd)
    
    ##
    # Implicit triggering event, i.e. when typing in the editor.
    #
    def trg_from_pos(self, buf, pos, implicit=True, DEBUG=False, ac=None):
        """If the given position is a _likely_ trigger point, return a
        relevant Trigger instance. Otherwise return the None.
            "pos" is the position at which to check for a trigger point.
            "implicit" (optional) is a boolean indicating if this trigger
                is being implicitly checked (i.e. as a side-effect of
                typing). Defaults to true.
        """
        if pos < 3:
            return None

        acc = buf.accessor
        last_pos = pos - 1
        char = acc.char_at_pos(last_pos)
        
        # complete argument names after ,<space>
        complete_arg = (char in ' \t\n\r') and (acc.char_at_pos(last_pos - 1) == ',')
        if complete_arg:
            last_pos -= 1
            char = ','
        
        style = acc.style_at_pos(last_pos)
        
        if style == self.operator_style:
            if complete_arg or (char in '[('):
                infun = self._in_func(pos, acc)
                if infun is not None:
                    s, e, funcname, nargs, argnames, firstarg = infun
                    return Trigger(self.lang, TRG_FORM_CPLN, "args", pos, True,
                        funcname = funcname, firstarg = firstarg, nargs = nargs,
                        argnames = argnames)
                return None

            elif char in '@$:' and (char != ':' or \
                acc.char_at_pos(last_pos - 1) == ':'):
                vr = self._get_var_back(last_pos, acc)
                if vr is not None:
                    return Trigger(self.lang, TRG_FORM_CPLN, "variable", vr[4],
                        True, obj_name = ''.join(vr[2]), cutoff = vr[3])
        if style == self.string_style and char in self.pathsep:
            s, e, w = self._get_word_back(last_pos, acc)
            if len(w) < 2:
                return None
            return self._trg_complete_path(w, pos, buf.env)
        return None

    def _unquote(self, text, quotes = '`"\''):
        if(len(text) > 1 and text[0] in quotes and text[-1] == text[0]):
            return text[1:len(text) - 1]
        return text

    def _is_bquoted(self, text):
        return len(text) > 1 and text.startswith('`') and text.endswith(text[0])


    ##
    # Explicit triggering event, i.e. Ctrl+J.
    #
    def preceding_trg_from_pos(self, buf, pos, curr_pos,
                               preceding_trg_terminators=None, DEBUG=False):

        if pos < 3:
            return None

        acc = buf.accessor
        last_pos = pos - 1

        style = acc.style_at_pos(last_pos)
        s, e, w = self._get_word_back(last_pos, acc)

        ch = acc.char_at_pos(pos)
        prv_ch = acc.char_at_pos(last_pos)
        # log.debug('w = "%s", ch = "%s", prv_ch = "%s", pos = %d, curr_pos = %d ' \
        #          % (w, ch, prv_ch, pos, curr_pos, ))
        if style in self.word_styles:
            if self._is_bquoted(w):
                return None
            s2, e2, w2 = self._get_word_back(s - 1, acc)
            # log.debug( 'w2 = "%s" ' % (w2, ) )

            if w2 and w2[-1] in ',(':
                infun = self._in_func(last_pos, acc)
                if infun is not None:
                    #print 'complete variable or argument "%s" for "%s"' % ( w, infun[2], )
                    s2, e2, funcname, nargs, argnames, firstarg = infun
                    return Trigger(self.lang, TRG_FORM_CPLN, "args", s, False,
                        funcname = funcname, firstarg = firstarg, nargs = nargs,
                        argnames = argnames, text = w)
                else:
                    return None
            else:
                vr = self._get_var_back(last_pos, acc)
                if vr is not None:
                    #print 'complete variable "%s"' % ( ''.join(vr[2]), )
                    return Trigger(self.lang, TRG_FORM_CPLN, "variable", vr[4],
                        False, obj_name = ''.join(vr[2]), cutoff = vr[3])
                return None
        if style == self.string_style:
            if len(w) < 2:
                return None
            return self._trg_complete_path(w, pos, buf.env)

        if not w:
            return None
        if w[-1] in ',(':
            infun = self._in_func(pos, acc)
            if infun is not None:
                s2, e2, funcname, nargs, argnames, firstarg = infun
                print 'arguments for "%s"' % ( infun[2], )
                return Trigger(self.lang, TRG_FORM_CPLN, "args", \
                    pos, False, funcname = funcname, firstarg = firstarg, \
                    nargs = nargs, argnames = argnames)

        elif w[-1] in '@$:':
            vr = self._get_var_back(last_pos, acc)
            if vr is not None:
                v = ''.join(vr[2])
                print 'complete "%s"' % ( v, )
                return Trigger(self.lang, TRG_FORM_CPLN, "variable", vr[4], ### pos + 1
                    False, obj_name = v, cutoff = vr[3])
        elif w in ('[', '[['):
            infun = self._in_func(pos, acc)
            if infun is not None:
                # log.debug( 'w = "%s", in_func = "%s" ' % (w, str(infun), ) )
                s2, e2, funcname, nargs, argnames, firstarg = infun
                # log.debug('arguments for "%s"' % ( infun[2], ))
                return Trigger(self.lang, TRG_FORM_CPLN, "args", \
                    pos, False, funcname = funcname, firstarg = firstarg, \
                    nargs = nargs, argnames = argnames)
            else:
                pass
                # log.debug( 'w = "%s", in_func is None' % (w, ) )
        # log.debug( 'None? w = "%s" ' % (w, ) )
        return None

    def async_eval_at_trg(self, buf, trg, ctlr):
        if _xpcom_:
            trg = UnwrapObject(trg)
            ctlr = UnwrapObject(ctlr)
        pos = trg.pos
        ctlr.start(buf, trg)
        extra = trg.extra

        if trg.id == (self.lang, TRG_FORM_CPLN, "args") or \
            trg.id == (self.lang, TRG_FORM_CPLN, "variable-or-args") :
            completions = self._get_completions_args(
                buf.env,
                extra.get('funcname'), extra.get('firstarg'), extra.get('nargs'),
                extra.get('argnames'), extra.get("text"))
        elif trg.id == (self.lang, TRG_FORM_CPLN, "variable") or \
            trg.id == (self.lang, TRG_FORM_CPLN, "sub-items") :
            completions = self._get_completions_default(
                extra.get('obj_name'), extra.get('cutoff'), buf.env)
        elif trg.id == (self.lang, TRG_FORM_CPLN, "path"):
            completions = self._get_completions_path(extra.get('text'))
        else:
            ctlr.error("Unknown trigger type: %r" % (trg, ))
            ctlr.done("error")
            return
        
        # TODO ctlr.set_calltips()
        # TODO TRG_FORM_CALLTIP, TRG_FORM_DEFN

        if completions is None:
            ctlr.done("not found")
            return

        result, cplns = completions
        if result == "error":
            ctlr.error("Nothing found" if completions is None else cplns)
            ctlr.done("error")
            return
        if result == "success":
            cplns = [x for x in cplns if len(x) == 2]
            cplns.sort(key = lambda x: x[1].lower() )
            ctlr.set_cplns(cplns)
            ctlr.done(cplns)
            return
            #ctlr.info("Not found for %r" % (trg, ))
            #ctlr.done("none found")
            #return

    #
    #   Rules for implementation:
    #- Must call ctlr.start(buf, trg) at start.
    #- Should call ctlr.set_desc(desc) near the start to provide a
    #  short description of the evaluation.
    #- Should log eval errors via ctlr.error(msg, args...).
    #- Should log other events via ctlr.{debug|info|warn}.
    #- Should respond to ctlr.abort() in a timely manner.
    #- If successful, must report results via one of
    #  ctlr.set_cplns() or ctlr.set_calltips().
    #- Must call ctlr.done(some_reason_string) when done.

    def _trg_complete_path(self, w, pos, env):
        path = w.lstrip('\'\"')
        abspath = os.path.expanduser(path)
        isabs = os.path.isabs(abspath)
        #posoff = 1 if all([ path.find(x) == -1 for x in self.pathsep ]) else 1
        # append /
        tokenlen = len(os.path.basename(abspath))
        abspath = os.path.dirname(abspath)
        if not abspath or abspath[-1] not in self.pathsep:
            abspath += os.sep
        if not isabs:
            pwd = self._rconn.eval_in_r('base::cat(base::getwd())').strip()
            if os.path.exists(pwd):
                abspath = os.path.join(pwd, abspath)
        # log.debug("complete path: " + abspath);
        if os.path.exists(abspath):
            # log.debug("Complete abs path: " + abspath)
            return Trigger(self.lang, TRG_FORM_CPLN, "path",
                pos - tokenlen, False, text = abspath)
        return None

    def _get_completions_args(self, env, fname, frstarg, nargs, argnames = None,
            text = ''):
        fname = self._unquote(fname)
        # log.debug("fname = '%s'" % (fname, ) )

        if fname in ('library', 'require', 'base::library', 'base::require') \
            and nargs == 1:
            cmd = 'kor::completeSpecial("library")'
        elif fname in ('detach', 'base::detach') and nargs == 1:
            cmd = 'kor::completeSpecial("search")'
        elif fname in ('data', 'base::data') and nargs == 1:
            cmd = 'kor::completeSpecial("data"); kor::completeArgs("data")'
        elif fname == 'par':
            cmd = 'kor::completeSpecial("par"); kor::completeArgs("par")'
        elif fname in self.func_graphics:
            cmd = ('kor::completeArgs("%s", %s); kor::completeSpecial("par")' \
                  % (fname, frstarg, )) \
                  + ('; kor::completion("%s")' % (text, ) if text else '')
        elif fname in ('options', 'getOption'):
            cmd = 'kor::completeSpecial("options"); kor::completeArgs("%s")' \
                  % (fname, )
        elif fname in ('[', '[['):
            cmd = 'kor::completeArgs("%s", %s);' % (fname, frstarg, )
            #if fname == '[[' or nargs == 2:
            cmd += 'kor::completeSpecial("[", %s, argpos=%d)' % (frstarg, nargs, )
        else:
            cmd = ('kor::completeArgs("%s", %s);' % (fname, frstarg, )) \
                + ('kor::completion("%s")' % (text, ) if text else '')
        #ret = []
        res = self._eval_in_r(cmd, env).rstrip()
        if len(res) == 0:
            return ('none found', 'No completions found')

        if res.startswith(u'\x03'):
            return ('error', res.strip("\x02\x03\r\n"))
        
        try:
            ret = [ tuple(x.split(self.type_sep)) for x in res.split(os.linesep) ]
        except:
            return ('none found', 'No completions available')
        if argnames:
            #log.debug("argnames = %s" % (", ".join(argnames) , ))
            argnames = [ x + ' =' for x in argnames ]
            ret = [ x for x in ret if x[1] not in argnames ]
            if not len(ret):
                return ('none found', 'No completions found')
        return ('success', ret, )

    def _get_completions_path(self, text):
        try:
            res = os.listdir(text)
            # log.debug("Complete abs path: %d" % (len(res), ))
            return ('success', [ \
                ("directory" if os.path.isdir(text + os.sep + x) else \
                 "file", x, ) for x in res ] )
            #return ('success', [('directory', x) for x in res ], )
        except:
            return ('none found', None, )

    def _get_completions_default(self, text, cutoff, env):
        if not text.strip(): return None
        cmd = 'kor::completion("%s")' % text.replace('"', '\\"')
        res = self._eval_in_r(cmd, env)
        
        #TODO: on timeout an empty string is returned
        #u'\x03Error: could not find function "completion"\r\n\x02'
        if res.startswith(u'\x03'):
            return ('error', res.strip("\x02\x03\r\n"))
        cplstr = res.replace('\x03', '').replace('\x02', '')
        if not cplstr: return None
        
        try:
            cpl = [ ( x[0], x[1][cutoff:] )
                for x in [ tuple(x.split(self.type_sep)) for x in
                          res.split(os.linesep) ] if len(x[1]) > cutoff ]
        except:
            return ('none found', 'No completions available')
            
        if len(cpl):
            return ('success', cpl)

        return ('none found', 'No completions found')

    def _skip_back_ws(self, pos, acc):
        if acc.style_at_pos(pos) == self.whitespace_style:
            return acc.contiguous_style_range_from_pos(pos)[0] - 1
        return pos

    def _get_word_back(self, pos, acc):
        pos = self._skip_back_ws(pos, acc)
        if pos < 0:
            return (0, 0, '')
        s, e = acc.contiguous_style_range_from_pos(pos)
        e = min(pos + 1, e)
        return (s, e, acc.text_range(s, e))

    def _get_var_back(self, pos, acc):
        if pos < 2 or pos >= acc.length:
            return None
        token = []
        # variable [$@]? <|>
        s, e0, w = self._get_word_back(pos, acc)
        print 'w = %r' % (w, )
        style = acc.style_at_pos(s)
        if style in self.word_styles:
            token += [ w ]
            s0 = s
            cutoff = e0 - s
            trg_pos = s
            if s > 1:
                s, e, w = self._get_word_back(s - 1, acc)
        elif style == self.operator_style:
            cutoff = 0
            trg_pos = pos + 1

        while s > 1:
            if w in '$@':
                s, e, w2 = self._get_word_back(s - 1, acc)
                print 'w = %r, w2 = %r' % (w, w2, )
                style = acc.style_at_pos(s)
                if style in self.word_styles:
                    token += [ w, w2 ]
                    s0 = s
                else:
                    break
            else:
                break
            s, e, w = self._get_word_back(s - 1, acc)
            if not (style == self.element_style or self._is_bquoted(w2)):
                break

        if w in ('::', ':::') and s > 1:
            s, e, w2 = self._get_word_back(s - 1, acc)
            style = acc.style_at_pos(s)
            if style == self.namespace_style:
                token += [ w, w2 ]
                s0 = s
            else:
                return None
        elif not style in self.varname_styles:
            return None
        print s, s0

        token.reverse()
        return (s0, e0, token, reduce(lambda v, x: v + len(x), token, 0) - cutoff,
                trg_pos)
    
    def _brace_match(self, position, acc):
        """ 'SilverCityAccessor' does not have 'scimoz' element which provides
        'braceMatch', so we need to implement it. This function is based on the
        original c++ version in scintilla.
        """
        if position < 0 or position >= acc.length():
            return -1
        if hasattr(acc, "scimoz"):
            return acc.scimoz.braceMatch(position)
       
        def _next_position(position, direction, style, acc):
            if acc.style_at_pos(position) == style:
               return position + direction
            csr = acc.contiguous_style_range_from_pos(position)
            if(direction == -1):
                return csr[0] - 1
            return csr[1]
        
        def _brace_opposite(s):
            brace = '([{)]}'
            oppos = ')]}([{'
            pos = brace.find(s)
            if pos != -1:
                return oppos[pos]
            return '\0'
        
        chBrace = acc.char_at_pos(position)
        chSeek = _brace_opposite(chBrace)
        if chSeek == '\0':
            return -1
        styBrace = acc.style_at_pos(position)
        length = acc.length()
    
        direction = 1 if chBrace in '[{(' else -1
        depth = 1
        position = _next_position(position, direction, styBrace, acc)
        if hasattr(acc, 'tokens'):
            endStyled = acc.tokens[-1L]['end_index']
        else:
            endStyled = acc.length()
     
        while (position >= 0) and (position < length) :
            print 'position = %d' % position
            chAtPos = acc.char_at_pos(position)
            styAtPos = acc.style_at_pos(position)
            if (position > endStyled) or (styAtPos == styBrace):
                if chAtPos == chBrace:
                    depth += 1
                if chAtPos == chSeek:
                    depth -= 1
                if depth == 0:
                    print "end position = %d" % position
                    return position
            positionBeforeMove = position
            position = _next_position(position, direction, styBrace, acc)
            if position == positionBeforeMove:
                break
        return -1

    def _in_func(self, pos, acc):
        p = pos - 1
        p_min = max(0, pos - 1024) #  whole function call in R can be very long
       
        arg_count = 1
        argnames = list()
        commapos = -1
        while p > p_min:
            ch = acc.char_at_pos(p)
            if acc.style_at_pos(p) == self.string_style:
               p = acc.contiguous_style_range_from_pos(p)[0] - 1
            elif ch in ")]}":
                p = self._brace_match(p, acc) - 1
            #elif ch in "[{":
            elif ch == "{":
                return None
                # TODO: 'name[' --> '`[`(name'

            elif ch == "[":
                # function name:
                var = self._get_var_back(p, acc)
                if(var is not None):
                    fn_start, fn_end, fn_word, x_, x_ = var
                    fn_word = ''.join(fn_word)
                else:
                    return None
                #fn_start, fn_end, fn_word = self._get_word_back(p, acc)
                print "word = '%s', start = %d" % (fn_word, fn_start, )
                # _get_var_back ===> (s, e0, token, cutoff, trg_pos)
                var = self._get_var_back(fn_start - 1, acc)
                print "_get_var_back(%d) = '%s'" % (fn_start - 1, var, )
                if var is not None:
                    start, end, word, x_, x_ = self._get_var_back(fn_start - 1, acc)
                    #start, end, word = self._get_word_back(fn_start - 1, acc)
                    if acc.style_at_pos(start) in self.word_styles:
                        argnames.reverse()
                        return (fn_start, p, fn_word, arg_count, argnames, ''.join(word))
                return None

            elif ch == "(":
                # function name:
                var = self._get_var_back(p - 1, acc)
                if(var is not None):
                    fn_start, fn_end, fn_word, x_, x_ = var
                    fn_word = ''.join(fn_word)
                else:
                    return None
                #fn_start, fn_end, fn_word = self._get_word_back(p - 1, acc)
                if acc.style_at_pos(fn_start) in self.word_styles:
                    # namespace ::[:] function:
                    #print "fn_start = ", fn_start
                    if fn_start > 1:
                        start, end, op_word = self._get_word_back(fn_start - 1, acc)
                        if op_word in ('::', ':::'):
                            start, end, ns_word = self._get_word_back(start - 1, acc)
                            if acc.style_at_pos(start) == self.namespace_style:
                                fn_word = ns_word + op_word + fn_word
                                fn_start = start
                    argnames.reverse()
                    return (fn_start, p, fn_word, arg_count, argnames,
                                acc.text_range(p + 1, commapos).strip()
                                    if commapos > 0 else None)
                break
            else:
                if ch == ',':
                    commapos = p
                    arg_count += 1
                elif ch == '=':
                    start, end, word = self._get_word_back(p - 1, acc)
                    if acc.style_at_pos(start) == self.argument_style:
                        argnames += [ word ]
                p1 = self._skip_back_ws(p, acc);
                if p1 == p:
                    p -= 1
                else:
                    p = p1
        return None


#---- Buffer class
class RxBuffer(UDLBuffer):
    lang = lang
    cb_show_if_empty = True
    cpln_fillup_chars = "\t" #"~`!$@#%^&*()-=+{}[]|\\;:'\",<>?/\t\n\r"
    cpln_stop_chars = "~`!$@#%^&*()-=+{}[]|\\;:'\",<>?/"

    # Dev Note: many details elided.

    def trg_from_pos(self, pos, implicit=True):
        if pos == 0:
            return None
        #RxLangIntel().trg_from_pos(self, pos, implicit=implicit)

        try:
            langintel = self.mgr.langintel_from_lang(self.lang)
        except KeyError:
            return None
        return langintel.trg_from_pos(self, pos, implicit=implicit)


    def preceding_trg_from_pos(self, pos, curr_pos,
                               preceding_trg_terminators=None):
        if pos == 0:
            return None

        #RxLangIntel().preceding_trg_from_pos(self, pos, curr_pos,
                                            #preceding_trg_terminators)
        try:
            langintel = self.mgr.langintel_from_lang(self.lang)
        except KeyError:
            return None
        return langintel.preceding_trg_from_pos(self, pos, curr_pos,
                                                preceding_trg_terminators)

#---- CILE Driver class
# Dev Notes:
# A CILE (Code Intelligence Language Engine) is the code that scans
# R content and returns a description of the code in that file.
# See "cile_r.py" for more details.
#
# The CILE Driver is a class that calls this CILE.
class RxCILEDriver(UDLCILEDriver):
    lang = lang
    ssl_lang = 'R_extended'
#   tpl_lang = 'Roxygen'

#---- Registration
def register(mgr):
    """Register language support with the Manager."""
    mgr.set_lang_info(
        lang,
        silvercity_lexer=RxLexer(),
        buf_class=RxBuffer,
        langintel_class=RxLangIntel,
        import_handler_class=None,
        cile_driver_class=None, # RCILEDriver,
        is_cpln_lang=True)
