#' @title Read R code from a temporary file and delelte it afterwards
#' @md 
#' @description `sourceTemp` differs from `source` only in that it deletes the `file` after it has been evaluated.
#' @param file a character string giving the pathname of the file to read from.
#' @param local `TRUE`, `FALSE` or an environment, determining where the parsed expressions are evaluated.
#         `FALSE` (the default) corresponds to the user's workspace (the global environment) and `TRUE` to
#         the environment from which source is called.
#' @param encoding character vector. The encoding(s) to be assumed when file is a character string. Unlike in
#         `source`, this defaults to "utf-8".
#' @param \dots other arguments passed to `source`.
#' @export
sourceTemp <-
function(file, local = FALSE, encoding = "utf-8", ...) {
    on.exit(unlink(file))
    if(isTRUE(local)) local <- parent.frame()
    source(file, local = local, encoding = encoding, ...)
}
