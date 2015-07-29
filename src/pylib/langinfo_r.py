from langinfo import LangInfo

class RLangInfo(LangInfo):
    name = "R"
    conforms_to_bases = ["text"]
    exts = [".R", ".Rhistory", ".Rprofile"]
    filename_patterns = ["Rprofile", "NAMESPACE"]
