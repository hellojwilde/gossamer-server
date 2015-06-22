function doneify(promised, done) {
  promised.then(
    function(returnValue) {done(null, returnValue)},
    function(err) {done(err)}
  ) 
}

module.exports = doneify;