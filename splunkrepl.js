var repl = require("repl")
 , splunk = require('splunk-sdk')
 , prettyjson = require('prettyjson')
 , url = require('url')
 , Async = splunk.Async
 , colors = require('colors');

var argv = require('minimist')(process.argv.slice(2));
var host = argv.host;
var user = argv.user;
var pwd = argv.pwd;
var query = argv.query;
var verbose = argv.verbose;
var self = this;

function checkArgs() {
    var firstParam = process.argv[2];
    if (firstParam == "?" || firstParam == "help" || firstParam=="--help") {
        console.log("\r\nusage:".white); 
        console.log("\t--host - Splunk's host".white.bold)
        console.log("\t--user - Splunk user".white.bold);
        console.log("\t--pwd - Splunk password".white.bold);
        console.log("\t--query - (optional) SPL Query (runs in non-interactive)".white.bold);
        console.log("\t--verbose - (optional) Output all event metadata".white.bold);
        process.exit();
    }
}

checkArgs();

function createService(host, user, pwd) {
    var parsed = url.parse(host);
    var scheme = parsed.protocol.substring(0, parsed.protocol.length - 1)

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
        process.stdout.write("spl query>");
    }
    cmd = cmd.substring(0, cmd.length -1);
    if (cmd === "?" || cmd === "help") {
        console.log("commands:");
        console.log("  :connect [host] [user] [pwd] - set the connection");
        console.log("  :quit / ctrl-c - exit the repl");
        return callback(" ");
    }

    if (cmd.substring(0, 8) == ":connect" ) {
        var conn = cmd.split(" ");
        host = conn[1];
        user = conn[2];
        pwd = conn[3];

        self.service = createService(host, user, pwd);
        return callback("Connection set");
    }
    
    if (cmd == ":quit") {
        process.exit();
    }

    if (host == undefined) {
        return callback("Connection not set, use :connect");
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
                console.log("-- NO RESULTS --".yellow);
                return done();
            }
            var fields={};
            
            fields["_time"] = results.fields.indexOf("_time");
            
            results.fields.forEach(function(fieldName, index) {
                if (fieldName != "_time")
                    fields[fieldName] = index;
            });
   
            if (!verbose) {
                delete fields['_bkt'];
                delete fields['_si'];
                delete fields['_cd'];
                delete fields['_indextime'];
                delete fields['_serial'];
                delete fields['linecount'];
                delete fields['_sourcetype'];
                delete fields['splunk_server'];
            }
            
            results.rows.forEach(function(result){
                var event = {};
                for(var fieldName in fields) {
                    event[fieldName] = result[fields[fieldName]];
                }
                console.log("\n" + prettyjson.render(event));
                console.log("---------------------------------------------".grey);
            });
            done();
        }]
    , function(err) {
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
        "prompt":"",
        "eval":eval
    });
    process.stdout.write("spl query>");
}
