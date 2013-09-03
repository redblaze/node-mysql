
var cps = require('cps');
var Class = require('better-js-class');
var $U = require('underscore');

var db = require('../lib/node-mysql.js');
var DB = db.DB;


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
        } catch(e) {
            handleError(e);
        } finally {
            dw.end();
        }
    };
}();

var dw = new db.DB({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'data_warehouse_dev'
});

var Model = function() {
    var cls = {
    };

    var Row = Class(db.Row, {
        _init: function(data) {
            this.parent._init.call(this, data, {
                table: Table
            });
        }
    });

    var TableClass = Class(db.Table, {
    });

    var Table = new TableClass({
        'name': 'subscription_initiation',
        'idFieldName': 'id',
        'rowClass': Row,
        /*
        'schema': [
            'id',
            'version',
            'date_created',
            'last_updated',
            'user_id',
            'subscription_id',
            'gift_id',
            'init_date',
            'subscription_status'
        ],
        */
        'db': dw
    });

    $U.extend(cls, {
        Row: Row,
        Table: Table
    });

    return cls;
}();


var findAndUpdateTest = function(cb) {
    dw.connect(function(conn, cb) {
        var o;
        cps.seq([
            function(_, cb) {
                var q = Model.Table.baseQuery('limit ?', [1]);
                console.log(q);
                Model.Table.find(conn, q, cb);
            },
            function(res, cb) {
                o = res[0];
                var dto = {
                    'subscription_status': 'active'
                };
                o.update(conn, dto, cb);
            },
            function(res, cb) {
                console.log(res);
                cb();
            }
        ], cb);
    }, cb);
};


var getSampleDto = function() {
    return {
        user_id: '1',
            subscription_id: '1',
        order_id: '1',
        product_id: '1',
        init_date: new Date(),
        subscription_status: 'inactive'
    }
};

var createTest = function(cb) {
    dw.connect(function(conn, cb) {
        cps.seq([
            function(_, cb) {
                Model.Table.create(conn, getSampleDto(), cb);
            },
            function(res, cb) {
                console.log(res);
                cb();
            }
        ], cb);
    }, cb);
};

var txnTest = function(cb) {
    var conn;
    dw.connect(function(conn, cb) {
        dw.transaction(conn, function(conn, cb) {
            cps.seq([
                function(_, cb) {
                    Model.Table.create(conn, getSampleDto(), cb);
                },
                function(_, cb) {
                    dw.transaction(conn, function(conn, cb) {
                        console.log(conn.__transaction__)
                        Model.Table.create(conn, getSampleDto(), cb);
                    }, cb);
                },
                function(_, cb) {
                    throw new Error('foobar');
                    // cb(null,'ok');
                }
            ], cb);
        }, cb);
    }, cb);
};


findAndUpdateTest(cb);