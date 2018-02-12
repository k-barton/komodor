#' @title Execute R command
#' @description Wrapper function to execute various R commands. Intended for internal use.
#' @md
#' @param command character string with command name.
#' @param \dots additional arguments depending on the value of `command`
#' @export

doCommand <-
function(command, ...) {
    if(!is.character(command) && length(command) != 1L) return(invisible())
    switch(command[1L],
           detach = {
            names <- list(...)[[1L]]
            if(is.null(names) || length(names) == 0L) return()
            for(x in names) tryCatch({
                    detach(x, unload = TRUE, character.only = TRUE)
                    cat("<success:", x, ">\n", sep = "")
                    }, error = function(e) {
                    cat("<error:", x, ">\n", sep = "")
                })  
        },
        library = {
            tryCatch(library(list(...)[[1L]], character.only = "true"),
                     error = function(e) {
                        cat("<error>")
                        message(e)
                        })
        },
        message("unknown command: ", command[1L])) # switch
    invisible()
}
