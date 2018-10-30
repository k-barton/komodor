#' @rdname rbrowser
#' @md
#' @export
#' @param fsep,rsep character strings for field and record separator, respectively.
objSearch  <-
function(fsep = ";", rsep = "\t")  {
    
    rval <- search()
    idxPkg <- grep("^package:", rval)
    pkgNames <- rval[idxPkg]
    pkgNames <- sub("^package:", "", pkgNames)
    deps <- lapply(pkgNames, .getAllDependencies)
    d0 <- vapply(deps, length, 0L) == 0L
    depsStr <- deps
    for(i in seq.int(along.with = depsStr)[!d0]) {
        j <- c(i, match(deps[[i]], pkgNames))
        required <- unlist(deps[-j], use.names = FALSE)
        required <- required[!duplicated(required)]
        depsStr[[i]] <- paste0(ifelse(deps[[i]] %in% required, "*", ""), deps[[i]], collapse = " ")
    }
    
    depsStr[d0] <- ""
    depsStr <- unlist(depsStr, use.names = FALSE)
    requiredBy <- lapply(pkgNames, function(x) pkgNames[vapply(deps, function(d) x %in% d, FALSE)])
    requiredByStr <- lapply(requiredBy, paste0, collapse = " ")
    rval[idxPkg] <- paste(rval[idxPkg], depsStr, requiredByStr, sep = fsep)

    
    if (!identical(ee <- getEvalEnv(), .GlobalEnv)) {
        eeName <- attr(ee, "name")
        rval <- c(if (is.null(eeName)) "<EvalEnv>" else paste0("<EvalEnv[", eeName[1L], "]>"), rval)
    }
    return(paste(rval, collapse = rsep))
}

#getDependencies <-
#function(pkgName, fields = "Depends") {
#    d <- unlist(packageDescription(pkgName)[fields])
#    if(is.null(d)) return(character(0L))
#    d <- sub("\\s*\\(.*$", "", unlist(strsplit(d, "\\s*,\\s*"), use.names = FALSE))
#    d[d != "R"]
#}

# XXX: possible name conflict with pkgman.R:getDependencies
.getDependenciesCached <-
function(pkgName, fields = "Depends") {
    cacheName <- paste0(".deps_", paste0(tolower(sort(fields)), collapse = "."))
    if(!existsTemp(cacheName)) assignTemp(cacheName, new.env(parent = emptyenv()))
    cache <- getTemp(cacheName)
    if(exists(pkgName, cache, inherits = FALSE)) return(get(pkgName, cache, inherits = FALSE))
    ## deps <- getDependencies(pkgName, fields)
    deps <- unlist(packageDescription(pkgName)[fields])
    if(is.null(deps)) return(character(0L))
    deps <- sub("\\s*\\(.*$", "", unlist(strsplit(deps, "\\s*,\\s*"), use.names = FALSE))
    deps <- deps[deps != "R"]
    ##
    assign(pkgName, deps, cache)
    deps
}

.getAllDependencies <-
function(pkgName, fields = "Depends") {
    d <- .getDependenciesCached(pkgName, fields)
    repeat {
        d2 <- unique(unlist(lapply(d, .getDependenciesCached, fields = fields)))
        if(any(i <- ! d2 %in% d)) d <- c(d, d2[i]) else break
    }
    d
}
