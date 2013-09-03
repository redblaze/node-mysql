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

## Use

```javascript
var db = require('node-mysql');
var DB = db.DB;
var BaseRow = db.Row;
var BaseTable = db.Table;
```

## APIs

* DB
  * [new DB](#new-DB)
  * [db.connect](#db-connect)
  * [db.transaction](#db-transaction)
  * [db.end](#db-end)
* Row
  * [new Row](#new-Row)
  * [row.update](#row-update)
  * [row.updateWithoutOptimisticLock](#row-updateWithoutOptmisticLock)
  * [row.get](#row-get)
  * [row.getId](#row-getId)
* Table
  * [new Table](#new-Table)
  * [table.create](#table-create)
  * [table.find](#table-find)
  * [table.findById](#table-findById)
  * [table.findAll](#table-findAll)

<a name="new-DB"/>
### new DB(conf)

Please refer to the the [connection pool conf](https://github.com/felixge/node-mysql#pooling-connections) in mysql package for the config format.

__Example__

```javascript
var box = new DB({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'prod_clone'
});
```

<a name="db-connect">
### db.connect(procedure, callback)

The procedure is a function of the type: 

```javascript
function(connection, callback) {
    // work with the database connection 
}
```

__Example__

```javascript
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

<a name="db-transaction"/>
### db.transaction(db_connection, procedure, callback)

The procedure is a function of the type: 

```javascript
function(connection, callback) {
    // work with the database connection 
}
```

Note that db.transaction takes one more arguemnt than the
db.connect, which is a database connection object.  If the
connection is already a transactional connection, then this connection
will be used directly in the provided procedure.  Otherwise, a new
transactional connection will be created and used in the provided
procedure.

__Example__

```javascript
var txnTest = function(cb) {
    var conn;
    dw.connect(function(conn/*This is a NON-transactional connection.*/, cb) {
        dw.transaction(
            conn/*This connection is masked out.*/, 
            function(conn/*This is a newly created transactional connection.*/, cb) {
                cps.seq([
                    function(_, cb) {
                        Model.Table.create(conn, getSampleDto(), cb);
                    },
                    function(_, cb) {
                        dw.transaction(
                            conn/*This connection is already transactional.*/, 
                            function(conn/*So this is NOT a new transaction.  It's carried in from the enclosing context*/, cb) {
                                console.log(conn.__transaction__)
                                Model.Table.create(conn, getSampleDto(), cb);
                            }, 
                            cb
                        );
                    },
                    function(_, cb) {
                        throw new Error('foobar');
                        // cb(null,'ok');
                    }
                ], cb);
            }, 
            cb
        );
    }, cb);
};
```

<a name="db-end" />
### db.end();

This function destructs the db object.



### Row and Table

Both Row and Table are abstract classes.  They must be made concrete before being used.  Here's an example to set up the Row and Table for a particular database table:


__Example__

```javascript

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
