
sv.sourceTemp <-
function(file, local = FALSE, encoding = "utf-8", ...) {
    on.exit(unlink(file))
    if(local) local <- parent.frame()
    source(file, local = local, encoding = encoding, ...)
}
