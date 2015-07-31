# <LICENSE BLOCK:KomodoR>
`sv_objSearch` <-
function(sep = "\t", compare = TRUE) {
    Search <- search()
    if (isTRUE(compare)) {
        oldSearch <- getTemp(".guiObjSearchCache", default = "")
        ## Compare both versions
        if (length(Search) != length(oldSearch) || !all(Search == oldSearch)) {
            ## Keep a copy of the last version in TempEnv
            assignTemp(".guiObjSearchCache", Search)
            Changed <- TRUE
        } else Changed <- FALSE
    } else Changed <- TRUE
    
    if (Changed) {
        if (!is.null(sep)) 
            Search <- paste(Search, collapse = sep)
        return(Search)
    } else return("")
} 
