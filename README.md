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
* Run "splunkrepl" at the terminal, passing in required params of `--host`, `--user` and `--pwd`.
* Type any valid SPL query and hit enter. Your results will get returned.

### Non-Interactive
* Run "splunkrepl" at the terminal, passing in required params of `--host`, `--user` and `--pwd` and also passing `--query`

### Options

|Argument|Required|Description
------------------------------
--host   |X |Splunk host to connect to including the port, ex. "https://localhost:8089"               
--user   |X |Splunk user to connect with                                                              
--pwd    |X |Password for the Splunk Account                                                          
--query  |  |SPL query to immediately execute. Runs in non-interactive mode                           
--verbose|  |Return as much detail as possible within each event                                      

## License
Apache 2
