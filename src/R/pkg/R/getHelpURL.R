#' @rdname kor-internal
#' @name kor-internal
#' @md
#' @description `getHelpURL` gets the URL of an R help page.
#' @param topic,package see `help`
#' @export
`getHelpURL` <-
function(topic, package = NULL) {
	httpdPort <- getFrom("tools", "httpdPort")
	port <- if(is.function(httpdPort)) httpdPort() else httpdPort
	if(port == 0L) port <- suppressMessages(getFrom("tools", "startDynamicHelp")(TRUE))
	helpURI <- NULL
	if(port == 0L) return("")
	oBrowser <- options(browser = function(uri) helpURI <<- uri)
	on.exit(options(oBrowser))

	if(missing(topic)){
		  host <- "http://127.0.0.1"
		helpURI <- if(is.null(package)) {
			paste0(host, ":", port, "/doc/html/index.html")
		} else {
			package <- package[1L]
			if(system.file("html/00Index.html", package = package) != "")
				paste0(host, ":", file.path(port,
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