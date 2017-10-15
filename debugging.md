**Debugging R code in Komodo**
  
Debugging R code using `browser()` or `recover` cannot be used from within 
Komodo. These functions would interrupt the communication with R and no output 
will be displayed. Code containing `browser` calls should only be run directly 
in the R console.   
 
Currently the only way to debug code within a function in a manner similar to 
`browser()` is to change the current execution environment using 
`koBrowseHere()` call within a function and afterwards set it back to 
`.GlobalEnv` with `koBrowseEnd()`. Note that the original call stack (i.e. 
`sys.frames()` or `sys.calls()` et al.) is not preserved, and the execution
of the function will not be resumed.
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

There is alsoe a new, experimental function `koDebug` that allows debugging 
a function if it produces an error. The execution stops and the user can debug 
inside the frame that caused the error.
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
