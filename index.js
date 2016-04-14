var zlib = require('zlib');
console.log('start');

zlib.deflateRaw(new Buffer("red yellow blue"), function(err, data) {
  console.log(data);
  console.log('meow');
});