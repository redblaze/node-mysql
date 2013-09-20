var cps = require('cps');

var db = require('../lib/node-mysql.js');
var DB = db.DB;
var Row = db.Row;
var Table = db.Table;

var cb = function() {
    var handleError = function(e) {
        if (e.stack) {
            console.log(e.stack);
        } else {
            console.log(e);
        }
    };

    var start = new Date();
    return function(err, res) {
        try {
            var end = new Date();
            console.log('time spent: ', end-start);
            if (err) {
                handleError(err);
            } else {
                console.log(res);
            }
            box.end();
        } catch(e) {
            handleError(e);
            box.end();
        }
    };
}();

var box = new DB({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'prod_clone'
});

var basicTest = function(cb) {
    box.connect(function(conn, cb) {
        cps.seq([
            function(_, cb) {
                conn.query('select * from users limit 1', cb);
            },
            function(res, cb) {
                console.log(res);
                cb();
            }
        ], cb);
    }, cb);
};

var scehmaTest = function(cb) {
    box._prepare(cb);
};

var cursorTest = function(cb) {
    box.connect(function(boxConn, cb) {
        var q = 'select * from coupons';

        box.cursor(q, function(row, cb) {
            // boxConn.query(q, cb);
            throw new Error('foobar');
        }, function(err, res) {
            if (err) {
                console.log(err);
            }
            cb(err, res);
        });
    }, cb);
};


cursorTest(cb);
