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

    if (host == undefined) {
        console.log("'host' is required".red);
        process.exit();
    }

    if (user == undefined) {
        console.log("'user' is required".red);
    }

    if (pwd == undefined) {
        console.log("'pwd' is required".red);
        process.exit();
    }
}

checkArgs();

var verbose = argv.verbose;
var parsed = url.parse(host);
var scheme = parsed.protocol.substring(0, parsed.protocol.length - 1)

function eval(cmd, context, filename, callback) {
    var search = 'search ' + cmd.substring(1, cmd.length-1);

    var service = new splunk.Service({
        host:parsed.hostname,
        scheme:scheme,
        username:user,
        password:pwd,
        port:parsed.port
    }); 

    Async.chain([
        function(done) {
            service.login(done);
        },
        function(success, done) {
            service.search(search, {}, done);
        },
        function(job, done) {
            job.track({}, function(job) {
                job.results({}, done);
            });
        },
        function(results, job, done) {
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
    eval('(' + query + ')',null,null,function(result) {
        console.log(result);;
    });
}
else {
    var local = repl.start({
        "prompt":"spl query>",
        "eval":eval
        });
}
