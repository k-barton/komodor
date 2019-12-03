#' @rdname koProgressBar
#' @title Progress Bars in Komodo
#' @name koProgressBar
#' @aliases koProgressBar setKoProgressBar getKoProgressBar close.koProgressBar
#' @encoding utf-8
#' @md
#' @description
#' Put up a Komodo progress bar widget. 
#' @param title,label character strings, giving the window title and the label 
#'        on the dialog box respectively.
#' @param min,max (finite) numeric values for the extremes of the progress bar.
#' @param initial,value initial or new value for the progress bar.
#' @param width the width of the progress bar in pixels.
#' @param pb,con an object of class "winProgressBar".
#' @param \dots for consistency with the generic.
#' @details
#' `koProgressBar` will disenc2utf8play a progress bar as a dialog box inside Komodo. 
#' The usage is equivalent to `winProgressBar` or `tkProgressBar`. 
#' @return See `winProgressBar`.
#' @author Kamil Barto\enc{ń}{n}

#' @export
koProgressBar <-
function (title = "R progress bar", label = "", min = 0, 
    max = 1, initial = 0, width = 300L) {
    
    res <- koCmd(sprintf("kor.progressBar(%s, %s, %f, %f, %f, %d)",
        deparse(as.character(title), control = NULL), 
        deparse(as.character(label), control = NULL), 
        as.double(min), as.double(max), 
        as.double(initial), as.integer(width)
        ))
    structure(list(pb = as.integer(res)), class = "koProgressBar")
}

#' @export
#' @rdname koProgressBar
getKoProgressBar <- 
function(pb) {
    if (!inherits(pb, "koProgressBar")) 
        stop(gettextf("'pb' is not from class %s", dQuote("koProgressBar")), 
            domain = "kor")
    val <- koCmd(sprintf("kor.setProgressBar(%d)", pb$pb)) 
    invisible(as.numeric(val))
}

#' @export
#' @rdname koProgressBar
setKoProgressBar <-
function (pb, value, title = NULL, label = NULL) {
    if (!inherits(pb, "koProgressBar")) 
        stop(gettextf("'pb' is not from class %s", dQuote("koProgressBar")), 
            domain = "kor")
    
    title <- if (!is.null(title)) deparse(as.character(title), control = NULL) else "null"
    label <- if (!is.null(label)) deparse(as.character(label), control = NULL) else "null"
        
    val <- koCmd(sprintf("kor.setProgressBar(%d, %f, %s, %s)",
        pb$pb, as.double(value), title, label)) 
    
    invisible(as.numeric(val))
}

#' @export
#' @rdname koProgressBar
close.koProgressBar <- 
function (con, ...) {
    koCmd(sprintf("kor.closeProgressBar(%d)", con$pb))
    invisible()
}
