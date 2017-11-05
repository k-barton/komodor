

local({
if(file.exists(".komodor_version"))
    Sys.setenv("KOMODOR_VER"=scan(".komodor_version", "", quiet = TRUE)[1L])

if(!identical(Sys.getenv("KOMODOR_VER"), "") && (
        length(find.package("kor", quiet=TRUE)) == 0L ||
        Sys.getenv("KOMODOR_VER") != utils::packageVersion("kor")
    )) {
    fi <- paste0("kor_", Sys.getenv("KOMODOR_VER"), ".tar.gz")
    if(!file.exists(fi)) stop("KomodoR installation is corrupt. Please reinstall Komodo add-on.")
    tmppath <- tempdir()
    odir <- setwd(tmppath)
    cat("installing KomodoR ...\n")
    utils::install.packages(file.path(odir, fi), repos = NULL)
    setwd(odir)
}

}) # end local

library("kor")
kor::startup(verbose = FALSE)
