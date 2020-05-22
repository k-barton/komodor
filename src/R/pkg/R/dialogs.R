.repr <- function(x) deparse(x, control = NULL)

# replacement for base::readline
koReadLine <-
function(prompt = "") {
    if(!interactive()) return("")
    koCmd(sprintf("_W.ko.dialogs.prompt(%s, \"\", \"\", \"R prompt\", 'rprompts') || ''",
        .repr(prompt)), timeout = 604800L)
}


koAskYesNo <-
function(msg, default = TRUE,
    prompts = NULL, 
    ...) {
    ans <- koCmd(
        sprintf("_W.ko.dialogs.yesNoCancel(%s, %s, null, %s)",
        .repr(paste0(as.character(msg), collapse = "\n")),
        .repr(if(isTRUE(default)) "Yes" else if(isFALSE(default)) "No" else "Cancel"),
        .repr("Question from R")),
        timeout = 604800L
        )
    switch(ans, Yes = TRUE, No = FALSE, NA)
}


koSelectList <- 
function (choices, preselect = NULL, multiple = FALSE, title = NULL, 
    graphics = getOption("menu.graphics")) {
    if (!interactive()) 
        stop("koSelectList() cannot be used non-interactively")
    if (!is.null(title) && (!is.character(title) || length(title) != 1)) 
        stop("'title' must be NULL or a length-1 character vector")
}

