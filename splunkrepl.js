var repl = require("repl")
 , path = require('path')
 , fs = require('fs')
 , splunk = require('splunk-sdk')
 , prettyjson = require('prettyjson')
 , url = require('url')
 , open = require('open')
 , Async = splunk.Async
 , colors = require('colors')
 , Table = require('cli-table')
 , nconf = require('nconf');

var self = this;
var argv = require('minimist')(process.argv.slice(2));
var query = argv.query;
var verbose = argv.verbose;
var hosted = argv.hosted;
var useJson = argv.json;

function checkArgs() {
    var firstParam = process.argv[2];
    if (firstParam == "?" || firstParam == "help" || firstParam=="--help") {
        console.log("\r\nusage:".white); 
        console.log("\t--host - Splunk's host".white.bold)
        console.log("\t--user - Splunk user".white.bold);
        console.log("\t--pwd - Splunk password".white.bold);
        console.log("\t--query - SPL Query (runs in non-interactive)".white.bold);
        console.log("\t--verbose - Output all event metadata".white.bold);
        console.log("\t--json - Output in raw json")
        process.exit();
    }
}

function createService(host, user, pwd) {
    if (host.toLowerCase().indexOf("http") == -1) {
        host = nconf.get('scheme') + '://' + host;
    }

    var parsed = url.parse(host);

    if (parsed.protocol == null) {
        parsed.protocol = nconf.get('scheme') + ':';

    }

    if (parsed.port == null) {
        parsed.port = nconf.get('port');
    }
    
    var scheme = parsed.protocol.substring(0, parsed.protocol.length - 1);
    
    var service = new splunk.Service({
        host:parsed.hostname,
        scheme:scheme,
        username:user,
        password:pwd,
        port:parsed.port
    }); 

    return service;
}

function cmd_help(callback) {
    console.log("commands: () = optional".white.bold);
    console.log("  :connect (host) (user) (pwd) - set the connection.\r\n    example - :connect https://localhost:8089 admin changeme".white.bold);
    console.log("  :web (query) - sends a query to the Splunk UI. If query is not specified, uses the last query".white.bold);
    console.log("  :web-port [port] - specify the default web port to use\r\n    example - :web-port 9000".white.bold);
    console.log("  :get [key] - retrieves [key] from global config and executes it".white.bold);
    console.log("  :set - [key] [value] sets the key in the global config".white.bold);
    console.log("  :save - persists any in memory changes to the global config".white.bold);
    console.log("  :cls - clear the screen".white.bold);
    console.log("  :exit / ctrl-c - exit the repl".white.bold);
    return callback();    
}

function cmd_connect(cmd, callback) {
    var host=nconf.get("host");
    var user=nconf.get("user");
    var pwd=nconf.get("pwd");
    var conn = cmd.split(" ");

    if (conn.length >= 2) {
        host = conn[1];
    }

    if (conn.length >= 3) {
        user = conn[2];
    }

    if (conn.length == 4) {
        pwd = conn[3];
    }

    if (conn.length > 4) {
        return callback("Invalid arguments, syntax - :connect (host) (user) (pwd).\r\n\texample - :connect localhost admin changeme".red.bold);
    }

    self.service = createService(host, user, pwd);

    self.service.login(function(err, success) {
        if (!success) {
            handleError(err, callback);
        }
        else {
            return callback(("\r\nConnection set to " + self.service.scheme + "://" + self.service.host + ":" + self.service.port).yellow.bold);
        }
    })
    return callback();
}

function cmd_get(cmd, context,filename, callback) {
    var args = cmd.split(" ");
    if (args.length > 2) {
        return callback("Invalid arguments, syntax - :get [key]".red.bold);
    }
    var key = args[1];
    var val = nconf.get(args[1]);
    if (val != undefined) {
        console.log(val);
        return eval(val + ' ', context, filename, callback);        
    }
    else {
        return callback(" ");
    }
}

function cmd_set(cmd, callback) {
    var args = cmd.split(" ");
    var key = args[1];
    var val = cmd.substring(5 + key.length + 1);
    nconf.set(key, val);
    return callback(" ");
}

function cmd_list(cmd, callback) {
    var store = nconf.stores.file.store;
    var table = new Table({head:['key'.cyan.bold, 'value'.cyan.bold]});
    var keys = [];

    for(var key in store) {
        keys.push(key);
    }

    keys.sort().forEach(function(key) {
        table.push([key.white.bold, store[key].toString().white.bold]);
    });

    console.log(table.toString())
    return callback(" ");
}

function cmd_save(cmd, callback) {
    nconf.save(function(err) {
        if (err != undefined) {
            callback(err);
        }
        callback("Configuration saved".yellow.bold);
    });
}

function cmd_cls(callback) {
    //clear the screen
    //kudos to @laktak http://stackoverflow.com/a/14976765/18419
    process.stdout.write("\u001b[2J\u001b[0;0H");
    return callback();
}

function cmd_port(cmd, callback) {
    var args = cmd.split(" ");
    if (args.length != 2) {
        return callback("Invalid arguments, syntax - :web-port [port]".red.bold);
    }
    nconf.set('webport', args[1]);
    return callback(("Web port set to " + args[1]).yellow.bold);
}

function cmd_web(cmd, callback) {
    var search = cmd.substring(4).trim();
    if (search == "") {
        search = self.lastSearch;
    }
    if (self.service == undefined) {
        return callback("Connection not set, use :connect".red.bold);
    }
    open("http://" + self.service.host + ":" + nconf.get('webport') + "/en-US/app/search/search?q=search " + search);
    return callback();   
}

function eval(cmd, context, filename, callback) {
    cb = callback;
    callback = function(msg) {
        if (msg != undefined) {
            console.log(msg);
        }
        process.stdout.write("spl query>".green);
    }

    cmd = cmd.substring(0, cmd.length -1);

    if (cmd === "?" || cmd === ":help") {
        cmd_help(callback);
    }
    else if (cmd.substring(0, 8) == ":connect" ) {
        cmd_connect(cmd, callback);
    } 
    else if (cmd.substring(0,4) == ":get") {
        cmd_get(cmd, context, filename, callback);
    }
    else if (cmd.substring(0,4) == ":set") {
        cmd_set(cmd, callback);
    }
    else if (cmd == ":list") {
        cmd_list(cmd, callback);
    }
    else if (cmd == ":save") {
        cmd_save(cmd, callback);
    }
    else if (cmd == ":cls") {
        cmd_cls(cmd, callback);
    }
    else if (cmd == ":exit") {
        process.exit();
    }
    else if (cmd.substring(0, 9) == ":web-port") {
        cmd_webport(cmd, callback);
    }
    else if (cmd.substring(0, 4) == ":web") {
        cmd_web(cmd, callback);
    }
    else if (cmd.indexOf(":")==0) {
        return callback("Invalid command, type ':help' to see valid commands".red.bold)
    }
    else {
        doQuery(cmd, callback);
    }
}

function doQuery(query, callback) {
    if (self.service == undefined) {
        self.service = createService(nconf.get("host"), nconf.get("user"), nconf.get("pwd"));
    }

    var search = 'search ' + query;
    self.lastSearch = query;
    Async.chain([
        function(done) {
            self.service.login(done);
        },
        function(success, done) {
            self.service.search(search, {}, done);
        },
        function(job, done) {
            job.track({}, function(job) {
                job.results({}, done);
            });
        },
        outputResults]
    , function(err) {
        if (err) {
            handleError(err, callback);
        }
        return callback(" ");
    });    
}

function outputResults(results, job, done) {
    if (results.rows.length == 0) {
        if (useJson) {
            console.log("[]");
            return done();
        }
        console.log("-- NO RESULTS --".yellow);
        return done();
    }
    var fields={};

    var isStats = results.fields.indexOf("_raw") === -1;
    if (!isStats) {
        fields["_time"] = results.fields.indexOf("_time");
    }
    results.fields.forEach(function(fieldName, index) {
        if (fieldName != "_time")
            fields[fieldName] = index;
    });

    if (!verbose) {
        delete fields['_bkt'];
        delete fields['_si'];
        delete  fields['_cd'];
        delete fields['_indextime'];
        delete fields['_serial'];
        delete fields['linecount'];
        delete fields['_sourcetype'];
        delete fields['splunk_server'];
    }
    var head = [];

    for (var fieldName in fields) {
        head.push(fieldName.cyan.bold);
    }

    var table = new Table({head:head});

    var events=[];

    results.rows.forEach(function(result){
        var event = {};
        var vals = [];
        for(var fieldName in fields) {
            if(isStats) {
                var val = result[fields[fieldName]] || '';
                vals.push(val.white.bold);
            }
            event[fieldName] = result[fields[fieldName]];
        }
        if (useJson) {
            events.push(event);
        }
        else {
            if (isStats)
            {
                table.push(vals);
            }
            else
            {
                console.log("\n" + prettyjson.render(event));
                console.log("---------------------------------------------".grey);
            }
        }
    });
    if (useJson & events.length > 0) {
        console.log(JSON.stringify(events, null, 2));
    }
    if (isStats) {
        console.log(table.toString());
    }
    done();
}

function handleError(err, callback) {
    if (err.status == "401") {
        return callback("\r\nInvalid username or password".red.bold);
    } 
    else if (err.status == "600") {
        return callback("\r\nConnection refused, check Splunk is started and the port is correct".red.bold)
    }
    return callback(JSON.stringify(err,null,2).red.bold);    
}

function getGlobalConfigPath() {
    if (process.platform != 'win32') {
        return path.resolve(process.env.HOME, ".splunkrepl");
    }
    else {
        return path.resolve(process.env.HOMEPATH, ".splunkrepl");
    }
}

function initializeConfig() {
    self.host = argv.host == undefined ? "localhost" : argv.host;
    self.user = argv.user == undefined ? "admin" : argv.user;
    self.pwd = argv.pwd == undefined ? "changeme" : argv.pwd;
    self.port = 8089;
    self.webport = 8000;

    self.configPath = getGlobalConfigPath();
    nconf.file({ file: self.configPath});

    setDefault('port', self.port);
    setDefault('webport', self.webport);
    setDefault('host', self.host);
    setDefault('user', self.user);
    setDefault('pwd', self.pwd);
    setDefault('scheme', 'https');
}

function setDefault(key, value) {
    if (nconf.get(key) == undefined) {
        nconf.set(key, value);
    }
}

function setupEnvironment() {
    if (query != undefined) {
        eval(query,null,null,function(result) {
            console.log(result);;
        });
    }
    else {
        process.stdout.write("Welcome to splunkrepl. Type ':help' to list commands\r\n\r\n".white.bold);
        var local = repl.start({
            "prompt":hosted == true ? "" : "spl query>".green,
            "eval":eval
        });
        if (hosted) 
        {
            process.stdout.write("spl query>".green);
        }
    }
}

initializeConfig();
checkArgs();
setupEnvironment();

