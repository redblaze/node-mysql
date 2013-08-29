
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
        ]
    });

    $U.extend(cls, {
        Row: Row,
        Table: Table
    });

    return cls;
}();

var dw = new db.DB({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'data_warehouse_dev'
});

var findAndUpdateTest = function(cb) {
    dw.connect(function(conn, cb) {
        var o;
        cps.seq([
            function(_, cb) {
                var q = Model.Table.baseQuery() + DB.format('limit ?', [1]);
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

findAndUpdateTest(cb);