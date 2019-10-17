#' @rdname view
#' @name view
#' @title View data.frame as HTML 
#' @md
#' @export
#' @description Produces a HTML representation of a `data.frame` or a similar 
#'    2-dimensional table, writes it into file and shows in the default browser.
#' @param x a `data.frame` (or an objects inheriting from it)
#' @param max.rows optionally, the maximum number of rows to view. Set to `0` 
#'    for no truncation (however, some reasonable limit is recommended). 
#' @param filename optionally, the name of the html file (with write access).
#'    If the file exists, the contents will be overwritten. 
#' @param cssfile, optional URI of the CSS file to use. Either an URL or a 
#     path to a local file. 
#' @param copy.css If `cssfile` is a local file, should it be copied to the 
#'    same directory as `filename`?
#' @param title Currently not used.
#' @return Returns the name of the file invisibly.
view <-
function(x, max.rows = 512L,
   filename =  file.path(tempdir(), "viewTable.html"),
#   filename = tempfile("view", fileext = ".html"),
   cssfile = "resource:kor-doc/viewTable.css",
   copy.css = FALSE) {
    if(!inherits(x, "data.frame"))
        stop("'x' must be a 'data.frame' or similar object")


    objname <- deparse(substitute(x), control = NULL, nlines = 1L)
    
    if(truncated <- nrow(x) > max.rows) {
        x <- x[1L:max.rows, ]
    }

    m <- ncol(x)
    n <- nrow(x)

    classes <- vapply(x, function(x) paste0(class(x), collapse = " "), "")

    cellclass <- character(m)
    # per-column tests /TODO: avoid multiple tests/
    j <- which(vapply(x, is.numeric, FALSE, USE.NAMES = FALSE))
    cellclass[j] <- "numeric"
    j <- which(vapply(x, is.complex, FALSE, USE.NAMES = FALSE))
    cellclass[j] <- "complex numeric"
    j <- which(vapply(x, is.factor, FALSE, USE.NAMES = FALSE))
    cellclass[j] <- "factor numeric"
    j <- which(vapply(x, is.logical, FALSE, USE.NAMES = FALSE))
    cellclass[j] <- "logical"
    cellclass <- array(rep(cellclass, each = n), dim = dim(x))
    # per-cell tests
    j <- which(unlist(lapply(x, is.na)))
    cellclass[j] <- paste("na", cellclass[j])
    nonatomic <- !vapply(x, is.atomic, FALSE)
    if(any(nonatomic)) { 
        # handle the irritating default behaviour of '[.data.table':
        if(inherits(x, "data.table")) {
            j <- unlist(lapply(x[, nonatomic, drop = FALSE, with = FALSE],
                    vapply, is.null, FALSE, USE.NAMES = FALSE), use.names = TRUE)
        } else {
            j <- unlist(lapply(x[, nonatomic, drop = FALSE],
            vapply, is.null, FALSE, USE.NAMES = FALSE), use.names = TRUE)
        }
        cellclass[, nonatomic][j] <- paste("null", cellclass[, nonatomic][j])
    }
    cellclass[cellclass != ""] <- paste0(" class=\"", cellclass[cellclass != ""], "\"")
    
    

    html <- as.matrix(x)
    tt1 <- c(">", "<", "\n")
    tt2 <- c("&gt;", "&lt;", "<br />")
    for(i in seq_along(tt1)) html[] <- gsub(tt1[i], tt2[i], html, fixed = TRUE)
    html <- matrix(paste0("<td", cellclass, "><div class=\"cc\">", html, "</div></td>"), nrow = n, ncol = m)
    html <- rbind(paste0("<th>", colnames(x), "</th>"),
                  paste0("<td>", classes, "</td>"), html)

    
    rownm <- paste0("<td>", c("&nbsp;", "&nbsp;", 
            if(is.null(rownames(x))) seq.int(nrow(x)) else rownames(x)), 
            "</td>")
    
    html <- cbind("<tr>",
        paste0("<td>", c("&nbsp;", "&nbsp;", 
            if(is.null(rownames(x))) seq.int(nrow(x)) else rownames(x)), 
            "</td>"),
        html, "</tr>")
    
    con <- file(filename, open = "w", encoding = "utf-8")
    
    if(!tryCatch(isOpen(con), error = function(e) FALSE))
        stop("cannot open the file")
    on.exit(close(con))
        
    if(file.exists(cssfile) && isTRUE(copy.css)) {
        cssurl <- "viewstyle.css"
        file.copy(cssfile[1L], to = file.path(dirname(filename), cssurl), overwrite = TRUE)
    } else cssurl <- cssfile[1L]

    cat(file = con, append = TRUE,
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\" />",
        if(is.character(cssurl) && nchar(cssurl) > 0L)
            paste0("<link rel=\"stylesheet\" href=\"", cssurl, "\" />"),
            "<title>", objname, "</title></head>\n<body>\n",
            "<h1>", objname,
                sprintf(" [%d &times; %d, class '%s']", n, m, paste(class(x), collapse = ", ")),
                if(truncated) sprintf("<span class=\"truncation-info\">(showing first %d rows)</span>", max.rows),
            "</h1>",
            "<table>\n", sep = "")
    cat(file = con, append = TRUE,
        paste0("<colgroup>\n", paste0("\t<col class=\"", c("rowname", classes), "\" />", collapse = "\n"),
               "</colgroup>\n")
        )
    write.table(html, sep ="", quote = FALSE, row.names = FALSE, col.names = FALSE,
                eol = "\n",
                file = con, append = TRUE)
    cat(file = con, append = TRUE, "</table>\n</body>\n</html>\n")
    close(con)
    on.exit()
    browseURL(filename)
    #cat("file:///", gsub("\\", "/", filename, fixed = TRUE), sep = "")
    invisible(filename)
}


View <- function (x, title) {
    view(x)
}

