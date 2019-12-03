# replacement for base::readline
koReadLine <-
function(prompt = "") {
    if(!interactive()) return("")
    koCmd(sprintf("ko.dialogs.prompt(%s, \"\", \"\", \"R prompt\", 'rprompts')",
        deparse(prompt, control = NULL)), timeout = 604800L)
}
