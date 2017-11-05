
.onAttach <- function(libname, pkgname) {
	# packageStartupMessage(".onAttach")
	setEvalEnv(.GlobalEnv)
	#options(browser = koBrowser, pager = koPager)

	if(is.null(getOption("ko.host"))) options(ko.host = "localhost")
	if(!is.numeric(getOption("ko.port"))) options(ko.port = 6666L)

	init.Rserver()
	
	reg.finalizer(tempEnv(), function(env) {
		..onUnload()
		#cat("reg.finalizer run at", format(Sys.time()), "\n", file="~/kor_log.txt", append = TRUE)
	}, TRUE)
    #cat("kor attached at", format(Sys.time()), "\n", file="~/kor_log.txt", append = TRUE)
}

..onUnload  <- function(libpath) {
	#message("Closing KomodoR ...")
	fnull <- function(...) NULL
	tryCatch(koCmd("sv.addNotification(\"R says bye.\"); sv.command.setRStatus(false);"), error = fnull)
	tryCatch(stopAllServers(), error = fnull)
	tryCatch(stopAllConnections(), error = fnull)
	#cat("kor unloaded at", format(Sys.time()), "\n", file="~/kor_log.txt", append = TRUE)
}



