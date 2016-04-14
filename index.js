// Dependencies
var zlib = require('zlib');
var crypto = require('crypto');
var PNG = require('pngjs').PNG;
var fs = require('fs');

// Config
var algorithm = 'aes-256-cbc';
var ivLength = 16;
var hashAlgorithm = 'sha256';

// Takes raw data and returns a PNG image buffer
function encode(data, password, callback) { // Buffer[, String], Function
  if (typeof password === 'function') {
    callback = password;
    password = '';
  }
  zlib.deflateRaw(data, function(err, buffer) {
    if (err) {throw new Error(err);}
    var key = crypto.createHash(hashAlgorithm).update(password).digest();
    var iv = crypto.randomBytes(ivLength);
    var cipher = crypto.createCipheriv(algorithm, key, iv);
    var encrypted = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
    zlib.deflateRaw(encrypted, function(err, buffer) {
      if (err) {throw new Error(err);}
      var dim = Math.sqrt(buffer.length / 3);
      var png = new PNG({
        width: Math.ceil(dim),
        height: Math.round(dim),
        colorType: 2,
        inputHasAlpha: false
      });
      var pixels = [];
      png.data = buffer;
      png.pack().on('data', function(data) {
        pixels.push(data);
      }).on('end', function() {
        callback(Buffer.concat(pixels));
      });
    });
  });
}

// Takes a PNG image buffer and returns raw data
function decode(png, password, callback) { // Buffer[, String], Function
  if (typeof password === 'function') {
    callback = password;
    password = '';
  }
  new PNG().parse(png, function(err, buffer){
    if (err) {throw new Error(err);}
    var pixels = [];
    var len = buffer.data.length;
    for (var i = 0; i < len; i = i + 4) {
      pixels.push(buffer.data.slice(i, i + 3));
    }
    zlib.inflateRaw(Buffer.concat(pixels), function(err, buffer) {
      if (err) {throw new Error(err);}
      var key = crypto.createHash(hashAlgorithm).update(password).digest();
      var iv = buffer.slice(0, ivLength);
      var decipher = crypto.createDecipheriv(algorithm, key, iv);
      var decrypted = Buffer.concat([decipher.update(buffer.slice(ivLength)), decipher.final()]);
      zlib.inflateRaw(decrypted, function(err, data) {
        if (err) {throw new Error(err);}
        callback(data);
      });
    });
  });
}

var test = fs.readFileSync('index.js', 'ascii');
//console.log(test);
encode(test, '', function(data) {
  //console.log(data);
  fs.writeFileSync('test.png', data);
  decode(data, '', function(data2) {
    //console.log(data2);
    fs.writeFileSync('test.txt', data2);
  });
});

module.exports = {
  encode: encode,
  decode: decode
};
