local({

komodor_version <- Sys.getenv("KOMODOR_VER")

if(file.exists(".komodor_version"))
    komodor_version <- scan(".komodor_version", "", quiet = TRUE)[1L]

komodor_version <- sub("^\\D*((\\d+\\.){2}\\d+)\\D*$", "\\1", komodor_version)
	
if(!identical(komodor_version, "") && (
        length(find.package("kor", quiet = TRUE)) == 0L ||
        komodor_version != utils::packageVersion("kor")
    )) {
    fi <- paste0("kor_", komodor_version, ".tar.gz")
    if(!file.exists(fi))
		if(dir.exists("pkg") && file.exists(file.path("pkg", "DESCRIPTION"))) {
		  message("*This is development version*")
		  fi <- "pkg"
		} else 
			stop("KomodoR installation appears to be corrupt. Please reinstall Komodo add-on.")
    tmppath <- tempdir()
    odir <- setwd(tmppath)
    cat("installing KomodoR ...\n")
    utils::install.packages(file.path(odir, fi), repos = NULL, type = "src")
    setwd(odir)
}

}) # end local

require("kor")
kor::startup(verbose = FALSE)
