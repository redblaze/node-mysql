
var Class = require('better-js-class');
var $U = require('underscore');
var _DB = require('./db.js');
var $M = require('./model.js');

var DB = Class(_DB, {
    _init: function(cfg) {
        this.parent._init.call(this, cfg);
        this._models = {};
    },

    add: function(cfg) {
        var model = {};

        var Row = Class($M.Row, $U.extend({
            _init: function(data) {
                this.parent._init.call(this, data, {
                    table: Table
                });
            }
        }, cfg.Row || {}));

        var TableClass = Class($M.Table, cfg.Table || {});

        var Table = new TableClass({
            db: this,
            name: cfg.name,
            rowClass: Row,
            idFieldName: cfg.idFieldName || 'id',
            versionFieldName: cfg.versionFieldName || 'version',
            createdFieldName: cfg.createdFieldName || 'date_created',
            updatedFieldName: cfg.updatedFieldName || 'last_updated'
        });

        $U.extend(model, {
            Row: Row,
            Table: Table
        });

        this._models[cfg.name] = model;

        return Table;
    },

    get: function(name) {
        return this._models[name];
    }
});

DB.format = _DB.format;

module.exports = {
    DB: DB,
    Row: $M.Row,
    Table: $M.Table,
    OPTIMISTIC_LOCK_EXCEPTION: $M.OPTIMISTIC_LOCK_EXCEPTION
}


