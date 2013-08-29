# node-mysql

A wrapper of the node.js mysql package to make it a bit easier to use.

## Install

```text
npm install node-mysql
```

### Dependencies

```json
    "dependencies": {
        "better-js-class": "*",
        "cps": "*",
        "mysql": "*",
        "underscore": "*"
    }
```

## API Document

### Use

```javascript
var db = require('node-mysql');
var DB = db.DB;
var BaseRow = db.Row;
var BaseTable = db.Table;
```

### DB Class

__Example__

```javascript
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
```
### Row and Table

__Example__

Here's a sample Model class.

```javascript
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
        'db': dw
    });

    $U.extend(cls, {
        Row: Row,
        Table: Table
    });

    return cls;
}();
```

Here's an example calling APIs on the model:

```javascript
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
```

Here's an example of creating a row:

```javascript
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
```

Here's an example of using transactions:

```javascript
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
```

