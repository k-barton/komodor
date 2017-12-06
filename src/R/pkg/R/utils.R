#' @rdname kor-internal
#' @md
#' @description `isInstalledPkg` checks if a package is installed. 
#' @param pkgName the name of the package.
#' @param json logical, if `TRUE` prints result in JSON format.
#' @export
isInstalledPkg <-
function(pkgName, json = TRUE) {
   rval <- length(find.package(pkgName[1L], quiet = TRUE)) == 1L # length(pkgName)
   if(json) cat(as.integer(rval))
   invisible(rval)
}

#' @rdname kor-internal
#' @export
#' @md
#' @param \dots arguments passed to `formatR::tidy_source`.
#' @param encoding the name of the encoding to be assumed.
formatCode <- function(..., encoding = "UTF-8") {
	oo <- options(encoding = encoding)
    on.exit(options(oo))
	result <- tryCatch(formatR::tidy_source(...), error = function(e) e)
	cat(if(inherits(result, "condition")) 0 else 1)
	invisible()
}
