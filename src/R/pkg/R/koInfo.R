koInfo <- 
function(print. = TRUE) {
	rval <- lapply(options("ko.R.port", "ko.port"), as.integer)
	names(rval) <- c("R server port", "Komodo server port")
	ver <- koCmd("kor.version + '\n' + _W.ko.version")
	if(length(ver) == 2L) {
		rval <- c(rval, as.list(ver))
		names(rval)[3L:4L] <- c("R interface version", "Komodo version")
	}
    if(print.) print(matrix(format(rval), dimnames = list(paste0(names(rval), ":"), "")),
        quote = FALSE, right = TRUE)
	invisible(rval)
}