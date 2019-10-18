---
title: "Debugging R code in Komodo"
output: html_document
css: doc.css
---

R's debugging functions like `debug`, `browser` or `recover` cannot be used from
within Komodo since they rely on a user interaction with R console. Any R code
containing calls to `browser` should be only executed directly in the R console. 

'KomodoR' provides a function `koBrowseHere` which can be used in a
manner similar to `browser()`. It interrupts the execution of R code and changes the 
current execution environment to where it was called from. Sending
`koBrowseEnd()` command sets the current environment back to `.GlobalEnv`. 

Note that the original call stack is not preserved (so `sys.frames()` or `sys.calls()` 
_et al._ will not work as expected), and the execution of the function cannot be resumed.

__Example:__

Put `koBrowseHere()` call inside a function.

```r
testFun <- function(x,y,z) {
    insideTestFun <- TRUE
    koBrowseHere()
}
```

Now, the execution stops inside `testFun`, and the subsequent commands sent from the
editor will be executed by R inside `testFun`'s environment.
Note the prompt changes from `:>` to `~>` while in "browser" mode.

```r
testFun1()
```

Command output:
```no-highlight
:> testFun1()

Current evaluation environment is now inside
	testFun2(x, z, y)
Use 'koBrowseEnd()' to return to '.GlobalEnv'.
(Note this will not resume execution of the function)

~>
```

A new branch is added to the top of the R Object Browser tree, which lists 
the contents of the current environment. It is named after the last function call, 
in this case <img src="img/environment.png" style="vertical-align: middle;" />`testFun2(x, z, y)`.

To go back to `.GlobalEnv`, either:

*  send `koBrowseEnd()` command to R
*  Click the Environment button <img src="img/GlobalEnv.png" style="vertical-align: middle;" /> on the R toolbar. 
*  Delete the relevant <img src="img/environment.png" style="vertical-align: middle;" /> item in the R Object Browser or in the Attached R Packages panel.


```r
koBrowseEnd()
```

The console shows:

```no-highlight
~> koBrowseEnd()

Evaluating in '.GlobalEnv'

:>
```

The function `koDebug` allows debugging a function when it produces an 
error. This is not equivalent to `debug`, but rather more similar to `recover`.
Browsing mode using `koDebug` differs from `recover` in that it does not allow 
to resume the execution of the code, and the recovered frame is the one of the 
debugged function, not the one where the error occurred (see second example below).

Example:
  
```r
test <- function(x, y, inside.test = TRUE) x + y 
dtest <- koDebug(test)
dtest("1", 2)
```

```no-highlight
Error:  non-numeric argument to binary operator 
in: 
x + y
...
```

```r
ls() # we are now working inside `test`
```
```no-highlight
~> [1] "inside.test", "x" "y"
```

Another example:

```r

test2 <- function(x,y,z) {
    inside.test2 <- TRUE
    stop("stopped inside test2")
}
test1 <- function(x,y,z) {
    inside.test1 <- TRUE
    test2(x,z,y)
}

# Note: there is no (simple) way to undebug the function. 
#       Be careful when overwriting the original function
#       (as it is done here).
	test1 <- koDebug(test1)
```

```no-highlight
Error:  inside test2 
in: 
test2(x, z, y)

Current evaluation environment is now inside
	test1()
...
```
