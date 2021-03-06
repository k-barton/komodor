% Generated by roxygen2: do not edit by hand
% Please edit documentation in R/completion.R
\encoding{utf-8}
\name{completion}
\alias{completion}
\alias{completeArgs}
\alias{completeSpecial}
\title{Code completion}
\usage{
completion(code, field.sep = "\\036", sep = "\\n", pos = nchar(code),
  min.length = 2L, skip.used.args = FALSE)

completeArgs(FUNC.NAME, ..., field.sep = "\\036")

completeSpecial(what, x = NULL, field.sep = "\\036", argpos = 1L)
}
\arguments{
\item{code}{character string, the code to be completed.}

\item{field.sep}{character string to be used as a field separator in the result.}

\item{sep}{character string to be used as a record separator in the result.}

\item{pos}{cursor position within \code{code}. Defaults to at end of \code{code}.}

\item{min.length}{minimum length of the code.}

\item{skip.used.args}{logical. Should alredy used arguments be omitted from the result?}

\item{FUNC.NAME}{name of the function of which arguments are to be listed.}

\item{\dots}{optional arguments for the \code{FUNC} to be used in determining the
appropriate method.}

\item{what}{character string. Should be one of "search", "library", "par",
"options", "data" or "[".}

\item{x}{used only with \code{what = "["}, the name of the object of which the
elements should be listed.}

\item{argpos}{used only with \code{what = "["}, specifies which argument inside
the square brackets to complete.}
}
\description{
Provide choices for code completion.
}
\details{
If 'object' is provided and
\code{FUNC} is generic (either S3 or S4), \code{completeArgs} returns only arguments for
the appropriate method and/or default method if not found.

\code{completeSpecial} prints newline separated completions for some
special cases. Currently these are: package, namespace, graphical
parameters, 'options' names and quoted items for use with \code{[} or \code{[[}.
}
\section{Functions}{
\itemize{
\item \code{completeArgs}: returns function argument names.

\item \code{completeSpecial}: provides special completions.
}}

\note{
The function assumes that method is dispatched based on the first
argument which may be incorrect.
}
\examples{
## TODO: define gm1 && object
completeArgs("anova", fm1) # if 'fm1' is of class 'glm', it returns argument
   						  #names for 'anova.glm'
completeArgs("[", object)
completeArgs("stats::`anova`", fm1) # function names may be backtick quoted,
                                    # and have a namespace extractor
completion("print(x")
completeSpecial("data")
}
