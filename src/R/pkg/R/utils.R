#' @rdname kor-internal
#' @md
#' @description `isInstalledPkg` checks if a package is installed. 
#' @param pkgName the name of the package.
#' @param json logical, if `TRUE` prints result in JSON format.
#' @export
isInstalledPkg <-
function(pkgName, json = TRUE) {
   rval <- length(find.package(pkgName[1L], quiet = TRUE)) == 1L  # length(pkgName)
   if (json) cat(as.integer(rval))
   invisible(rval)
}

#' @md
#' @description `.instapack` lists the installed, but not loaded, packages. 
#' @export
.instapack <- function() {
    rval <- utils::installed.packages()[, 1L]
    rval <- rval[! rval %in% .packages()[]]
    cat(rval, sep = " ")
    invisible(rval)
}
