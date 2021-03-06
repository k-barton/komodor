from langinfo import LangInfo

class RxLangInfo(LangInfo):
    name = "R_extended"
    conforms_to_bases = ["text"]
    exts = [".R", ".Rhistory", ".Rprofile"]
    filename_patterns = ["Rprofile", "NAMESPACE"]
