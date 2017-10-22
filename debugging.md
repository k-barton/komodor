**Debugging R code in Komodo**
  
Debugging functions like `debug`, `browser` or `recover` cannot be used from within 
Komodo, since they interrupt the communication with R. R code containing `browser`
calls should only be run directly in the R console.   
 
Currently the only way to debug R code within a function in a manner similar to 
`browser()` is `koBrowseHere()`. It interrupts execution of the function and
changes the current execution environment to where it was called from. 
Afterwards use `koBrowseEnd()` to set the current environment back to `.GlobalEnv`. 
Note that the original call stack is not preserved
(so `sys.frames()` or `sys.calls()` et al. will not work as expected), and the 
execution of the function will not be resumed.

Example:

```r
# (1) Define a function. Include a "koBrowseHere" call inside it.  
	in.GlobalEnv <- TRUE
    test <- function(arg1 = 1, arg2 = 2) {
        in.test <- TRUE
        koBrowseHere() # instead of 'browser()'
		# rest of the code will not be executed
    }

# (2) Run the function. The execution is interrupted.
    test()
	
# (3) Now we are inside 'test'.
    ls() 
    # [1] "arg1"     "arg2"     "in.test"
    
# (4) Finally, use "koBrowseEnd()" to go back to global environment. 
    ls() #  back to .GlobalEnv
    # [1] "f1"           "f2"           "in.GlobalEnv"
```

There is also an experimental function `koDebug` that allows debugging 
a function if it produces an error. This is not equivalent to `debug`, rather it
is more similar to `recover`, except it does not allow to resume the 
execution of the code.

Example:
  
```r
    test <- function(x, y, inside.test = TRUE) x + y 
    dtest <- koDebug(test)
    dtest("1", 2)
    # Debug error:  non-numeric argument to binary operator
    # in: 
    # x + y
    ls() # we are now working inside `test`
    # [1] "inside.test", "x" "y"
    # when finished, use `koBrowseEnd()` to go back to .GlobalEnv
```
