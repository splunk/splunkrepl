# splunkrepl
An awesome little REPL for issuing SPLUNK queries

![ScreenShot](https://raw.github.com/glennblock/splunkrepl/screenshots/repl.png)

## What is it?
splunkrepl is an interactive tool for issuing Splunk queries right from the terminal!

## Installing 
`npm install -g splunkrepl`

## How to use it
splunkrepl works both in an interactive REPL mode and as a non-interactive executor.

### REPL 
* Run "splunkrepl" at the terminal, passing in optional params of `--host`, `--user` and `--pwd`.
* To set / change the connection within the REPL, use :connect i.e. `:connect https://localhost:8089 admin changeme`
* Type any valid SPL query and hit enter. Your results will get returned.
* To clear the REPL screen, use :cls

### Non-Interactive
* Run "splunkrepl" at the terminal, passing in required params of `--host`, `--user` and `--pwd` and also passing `--query`

### Options

Argument  |  Description
--------  |  -----------------
--host    |  Splunk host to connect to including the port, ex. "https://localhost:8089"               
--user    |  Splunk user to connect with                                                              
--pwd     |  Password for the Splunk Account                                                          
--query   |  SPL query to immediately execute. Runs in non-interactive mode                           
--verbose |  Return as much detail as possible within each event (see below) 
--json    |  Send all output in JSON                                      

## Tables
When the results that are returned are calculated (do not have _raw) such as from stats or table, then a table view will be displayed:
![ScreenShot](https://raw.github.com/glennblock/splunkrepl/screenshots/table.png)

## Verbose mode
By default when queries run, splunkrepl will return only _time, source, sourcetype, host and _raw (if available) fields. To get all the details specify `--verbose` and you will get output similar to below:

![ScreenShot](https://raw.github.com/glennblock/splunkrepl/screenshots/verbose.png)

## License
Apache 2
