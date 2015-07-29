from langinfo import LangInfo

class RmarkdownLangInfo(LangInfo):
    name = "Rmarkdown"
    conforms_to_bases = ["text"]
    exts = [".Rmd"]
    filename_patterns = None
