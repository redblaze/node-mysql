
var Class = require('better-js-class');
var cps = require('cps');
var $U = require('underscore');

var DB = require('./db.js');

module.exports = function() {
    var Model = {
        OPTIMISTIC_LOCK_EXCEPTION: 'optimistic_lock_exception'
    };

    var Row  = Class({
        _init: function(data, cfg) {
            this._table = cfg.table;
            this._data = data;
        },

        getId: function() {
            return this._data[this._table.getIdFieldName()];
        },

        _getVersion: function() {
            return this._data[this._table.getVersionFieldName()];
        },

        _nextVersion: function() {
            return this._data[this._table.getVersionFieldName()] + 1;
        },

        _updateLocalData: function(dto) {
            for (var k in dto) {
                var v = dto[k];
                this._data[k] = v;
            }
        },

        updateWithoutOptimisticLock: function(conn, dto, cb) {
            this._update(conn, dto, null, cb);
        },

        update: function(conn, dto, cb) {
            var me = this;

            dto['version'] = this._nextVersion();
            var cond = DB.format('version = ?', [this._getVersion()]);

            cps.seq([
                function(_, cb) {
                    me._update(conn, dto, cond, cb);
                },
                function(res, cb) {
                    if (res.changedRows === 0) {
                        throw new Error(Model.OPTIMISTIC_LOCK_EXCEPTION);
                    } else {
                        cb(null, res);
                    }
                }
            ], cb);
        },

        _update: function(conn, dto, conditions, cb) {
            var me = this;

            dto[this._table.getUpdatedFieldName()] = new Date();

            var l = [
                ' update ', this._table.getName(), ' set '
            ];

            var first = true;
            for (var k in dto) {
                var v = dto[k];
                if (first) {
                    first = false;
                } else {
                    l.push(', ');
                }
                l.push(
                    ' ', k, ' = ', conn.escape(v)
                );
            }

            l.push(
                ' where ', this._table.getIdFieldName(), ' = ', this.getId()
            );

            l.push(
                ' and ', conditions
            );

            l.push(' ; ');

            var q = l.join('');

            // console.log(q);

            cps.seq([
                function(_, cb) {
                    conn.query(q, cb);
                },
                function(res, cb) {
                    me._updateLocalData(dto);
                    cb(null, res);
                }
            ], cb);
        },

        get: function(fieldName) {
            return this._data[fieldName]
        }
    });

    var Table = Class({
        _init: function(cfg) {
            this._name = cfg.name;
            this._idFieldName = cfg.idFieldName || 'id';
            this._versionFieldName = cfg.versionFieldName || 'version';
            this._createdFieldName = cfg.createdFieldName || 'date_created';
            this._updatedFieldName = cfg.updatedFieldName || 'last_updated';

            this._rowClass = cfg['rowClass'];
            // this._schema = cfg['schema'];
            this._db = cfg['db'];
        },

        getName: function() {
            return this._name;
        },

        getIdFieldName: function() {
            return this._idFieldName;
        },

        getVersionFieldName: function() {
            return this._versionFieldName;
        },

        getCreatedFieldName: function() {
            return this._createdFieldName;
        },

        getUpdatedFieldName: function() {
            return this._updatedFieldName;
        },

        create: function(conn, dto, cb) {
            var me = this;

            var d = new Date();
            dto[this.getCreatedFieldName()] = d;
            dto[this.getUpdatedFieldName()] = d;
            dto[this.getVersionFieldName()] = 0;

            var schema = $U.reject(this._db._schema[this.getName()], function(field) {
                return field == me.getIdFieldName();
            });
            // $U.each(this._schema, function(field) {
            $U.each(schema, function(field) {
                if (dto[field] == null) {
                    dto[field] = null;
                }
            });

            var l = [
                ' insert into ' + this.getName() + ' set '
            ];

            var first = true;

            $U.each(dto, function(v, k) {
                if (first) {
                    first = false;
                } else {
                    l.push(', ');
                }
                l.push(
                    ' ', k, ' = ', conn.escape(v)
                );
            });

            l.push(' ; ');

            var q = l.join('');

            // console.log(q);

            cps.seq([
                function(_, cb) {
                    conn.query(q, cb);
                },
                function(res, cb) {
                    dto[me._idFieldName] = res.insertId;
                    cb(null, new me._rowClass(dto));
                }
            ], cb);
        },

        baseQuery: function() {
            return ' select * from ' + this.getName() + ' ';
        },

        findById: function(conn, id, cb) {
            var q = DB.format(this.baseQuery() + ' where ' + this.getIdFieldName() + ' = ?' , [id]);

            cps.seq([
                function(_, cb) {
                    this.find(conn, q, cb);
                },
                function(res) {
                    cb(null, res[0])
                }
            ], cb);
        },

        findAll: function(conn, cb) {
            this.find(conn, this.baseQuery(), cb);
        },

        find: function(conn, q, cb) {
            var me = this;

            cps.seq([
                function(_, cb) {
                    conn.query(q, cb);
                },
                function(res, cb) {
                    cb(null, $U.map(res, function(o) {
                        return new me._rowClass(o);
                    }));
                }
            ], cb);
        }
    });

    $U.extend(Model, {
        Row: Row,
        Table: Table
    });

    return Model;
}();
