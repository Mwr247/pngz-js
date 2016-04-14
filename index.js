var zlib = require('zlib');
var crypto = require('crypto');
var PNG = require('pngjs').PNG;
var fs = require('fs');

var algorithm = 'aes-256-cbc';

// Takes raw data and returns a PNG image stream
function encode(data, password, callback) { // Buffer[, String], Function
  if (!Buffer.isBuffer(data)) {
    data = new Buffer(data);
  }
  if (typeof password === 'function') {
    callback = password;
    password = '';
  }
  zlib.deflateRaw(data, function(err, buffer) {
    var cipher = crypto.createCipher(algorithm, password);
    var encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    zlib.deflateRaw(encrypted, function(err, buffer) {
      var dim = Math.sqrt(buffer.length / 3);
      var width = Math.ceil(dim);
      var height = Math.round(dim);
      var png = new PNG({
        width: width,
        height: height,
        colorType: 2,
        inputHasAlpha: false
      });
      png.data = buffer;
      png.pack();
      var bufs = [];
      png.on('data', function(d){bufs.push(d);});
      png.on('end', function(){
        var buf = Buffer.concat(bufs);
        callback(buf);
      });
    });
  });
}

// Takes a PNG image stream and returns raw data
function decode(png, password, callback) { // Stream[, String], Function
  if (typeof password === 'function') {
    callback = password;
    password = '';
  }
  new PNG().parse(png, function(error, buffer){
    var bufs = [];
    var len = buffer.data.length;
    for (var i = 0; i < len; i = i + 4) {
      bufs.push(buffer.data.slice(i, i + 3));
    }
    var buf = Buffer.concat(bufs);
    zlib.inflateRaw(buf, function(err, buffer) {
      var decipher = crypto.createDecipher(algorithm, password);
      var decrypted = Buffer.concat([decipher.update(buffer), decipher.final()]);
      zlib.inflateRaw(decrypted, function(err, data) {
        callback(data);
      });
    });
  });
}

/*var test = fs.readFileSync('index.js');
//console.log(test);
encode(test, function(data) {
  //console.log(data);
  fs.writeFileSync('test.png', data);
  decode(data, function(data2) {
    //console.log(data2);
    fs.writeFileSync('test.txt', data2);
  });
});*/

module.exports = {
  encode: encode,
  decode: decode
};
