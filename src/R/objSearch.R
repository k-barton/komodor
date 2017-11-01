# <LICENSE BLOCK:KomodoR>
`sv_objSearch` <-
function(sep = "\t", compare = TRUE) {
    rval <- search()
	changed <- FALSE
    if (isTRUE(compare)) {
        oldSearch <- getTemp(".guiObjSearchCache", default = "")
        ## Compare both versions
        if (!identical(rval, oldSearch)) {
            ## Keep a copy of the last version in TempEnv
            assignTemp(".guiObjSearchCache", rval)
            changed <- TRUE
        }
    } else changed <- TRUE
    if (changed) {
        if (!is.null(sep)) return(paste0(rval, collapse = sep))
        return(rval)
    } else return("")
} 
