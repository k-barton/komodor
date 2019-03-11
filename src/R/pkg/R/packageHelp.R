packageHelp <-
function(pkgName) {
    p <- find.package(pkgName)
    # from utils:::index.search
    if (file.exists(f <- file.path(p, "help", "aliases.rds"))) 
        al <- readRDS(f) else if (file.exists(f <- file.path(p, "help", "AnIndex"))) {
        foo <- scan(f, what = list(a = "", b = ""), sep = "\t", quote = "", na.strings = "", 
            quiet = TRUE)
        al <- structure(foo$b, names = foo$a)
    }
    if (endsWith(al[1L], "-package")) 
        help(al[1L], package = pkgName[]) else help(package = pkgName[])
}
