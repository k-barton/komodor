#' @rdname rbrowser
#' @md
#' @export
`objSearch` <-
function(sep = "\t", compare = TRUE) {
    rval <- search()
	changed <- TRUE
    if (isTRUE(compare)) {
        oldSearch <- getTemp(".objSearchCache")
        changed <- !identical(rval, oldSearch)
        if (changed) assignTemp(".objSearchCache", rval)
    }
    if (changed) {
        if (!is.null(sep)) return(paste0(rval, collapse = sep))
        return(rval)
    } else return("")
}



