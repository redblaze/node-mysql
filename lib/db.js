
var Class = require('better-js-class');

var cps = require('cps');

var mysql = require('mysql');

var $U = require('underscore');

var getValue = function(o) {
    for (var k in o) {
        return o[k];
    }
};

/*
var procedure = function(fn) {
    return function() {
        var cb = arguments[arguments.length - 1];

        try {
            fn.apply(this, arguments);
        } catch(e) {
            handleError(e, cb);
        }
    };
};

var handleError = function(e, cb) {
    console.log(e.stack);
    if (cb) {
        cb(e);
    }
};

var callback = function(cb, fn) {
    return function(err) {
        try {
            if (err) {
                cb(err);
            } else {
                fn.apply(this, arguments);
            }
        } catch(e) {
            handleError(e, cb);
        }
    };
};
*/

module.exports = function() {
    var DB = Class({
        _init: function(cfg) {
            this._cfg = cfg;
            this._pool = mysql.createPool(cfg);
            this._transactionPool = mysql.createPool(cfg);
            this._schema = {};
            this._prepared = false;
        },

        connect: function(proc, cb) {
            var me = this;

            cps.seq([
                function(_, cb) {
                    me._prepare(cb);
                },
                function(_, cb) {
                    me._connect(proc, cb);
                }
            ], cb);
        },

        _prepare: function(cb) {
            if (this._prepared) {
                return cb();
            }

            console.log('call prepare');
            var me = this;
            var conn;

            this._connect(function(conn, cb) {
                cps.seq([
                    function(res, cb) {
                        conn.query('show tables', cb);
                    },
                    function(tables, cb) {
                        cps.peach(tables, function(table, cb) {
                            var tableName = getValue(table);
                            cps.seq([
                                function(_, cb) {
                                    conn.query('desc ' + tableName, cb);
                                },
                                function(columns, cb) {
                                    me._schema[tableName] = $U.map(columns, function(column) {
                                        return column['Field'];
                                    });
                                    me._prepared = true;
                                    cb();
                                }
                            ], cb);
                        }, cb);
                    }
                ], cb);
            }, cb);
        },

        _connect: function(proc, cb) {
            var me = this;
            var conn;
            cps.seq([
                function(_, cb) {
                    me._pool.getConnection(cb);
                },
                function(res, cb) {
                    conn = res;
                    cps.rescue({
                        'try': function(cb) {
                            proc(conn, cb);
                        },
                        'finally': function(cb) {
                            conn.release();
                            cb();
                        }
                    }, cb);
                }
            ], cb);
        },

        transaction: function(conn, proc, cb) {
            var me = this;
            var txnConn;
            var commitRes;

            if (me._isTxnConnection(conn)) {
                proc(conn, cb);
            } else {
                cps.seq([
                    function(_, cb) {
                        me._prepare(cb);
                    },
                    function(_, cb) {
                        me._getTxnConnection(cb);
                    },
                    function(res, cb) {
                        txnConn = res;
                        cps.rescue({
                            'try': function(cb) {
                                cps.seq([
                                    function(_, cb) {
                                        console.log('start transaction');
                                        txnConn.query('START TRANSACTION', cb);
                                    },
                                    function(_, cb) {
                                        cps.rescue({
                                            'try': function(cb) {
                                                cps.seq([
                                                    function(_, cb) {
                                                        proc(txnConn, cb);
                                                    },
                                                    function(res, cb) {
                                                        commitRes = res;
                                                        console.log('committing');
                                                        txnConn.query('COMMIT', cb);
                                                    },
                                                    function(_, cb) {
                                                        console.log('committed');
                                                        cb(null, commitRes);
                                                    }
                                                ], cb);
                                            },
                                            'catch': function(err, cb) {
                                                cps.seq([
                                                    function(_, cb) {
                                                        console.log('rolling back ...');
                                                        txnConn.query('ROLLBACK', cb);
                                                    },
                                                    function(_, cb) {
                                                        console.log('rolled back');
                                                        throw(err);
                                                    }
                                                ], cb);
                                            }
                                        }, cb);
                                    }
                                ], cb);
                            },
                            'finally': function(cb) {
                                console.log('txn connection release');
                                txnConn.release();
                                cb();
                            }
                        }, cb);
                    }
                ], cb);
            }
        },

        /*
        transaction: procedure(function(conn, proc, cb) {
            console.log('start db trasaction');
            if (conn && conn.__transaction__) {
                proc(conn, cb);
            } else {
                this._transactionPool.getConnection(callback(cb, function(err, conn) {
                    conn.__transaction__ = true;
                    conn.query('START TRANSACTION', callback(cb, function(err) {
                        proc(conn, function(err, res) {
                            if (err) {
                                conn.query('ROLLBACK', function(_err) {
                                    // conn.__transaction__ = false;
                                    conn.end();
                                    if (_err) {
                                        cb(_err);
                                    } else {
                                        console.log('rolled back');
                                        cb(err);
                                    }
                                })
                            } else {
                                conn.query('COMMIT', function(_err) {
                                    // conn.__transaction__ = false;
                                    conn.end();
                                    if (_err) {
                                        cb(_err);
                                    } else {
                                        console.log('committed');
                                        cb(null, res);
                                    }
                                })

                            }
                        });
                    }));
                }));
            }
        }),
        */

        _isTxnConnection: function(conn) {
            return conn != null && conn.__transaction__;
        },

        _getTxnConnection: function(cb) {
            var me = this;

            cps.seq([
                function(_, cb) {
                    me._transactionPool.getConnection(cb);
                },
                function(conn, cb) {
                    conn.__transaction__ = true;
                    cb(null, conn);
                }
            ], cb);
        },

        end: function() {
            this._pool.end();
            this._transactionPool.end();
        }
    });

    $U.extend(DB, {
        format: function(str, bindings) {
            var l = str.split('?')

            if (l.length - 1 != bindings.length) {
                throw new Error('sql string format error');
            }

            var res = [];

            for (var i = 0; i < bindings.length; i++) {
                res.push(l[i]);
                res.push(mysql.escape(bindings[i]));
            }

            res.push(l[l.length - 1]);

            return res.join(' ');
        }
    });

    return DB;
}();
