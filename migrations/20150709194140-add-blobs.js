var dbm = global.dbm || require('db-migrate');
var type = dbm.dataType;

exports.up = function(db, callback) {
  db.createTable('blobs', {
    digest: {type: 'char', length: 40, primaryKey: true},
    file: {type: 'blob'}
  }, callback);
};

exports.down = function(db, callback) {
  db.dropTable('blobs', callback);
};
