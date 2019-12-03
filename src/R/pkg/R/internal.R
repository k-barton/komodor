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
    file <- gsub("\\", "\\\\", files[1L], fixed = TRUE)
 
    enc <- getOption("encoding")
	charset <- if(enc %in% c("native.enc", "")) {
		enc <- l10n_info()
		if(enc$`UTF-8`) "utf-8" else
			if (enc$`Latin-1`) "iso-8859-1" else
			if(!is.null(enc$codepage)) sprintf("windows-%d", enc$codepage) else ""
	} else enc
		
    tryCatch(koCmd(sprintf("kor.r.pager(\"%s\", \"%s\", \"%s\", %s, \"%s\")",
        file, header, title, if (delete.file) "true" else "false", charset)
	),  error = function(e) {
		if(!is.null(origpager <- getTemp("oldoptions", item = "pager")))
			browseURL(files, origpager)
	})
}


#' @rdname kor-internal
#' @description `koBrowser` opens an URL in Komodo help browser
#' @param url the URL to open.
#' @export
koBrowser <- function(url) {
    ## If the URL starts with '/', assume a file path
    ## on Unix or Mac and prepend 'file://'
    escapedUrl <- sub("^/", "file:///", url)
	escapedUrl <-gsub("\\", "\\\\", escapedUrl, fixed = TRUE)
    res <- tryCatch(koCmd(sprintf("kor.command.openHelp(\"%s\")", escapedUrl)),
        warning = function(e) e, error = function(e) e)
	if(inherits(res, "condition"))
		browseURL(url, NULL)
}
		
kmdrSaveObject <- 
function(x, path = ".", 
	filename = file.path(path, sprintf("%s.RData", nm)), 
	...) {
	nm <- make.names(deparse(substitute(x)))
	assign(nm, x)
	save(list = nm, file = file.path(path, sprintf("%s.RData", nm)), ...)
}

assignLocked <- 
function(x, value, envir) {
    tryCatch({
	if(bindingIsLocked(x, envir)) { 
		unlockBinding(x, envir)
		on.exit(lockBinding(x, envir))
	}
	assign(x, value, envir = envir)
    }, error = function(e) NULL)
}