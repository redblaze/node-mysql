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
  * [DB.format](#DB-format)
* Row and Table
  * [define concrete classes](#row-table-instantiation)
  * [new Table](#new-Table)
  * [table.create](#table-create)
  * [table.find](#table-find)
  * [table.findById](#table-findById)
  * [table.lockById](#table-lockById)
  * [table.findAll](#table-findAll)
  * [table.baseQuery](#table-baseQuery)
  * [new Row](#new-Row)
  * [row.update](#row-update)
  * [row.updateWithoutOptimisticLock](#row-updateWithoutOptimisticLock)
  * [row.get](#row-get)
  * [row.getId](#row-getId)

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

Note that db.transaction takes one more arguemnt than the db.connect,
which is a database connection object.  If this connection object is
already a transactional, then it will be used directly in the provided
procedure.  Otherwise, the connection will be "made transactional" and
then used in the provided procedure.

__Example__

```javascript
var txnTest = function(cb) {
    var add2Rows = function(conn, b, cb) {
        dw.transaction(
            conn/*This is a non-transactional connection.*/, 
            function(
                conn/*A new transactional connection is created to handle the transactional session.*/, 
                cb
            ) {
                cps.seq([
                    function(_, cb) {
                        Model.Table.create(conn, getSampleDto(), cb);
                    },
                    function(_, cb) {
                        dw.transaction(
                            conn/*This is already a transactional connection.*/, 
                            function(
                                conn/*No new transactional connection created. 
                                      This connection is the same one as the in the caller context*/, 
                                cb
                            ) {
                                console.log(conn.__transaction__)
                                Model.Table.create(conn, getSampleDto(), cb);
                            }, 
                            cb
                        );
                    },
                    function(_, cb) {
                        if (b) {
                            cb(null, "Commit");
                        } else {
                            throw new Error("Roll back");
                        }
                    }
                ], cb);
            }, 
            cb
        );
    };

    dw.connect(function(conn, cb) {
        /* Uncommenting the following line will merge the two calls to add2Rows into one transaction. */
        // dw.transaction(conn, function(conn, cb) {
            cps.seq([
                function(_, cb) {
                    add2Rows(conn, true, cb);
                },
                function(_, cb) {
                    add2Rows(conn, true, cb);
                }
            ], cb);
        // }, cb);
    }, cb);
};
```

<a name="db-end" />
### db.end();

This function destructs the db object.

<a name="DB-format" />
### DB.format(query_string, variable_bindings)

This is a wrapper of the query string formatting functionality
provided by the mysql package.  Note that this is a global static
method defined on the class DB.  It is NOT an instance method defined
a a DB instance db.

__Example__

```javascript
DB.format('select * from users where id = ?' [userId]);
```
<a name="row-table-instantiation" />
### Concrete Classes for Row and Table

Both Row and Table are abstract classes.  They must be made concrete
before being used.  Here's an example to set up the Row and Table for
a particular database table:


__Example__

```javascript

var User = function() {
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
        'name': 'users',
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

<a name="new-Table"/>
### new Table(table_config)

The table config schema is defined as follows:

```json
{
    "name": {
        "type": "String",
        "optional": false,
        "description": "the name of the database table"
    },
    "idFieldName": {
        "type": "String",
        "optional": true, 
        "default": "id",
        "description": "the name of the primary id column"
    },
    "versionFieldName": {
        "type": "String", 
        "optional": true, 
        "default": "version", 
        "description": "optimistic lock version"
    },
    "createdFieldName": {
        "type": "String",
        "optional": true, 
        "default": "date_created",
        "description": "creation time of the row"
    },
    "updatedFieldName": {
        "type": "String",
        "optional": true, 
        "default": "last_updated",
        "description": "last update time of the row"
    },
    "rowClass": {
        "type": "Row class",
        "optional": false,
        "description": "the Row class of this table"
    },
    "db": {
        "type": "DB class instance",
        "optional": false,
        "description": "the DB instance that the table belongs to"
    }   
}
```

See [here](#row-table-instantiation) for an example of creating a table.  


<a name="table-create"/>

### table.create(database_connection, data_object, callback)

The callback here takes a Row object as result.

__Example__

```javascript
var createTest = function(cb) {
    dw.connect(function(conn, cb) {
        cps.seq([
            function(_, cb) {
                User.Table.create(conn, {
                    first_name: 'Hannah',
                    last_name: 'Mckay',
                    gender: 'female'
                    // ....
                }, cb);
            },
            function(user, cb) {  // user is an object of the class User.Row
                console.log(user.get('first_name')); // print out 'Hannah'
                cb();
            }
        ], cb);
    }, cb);
};
```

In the input data object, please do NOT specify the following fields:

* primary ID
* date_created
* last_udpated
* version

All of the these fields will be filled by the invocation to table.create.

<a name="table-find"/>
### table.find(database_connection, query_string, callback)

This function is not too different from doing a query directly on a
database connection.  The only extra thing it does is to turn the
result from a list of simple hash objects to a list of Row objects of
the corresponding table's "rowClass".

__Example__

```javascript
dw.connect(function(conn, cb) {
    var o;
    cps.seq([
        function(_, cb) {
            User.Table.find(conn, 'select * from users', cb);
        },
        function(users, cb) { // users is a list of user object of the class User.Row
            console.log(users[0]);  // print the information of the first user
            cb();
        }
    ], cb);
}, cb);
```

<a name="table-findById"/>
### table.findById(database_connection, row_id, callback)

This is simply a short-hand for:

```javascript
cps.seq([
    function(_, cb) {
        table.find(
            conn, 
            DB.format('select * from table_name where primary_id = ?', [row_id]),
            cb
        );
    },
    function(res, cb) {
        cb(res[0]);
    }
], cb);
```

It finds a row in a table by its primary ID and returns a single row
object of the table's corresponding rowClass.

<a name="table-lockById"/>
### table.lockById(database_connection, row_id, callback)

This function does the same thing as findById and additionally, it
locks the corresponding row for an atomic update.  lockById can ONLY
be used in a transaction context.  Without a transaction context, it
behaves the same as findById.  Once a row is locked in one
transaction, attempts of locking the same row in other transactions
will hang until the current transaction either commits or rolls back,
which release the current lock.

__Example__

```javascript
var lockTest = function(cb) {
    var exclusiveUpdate = function(conn, delay, value, cb) {
        dw.transaction(null, function(conn, cb) {
            cps.seq([
                function(_, cb) {
                    Model.Table.lockById(conn, 1, cb);
                },
                function(res, cb) {
                    setTimeout(function() {
                        cb(null, res);
                    }, delay);
                },
                function(row, cb) {
                    row.update(conn, {'subscription_status': value}, cb);
                },
                function(res, cb) {
                    cb();
                }
            ], cb)
        }, cb);

    };

    var conn;

    dw.transaction(conn, function(conn, cb) {
        cps.seq([
            function(_, cb) {
                cps.parallel([
                    function(cb) {
                        exclusiveUpdate(conn, 2000, 'foo1', cb);
                    },
                    function(cb) {
                        exclusiveUpdate(conn, 0, 'bar1', cb);
                    }
                ], cb);
            },
            function(res, cb) {
                console.log(res);
                cb();
            }
        ], cb);
    }, cb);
};
```

In this example, two threads are executed in parallel.  The thread of
setting value "bar1" will be block by the thread of setting value
"foo1".

<a name="table-findAll"/>
### table.findAll(database_connection, callback)

This finds all the rows in a table.

<a name="table-baseQuery"/>
### table.baseQuery(query_string, variable_bindings)

This is a short-hand for:

```javascript
DB.format('select * from table_name' + query_string, variable_bindings);
```

It simply prepend a partial string indicating from which table the
query is being performed.  This might come handy in many cases.

<a name="new-Row" />
### new Row(row_data)

After having a concrete Row class, row instances can be created using
it.  The row_data parameter is an object mapping database table column
names to their corresponding values.

__Example__

```javascript
new User.Row({
    first_name: 'Hannah',
    last_name: 'Mckay',
    gender: 'female'
    //....
});
```
<a name="row-update"/>

### row.update(database_connection, update_object, callback)

This function will set the following column automatically:

* last_updated.  This field will be set to the present time stamp.
* version.  This field will be increased.

Other than these columns, only columns listed in the update_object will be updated.

__Example__

```javascript
var findAndUpdateTest = function(cb) {
    dw.connect(function(conn, cb) {
        cps.seq([
            function(_, cb) {
                User.Table.findById(conn, id, cb);
            },
            function(user, cb) {
                var dto = {
                    'last_name': 'Morgan'
                };
                user.update(conn, dto, cb);
            }
        ], cb);
    }, cb);
};
```

<a name="row-updateWithoutOptimisticLock"/>
### row.updateWithoutOptimisticLock(database_connection, update_object, callback)

This function is the same as row.update with only one difference: it
does not care about the optimistic lock version field.  It neither
looks at this field nor update field.  This might be useful
ocasionally when optimistic lock functionality needs to be overriden.


<a name="row-get"/>
### row.get(column_name)

Get the value of a certain column from the row object.

<a name="row-getId"/>
### row.getId()

Get the primary ID of the row object.

