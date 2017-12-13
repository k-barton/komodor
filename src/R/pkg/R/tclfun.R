
# importFrom("tcltk", ".Tcl", "tcl", ".Tcl.callback")

# # Example: make the R function return a value in Tcl:
# # R function should assign the result to some Tcl value
# # .Tcl("set retval") # <- retval is set locally within the function scope
# # funTest <- function(x) tcl("set", "retval", round(runif(as.numeric(x)), 3))
# # then, include it the 'retval' argument
# # tclfun(funTest, retval="retval")
# # .Tcl("funTest 10")

`tclfun` <- function(f, fname = deparse(substitute(f)), retval = NA,
					 body = "%s") {
	cmd <- .Tcl.callback(f)
	if (is.character(retval))
		body <- paste("%s; return $", retval, sep = "")
	cmd2 <- sprintf(paste("proc %s {%s} {", body, "}"),
		fname,
		paste(names(formals(f)), collapse = " "),
		gsub("%", "$", cmd, fixed = TRUE))
	.Tcl(cmd2)
	cmd2
}
