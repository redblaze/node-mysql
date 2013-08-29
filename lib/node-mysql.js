
var DB = require('./db.js');
var Model = require('./model.js');

module.exports = {
    DB: DB,
    Row: Model.Row,
    Table: Model.Table,
    OPTIMISTIC_LOCK_EXCEPTION: Model.OPTIMISTIC_LOCK_EXCEPTION
}


