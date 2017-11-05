#' @rdname kor-internal
#' @name kor-internal
#' @title Internal package functions
#' @description Various internal function. They are not to be called directly.

#' @param files name of the file to display 
#' @param header unused argument
#' @param title document title
#' @param delete.file logical. Should the file be deleted afterwards?
#' @export
koPager <- function(files, header, title, delete.file) {
    files <- gsub("\\", "\\\\", files[1L], fixed = TRUE)
    tryCatch(koCmd(sprintf("sv.r.pager(\"%1$s\", \"%2$s\", %3$s)",
        files, title,
        if (delete.file) "true" else "false")),
        error = function(e) browseURL(files, NULL))
}


#' @rdname kor-internal
#' @description `koBrowser` opens an URL in Komodo help browser
#' @param url the URL to open.
#' @export
koBrowser <- function(url) {
    url <- gsub("\\", "\\\\", url, fixed = TRUE)
    ## If the URL starts with '/', assume a file path
    ## on Unix or Mac and prepend 'file://'
    url <- sub("^/", "file:///", url)
    res <- tryCatch(koCmd(sprintf("sv.command.openHelp(\"%s\")", url)),
        warning = function(e) e, error = function(e) e)
	if(inherits(res, "condition")) browseURL(url, NULL)
}
		
kmdrSaveObject <- 
function(x, path = ".", 
	filename = file.path(path, sprintf("%s.RData", nm)), 
	...) {
	nm <- make.names(deparse(substitute(x)))
	assign(nm, x)
	save(list = nm, file = file.path(path, sprintf("%s.RData", nm)), ...)
}


.RInternal <- function (name, ...) {
    cl <- sys.call()[-1L]
    cl[[1L]] <- as.name(cl[[1L]])
    eval.parent(as.call(c(as.name(".Internal"), cl)))
}

