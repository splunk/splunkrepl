var repl = require("repl")
 , splunk = require('splunk-sdk')
 , prettyjson = require('prettyjson')
 , url = require('url')
 , Async = splunk.Async
 , colors = require('colors')
 , Table = require('cli-table');

var argv = require('minimist')(process.argv.slice(2));
var host = argv.host;
var user = argv.user;
var pwd = argv.pwd;
var query = argv.query;
var verbose = argv.verbose;
var hosted = argv.hosted;
var useJson = argv.json;
var self = this;

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

checkArgs();

function createService(host, user, pwd) {
    if (host.toLowerCase().indexOf("http") == -1) {
        host = "https://" + host;
    }

    var parsed = url.parse(host);

    if (parsed.protocol == null) {
        parsed.protocol = "https:";

    }

    if (parsed.port == null) {
        parsed.port = "8089";
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

function eval(cmd, context, filename, callback) {
    cb = callback;

    callback = function(msg) {
        if (msg != undefined) {
            console.log(msg);
        }
        process.stdout.write("spl query>".green);
    }
    cmd = cmd.substring(0, cmd.length -1);

    if (cmd === "?" || cmd === "help") {
        console.log("commands:".white.bold);
        console.log("  :connect [host] [user] [pwd] - set the connection.\r\n\texample - :connect https://localhost:8089 admin changeme".white.bold);
        console.log("  :cls - clear the screen".white.bold)
        console.log("  :exit / ctrl-c - exit the repl".white.bold);
        return callback(" ");
    }

    if (cmd.substring(0, 8) == ":connect" ) {
        var conn = cmd.split(" ");
        if (conn.length != 4) {
            return callback("Invalid arguments, must provide [host] [user] [pwd].\r\n\texample - :connect https://localhost:8089 admin changeme".red.bold);
        }
        host = conn[1];
        user = conn[2];
        pwd = conn[3];

        self.service = createService(host, user, pwd);
        self.service.login(function(err, success) {
            if (!success) {
                if (err.status == "401") {
                    return callback("Invalid username or password".red.bold);
                }
                return callback(JSON.stringify(err,null,2).red.bold);
            }
            else {
                return callback(("Connection set to " + self.service.scheme + ":" + self.service.host + "//:" + self.service.port).yellow.bold);
            }
        })
        return;
    }
    
    if (cmd == ":cls") {
        //clear the screen
        //kudos to @laktak http://stackoverflow.com/a/14976765/18419
        process.stdout.write("\u001b[2J\u001b[0;0H");
        process.stdout.write("spl query>".green)
        return;
    }

    if (cmd == ":exit") {
        process.exit();
    }

    if (cmd.indexOf(":")==0) {
        return callback("Invalid command, type 'help' to see valid commands".red.bold)
    }

    if (host == undefined) {
        return callback("Connection not set, use :connect".red.bold);
    }
    doQuery(cmd, callback);
}

function doQuery(query, callback) {
    if (self.service == undefined) {
        self.service = createService(host, user, pwd);
    }

    var search = 'search ' + query;

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
        function(results, job, done) {
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
        }]
    , function(err) {
        if (err) {
            if (err.error.code != undefined && err.error.code === "ECONNREFUSED") {
                return callback("Error: Connection refused".red.bold);
            }
            return callback(JSON.stringify(err,null,2).red.bold);
        }
        return callback(" ");
    });    
}

if (query != undefined) {
    eval(query,null,null,function(result) {
        console.log(result);;
    });
}
else {
    var local = repl.start({
        "prompt":hosted == true ? "" : "spl query>".green,
        "eval":eval
    });
    if (hosted) 
    {
        process.stdout.write("spl query>".green);
    }
}
