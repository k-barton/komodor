from langinfo import LangInfo

class RdocLangInfo(LangInfo):
    name = "R documentation"
    conforms_to_bases = ["text"]
    exts = [".Rd"]
    filename_patterns = None
