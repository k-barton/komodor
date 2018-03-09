#' @title Execute R command
#' @description Wrapper function to execute various R commands. Intended for internal use.
#' @md
#' @param command character string with command name.
#' @param \dots additional arguments depending on the value of `command`
#' @export

doCommand <-
function(command, ...) {
    if(!is.character(command) && length(command) != 1L) return(invisible())
	
	dots <- list(...)
    switch(command[1L],
           detach = {
            names <- dots[[1L]]
            if(is.null(names) || length(names) == 0L) return()
            for(x in names) tryCatch({
                    detach(x, unload = TRUE, character.only = TRUE)
                    cat("<success:", x, ">\n", sep = "")
                    }, error = function(e) {
                    cat("<error:", x, ">\n", sep = "")
                })  
        },
		attach = {
		    filename <- dots[[1L]]
			pos <- if(length(dots) >= 2L) dots[[2L]][1L] else 2L
			if(is.character(pos)) pos <- match(pos, search(), 2L)
			tryCatch(attach(filename, pos = pos, name = basename(filename)),
                     error = function(e) {
                        cat("<error>")
                        message(e)
                        })
			
		},
        library = {
			package <- dots[[1L]]
            posAfter <- if(length(dots) >= 2L) dots[[2L]] else 2L
			sp <- search()
			if(is.character(posAfter)) {
				pos <- match(posAfter[1L], sp, nomatch = 2L)
			} else pos <- posAfter[1L]
			if(pos == 1) pos <- 2L
			if(pos > length(sp)) pos <- length(sp) - 1L

			tryCatch(library(package, pos = pos, character.only = TRUE),
                     error = function(e) {
                        cat("<error>")
                        message(conditionMessage(e))
                        })
        },
        message("unknown command: ", command[1L])) # switch
    invisible()
}
