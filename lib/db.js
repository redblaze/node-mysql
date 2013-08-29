
var Class = require('better-js-class');

var cps = require('cps');

var mysql = require('mysql');

var $U = require('underscore');

module.exports = function() {
    var DB = Class({
        _init: function(cfg) {
            this._cfg = cfg;
            this._pool = mysql.createPool(cfg);
            this._transactionPool = mysql.createPool(cfg);
        },

        connect: function(proc, cb) {
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
                        me._getTxnConnection(cb);
                    },
                    function(res, cb) {
                        txnConn = res;
                        cps.rescue({
                            'try': function(cb) {
                                cps.seq([
                                    function(_, cb) {
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
                                                        conn.query('COMMIT', cb);
                                                    },
                                                    function(_, cb) {
                                                        cb(null, commitRes);
                                                    }
                                                ], cb);
                                            },
                                            'catch': function(err, cb) {
                                                cps.seq([
                                                    function(_, cb) {
                                                        conn.query('ROLLBACK', cb);
                                                    },
                                                    function(_, cb) {
                                                        throw(err);
                                                    }
                                                ], cb);
                                            }
                                        }, cb);
                                    }
                                ], cb);
                            },
                            'finally': function(cb) {
                                txnConn.release();
                                cb();
                            }
                        }, cb);
                    }
                ], cb);
            }
        },

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
