#' Convert Rmarkdown file to HTML
#'
#' @export
#' @param file the path to the Rmarkdown input file.
#' @param pandoc character string. Path to 'pandoc' executable or `NULL` in
#'      which case `pandoc` is searched for on the system path.
#' @param verbose if `TRUE`, messages from `knitr` and `pandoc` are printed.
#' @param \dots additional arguments. Currently ignored.
#' @return The path to the generated HTML file is returned. 
rmdToHtml <-
function(file, pandoc = NULL, verbose = FALSE, ...) {

    if(missing(pandoc) || is.null(pandoc)) {
        pandoc <- Sys.which("pandoc")
        if(pandoc == "") stop("'pandoc' not found on the system path")
    }
    if(!file.exists(pandoc)) stop("'pandoc' not found")
    if(!length(find.package("knitr", quiet = TRUE)))
        stop("package 'knitr' is not installed")

    file <- normalizePath(file)
    filename <- basename(file)
    filenameNoExt <- sub("\\.[^\\.]+$", "", filename)
    
    tmpdir <- file.path(tempdir(), paste0("knit_", filenameNoExt))
    file1 <- file.path(tmpdir, filename)
    dir.create(tmpdir, showWarnings = FALSE)
    file.copy(file, to = file1, overwrite = TRUE)
    
    owd <- setwd(tmpdir)
    on.exit(setwd(owd))
    
    outMd <- sub("(.Rmd)?$", ".md", file1)
    outHtml <- sprintf("%s.html", filenameNoExt)
    if(file.exists(outHtml)) file.remove(outHtml)
    
    knitOutput <- capture.output(invisible(getFrom("knitr", "knit")(file1,
        output = outMd, encoding = "utf-8", quiet = !verbose, envir = getEvalEnv(), ...)),
            type = "message")
    
    pandocCmd <- sprintf("%1$s -f markdown -t html --standalone -s -o %3$s %2$s", shQuote(pandoc),
            shQuote(outMd), shQuote(outHtml))
    if(verbose) cat(pandocCmd, "\n")
    #pandoc -f markdown  --standalone -t html -s -o example.html example.md
    out <- system(pandocCmd, wait = TRUE, intern = TRUE)
    if(verbose) cat(out, sep = "\n")
    if(!file.exists(outHtml)) return(NULL)
    rval <- normalizePath(file.path(tmpdir, outHtml))
    cat(rval, "\n")
    message(paste0(knitOutput, collapse = "\n"), "\n")
    return(invisible(rval))
}