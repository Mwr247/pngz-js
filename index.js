// Dependencies
var zlib = require('zlib');
var crypto = require('crypto');
var PNG = require('pngjs').PNG;

// Config
var algorithm = 'aes-256-cbc';
var ivLength = 16;
var keyLength = 32;
var hashAlgorithm = 'sha256';

// Output PNG
function toPNG(buffer, callback) { // Buffer, Function
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
    callback(null, Buffer.concat(pixels));
  });
}

// Takes raw data and returns a PNG image buffer
function encode(data, password, callback) { // Buffer[, String], Function
  if (typeof password === 'function') {
    callback = password;
    password = null;
  }
  zlib.deflateRaw(data, function(err, buffer) {
    if (err) {
      callback(new Error("Could not deflate"), null);
    } else {
      if (password != null && password.length > 0) {
        var iv = crypto.randomBytes(ivLength);
        var key = crypto.createHash(hashAlgorithm).update(Buffer.concat([new Buffer(password), iv])).digest().slice(0, keyLength);
        var cipher = crypto.createCipheriv(algorithm, key, iv);
        var encrypted = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
        zlib.deflateRaw(encrypted, function(err, buffer) {
          if (err) {
            callback(new Error("Could not deflate"), null);
          } else {
            toPNG(buffer, callback);
          }
        });
      } else {
        toPNG(buffer, callback);
      }
    }
  });
}

// Takes a PNG image buffer and returns raw data
function decode(png, password, callback) { // Buffer[, String], Function
  if (typeof password === 'function') {
    callback = password;
    password = null;
  }
  new PNG().parse(png, function(err, buffer){
    if (err) {
      callback(new Error("Not a PNG image"), null);
    } else {
      var pixels = [];
      var len = buffer.data.length;
      for (var i = 0; i < len; i = i + 4) {
        pixels.push(buffer.data.slice(i, i + 3));
      }
      zlib.inflateRaw(Buffer.concat(pixels), function(err, buffer) {
        if (err) {
          callback(new Error("Not a PNGz image"), null);
        } else {
          if (password != null && password.length > 0) {
            var iv = buffer.slice(0, ivLength);
            var key = crypto.createHash(hashAlgorithm).update(Buffer.concat([new Buffer(password), iv])).digest().slice(0, keyLength);
            var decipher = crypto.createDecipheriv(algorithm, key, iv);
            try {
              var decrypted = Buffer.concat([decipher.update(buffer.slice(ivLength)), decipher.final()]);
            } catch(err) {
              callback(new Error("Invalid password"), null);
              return;
            }
            zlib.inflateRaw(decrypted, function(err, data) {
              if (err) {
                callback(new Error("Not a PNGz image"), null);
              } else {
                callback(null, data);
              }
            });
          } else {
            callback(null, buffer);
          }
        }
      });
    }
  });
}

// Export
module.exports = {
  encode: encode,
  decode: decode
};
