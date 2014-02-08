
var Class = require('better-js-class');

var cps = require('cps');

var mysql = require('mysql');

var $U = require('underscore');

var getValue = function(o) {
    for (var k in o) {
        return o[k];
    }
};


module.exports = function() {
    var DB = Class({
        _init: function(cfg, transactionCfg, cursorCfg) {
            this._cfg = cfg;
            this._transactionCfg = transactionCfg || cfg;
            this._cursorCfg = cursorCfg || cfg;
            this._pool = mysql.createPool(cfg);
            this._transactionPool = mysql.createPool(this._transactionCfg);
            this._cursorPool = mysql.createPool(this._cursorCfg);
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
                    me._connect(me._pool, proc, cb);
                }
            ], cb);
        },

        _prepare: function(cb) {
            if (this._prepared) {
                return cb();
            }

            // console.log('call prepare');
            var me = this;
            var conn;

            this._connect(me._pool, function(conn, cb) {
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

        _connect: function(pool, proc, cb) {
            var me = this;
            var conn;
            cps.seq([
                function(_, cb) {
                    pool.getConnection(cb);
                },
                function(res, cb) {
                    conn = res;
                    cps.rescue({
                        'try': function(cb) {
                            proc(conn, cb);
                        },
                        'finally': function(cb) {
                            // console.log('release connection');
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
                    /*
                    function(_, cb) {
                        me._getTxnConnection(cb);
                    },
                    */
                    function(_, cb) {
                        me._connect(me._transactionPool, function(conn, cb) {
                            me._enterTransaction(conn);
                            txnConn = conn;
                            cps.rescue({
                                'try': function(cb) {
                                    cps.seq([
                                        function(_, cb) {
                                            // console.log('start transaction');
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
                                                            // console.log('committing');
                                                            txnConn.query('COMMIT', cb);
                                                        },
                                                        function(_, cb) {
                                                            // console.log('committed');
                                                            cb(null, commitRes);
                                                        }
                                                    ], cb);
                                                },
                                                'catch': function(err, cb) {
                                                    cps.seq([
                                                        function(_, cb) {
                                                            // console.log('rolling back ...');
                                                            txnConn.query('ROLLBACK', cb);
                                                        },
                                                        function(_, cb) {
                                                            // console.log('rolled back');
                                                            throw(err);
                                                        }
                                                    ], cb);
                                                }
                                            }, cb);
                                        }
                                    ], cb);
                                },
                                'finally': function(cb) {
                                    // console.log('txn connection release');
                                    // txnConn.release();
                                    me._leaveTransaction(txnConn);
                                    cb();
                                }
                            }, cb);
                        }, cb);
                    }
                ], cb);
            }
        },

        cursor: function(q, proc, _cb) {
            var returned = false;

            var cb = function(err, res) {
                if (!returned) {
                    returned = true;
                    _cb(err, res);
                } else {
                }
            }

            var breakCB =  cb;
            this._cursorPool.getConnection(function(err, conn) {
                var query = conn.query(q);
                query
                    .on('error', function(err) {
                        // console.log('cursor error');
                        conn.release();
                        cb(new Error(err));
                    })
                    .on('result', function(res) {
                        // console.log('cursor result');
                        conn.pause();

                        var cb = function(err, res) {
                            if (err) {
                                conn.release();
                                breakCB(err);
                            } else {
                                conn.resume();
                            }
                        };

                        cps.seq([
                            function(_, cb) {
                                // console.log('call row processor');
                                proc(res, cb);
                            }
                        ], cb);
                    })
                    .on('end', function() {
                        // console.log('cursor end');
                        conn.release();
                        cb();
                    })
                ;
            });
        },

        _isTxnConnection: function(conn) {
            return conn != null && conn.__transaction__;
        },

        _enterTransaction: function(conn) {
            conn.__transaction__ = true;
        },

        _leaveTransaction: function(conn) {
            conn.__transaction__ = false;
        },

        /*
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
        */

        end: function() {
            this._pool.end();
            this._transactionPool.end();
            this._cursorPool.end();
        },

        getConnection: function(cb) {
            var me = this;

            cps.seq([
                function(_, cb) {
                    me._prepare(cb);
                },
                function(_, cb) {
                    me._pool.getConnection(cb);
                }
            ], cb);
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
