getCurrentEnv <-
function()
get("sv_CurrentEnvir", envir = funcEnv, inherits = FALSE)


svSetEnv <-
function(envir = .GlobalEnv) {
	assign("sv_CurrentEnvir", envir, envir = funcEnv)
}

##TODO: change prompt if not .GlobalEnv
## TODO: save sys.calls and sys.frames
koBrowseHere <-
function() {
	if(!identical(sys.frame(sys.nframe()), .GlobalEnv)) {
		eval.parent(expression(svSetEnv(sys.frame(sys.nframe()))))
		stop(simpleMessage(paste0("Current evaluation environment is now inside\n\t",
			format(sys.call(sys.nframe() - 1L))[1L],
			"\nUse 'koBrowseEnd()' to return to '.GlobalEnv'.",
			"\n(Note this will not resume execution of the function)")))
	}
}

koBrowseEnd <-
function() {
	if(!identical(getCurrentEnv, .GlobalEnv)) {
		svSetEnv(.GlobalEnv)
		message("Evaluating in '.GlobalEnv'")
	} else message("Already evaluating in '.GlobalEnv'")

}

svPager <- function(files, header, title, delete.file) {
    files <- gsub("\\", "\\\\", files[1L], fixed = TRUE)
    tryCatch(koCmd(sprintf("sv.r.pager(\"%1$s\", \"%2$s\", %3$s)",
        files, title,
        if (delete.file)  "true" else "false")),
        error = function(e) utils::browseURL(files, NULL))
}

`svBrowser` <- function(url) {
    url <- gsub("\\", "\\\\", url, fixed = TRUE)
    ## If the URL starts with '/', assume a file path
    ## on Unix or Mac and prepend 'file://'
    url <- sub("^/", "file:///", url)
    tryCatch(koCmd(sprintf("sv.command.openHelp(\"%s\")", url)),
        warning = function(e) utils::browseURL(url, NULL),
        error = function(e) utils::browseURL(url, NULL)
        )
}

`koMsg` <- function(...) cat(..., "\n")


# a way round to get the url:
`getHelpURL` <-
function(topic, package = NULL) {
	httpdPort <- if(is.function(tools:::httpdPort)) tools:::httpdPort() else
		tools:::httpdPort
	if(httpdPort == 0L) httpdPort <- suppressMessages(tools:::startDynamicHelp(TRUE))
	helpURI <- NULL
	if(httpdPort == 0L) return("")
	oBrowser <- options(browser = function(uri) helpURI <<- uri)
	on.exit(options(oBrowser))

	if(missing(topic)){
		  host <- "http://127.0.0.1"
		helpURI <- if(is.null(package)) {
			paste0(host, ":", httpdPort, "/doc/html/index.html")
		} else {
			package <- package[1L]
			if(system.file("html/00Index.html", package = package) != "")
				paste0(host, ":", file.path(httpdPort,
				"library", package, "html", "00Index.html", fsep = "/"))
		}
	} else {
		if(try.all.packages <- !is.null(package) && is.na(package))
			package <- NULL
		print(do.call(utils::help, list(topic = topic,
			try.all.packages = try.all.packages,
			package = package, help_type = "html")))
	}
	invisible(helpURI)
}


### 


kmdrSaveObject <- 
function(x, path = ".", 
	filename = file.path(path, sprintf("%s.RData", nm)), 
	...) {
	nm <- make.names(deparse(substitute(x)))
	assign(nm, x)
	save(list = nm, file = file.path(path, sprintf("%s.RData", nm)), ...)
}

