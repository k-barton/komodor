% Generated by roxygen2: do not edit by hand
% Please edit documentation in R/pkgman.R
\name{pkgMan}
\alias{pkgMan}
\alias{pkgManGetDescription}
\alias{pkgManGetMirrors}
\alias{pkgManGetAvailable}
\alias{pkgManGetInstalled}
\alias{pkgManSetCRANMirror}
\alias{pkgManInstallPackages}
\alias{pkgManRemovePackage}
\alias{pkgManLoadPackage}
\alias{pkgManGetRepositories}
\alias{pkgManGetUpdateable}
\alias{pkgManDetachPackage}
\title{Package manager supporting routines}
\usage{
pkgManGetDescription(pkgName, print = TRUE, omitFields = NULL,
  revDep = TRUE, ...)

pkgManGetMirrors()

pkgManGetAvailable(page = "next", pattern = "", ilen = 50,
  col = c("Package", "Version", "InstalledVersion", "Status",
  "Repository"), reload = FALSE, sep = ";", eol = "\\t\\n")

pkgManGetInstalled(sep = ";", eol = "\\t\\n")

pkgManSetCRANMirror(url)

pkgManInstallPackages(pkgName, installDeps = FALSE, ask = TRUE)

pkgManRemovePackage(pkgName)

pkgManLoadPackage(pkgName)

pkgManGetRepositories(json = TRUE, sep = ";;")

pkgManGetUpdateable(sep = ";;", eol = "\\n")

pkgManDetachPackage(pkgName)
}
\arguments{
\item{pkgName}{names of the packages to be installed/removed etc.}

\item{print}{logical, if \code{TRUE} the result is printed in DCF format.}

\item{omitFields}{optionally, a character vector giving the tags of fields to be omitted.}

\item{revDep}{logical, should reverse dependencies (only within installed packages) be added to standard fields?}

\item{\dots}{optional, additional arguments passed to \code{pkgReverseDependencies}. Possible arguments are:
\code{revFields} (a character vector of fields to examine for reverse dependencies, must be one/some of
\code{"Depends"}, \code{"Imports"}, \code{"Suggests"} and \code{"Enhances"}.}

\item{page}{character string. Either "prev", "next" (default), "first", "last" or "current".}

\item{pattern}{an optional regular expression. Only names matching pattern are returned.}

\item{ilen}{numeric, number of records per page.}

\item{col}{vector of character strings. Column names to be returned.}

\item{reload}{Should new data be produced if a cached copy exists?}

\item{sep, eol}{record and end of line separators.}

\item{url}{character string. CRAN mirror URL.}

\item{installDeps}{logical. Install package dependencies?}

\item{ask}{if \code{TRUE}, asks for confirmation first.}

\item{json}{logical. Should the result be stringized in JSON format?}
}
\description{
These functions are used by the R package manager.
}
