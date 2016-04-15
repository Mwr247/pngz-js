// Dependencies
var fs = require('fs');
var util = require('util');
var zlib = require('zlib');
var crypto = require('crypto');
var PNG = require('pngjs').PNG;
var PNGDecoder = require('png-stream/decoder');
var Transform = require('stream').Transform;

// Config
var algorithm = 'aes-256-ctr';
var ivLength = 16;
var keyLength = 32;
var hashAlgorithm = 'sha256';

// Output PNG
function toPNG(buffer, callback) { // Buffer, Function
  var len = buffer.length;
  var dim = Math.sqrt(len / 3);
  var png = new PNG({
    width: Math.ceil(dim),
    height: Math.round(dim),
    colorType: 2,
    inputHasAlpha: false
  });
  var pixels = [];

  var max = png.width * png.height * 3;
  var px = new Buffer(max - len);
  var i = 0;
  if (len % 3 == 2){
    px[i] = (buffer[(i + 29) % len] + 37) % 256; i++;
  } else if (len % 3 == 1){
    px[i] = (buffer[(i + 23) % len] + 41) % 256; i++;
    px[i] = (buffer[(i + 29) % len] + 37) % 256; i++;
  }
  var end = i;
  for(i = end; i < max; i = i + 3){
    px[i] = (buffer[(i + 19) % len] + 43) % 256;
    px[i + 1] = (buffer[(i + 23) % len] + 41) % 256;
    px[i + 2] = (buffer[(i + 29) % len] + 37) % 256;
  }

  png.data = Buffer.concat([buffer, px]);
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

// Takes a data stream and pipes to a PNG image stream
function encodeStream(data, password, pngData) { // Stream[, String], Stream
  var deflate = zlib.DeflateRaw();
  var chunks = [];
  var pngParse = function(buffer) {
    var len = buffer.length;
    var dim = Math.sqrt(len / 3);
    var png = new PNG({
      width: Math.ceil(dim),
      height: Math.round(dim),
      colorType: 2,
      inputHasAlpha: false
    });
    
    var pixels = [];

    var max = png.width * png.height * 3;
    var px = new Buffer(max - len);
    var i = 0;
    if (len % 3 == 2){
      px[i] = (buffer[(i + 29) % len] + 37) % 256; i++;
    } else if (len % 3 == 1){
      px[i] = (buffer[(i + 23) % len] + 41) % 256; i++;
      px[i] = (buffer[(i + 29) % len] + 37) % 256; i++;
    }
    var end = i;
    for(i = end; i < max; i = i + 3){
      px[i] = (buffer[(i + 19) % len] + 43) % 256;
      px[i + 1] = (buffer[(i + 23) % len] + 41) % 256;
      px[i + 2] = (buffer[(i + 29) % len] + 37) % 256;
    }

    png.data = Buffer.concat([buffer, px]);
    png.pack().pipe(pngData);
  };
  if (password != null && password.length > 0) {
    var iv = crypto.randomBytes(ivLength);
    var key = crypto.createHash(hashAlgorithm).update(Buffer.concat([new Buffer(password), iv])).digest().slice(0, keyLength);
    var cipher = crypto.createCipheriv(algorithm, key, iv);
    var addiv = new AddIV(iv);
    var deflate2 = zlib.DeflateRaw();
    data.pipe(deflate).pipe(cipher).pipe(addiv).pipe(deflate2).on('data', function(chunk) {
      chunks.push(chunk);
    }).on('end', function() {
      pngParse(Buffer.concat(chunks));
    });
  } else {
    data.pipe(deflate).on('data', function(chunk) {
      chunks.push(chunk);
    }).on('end', function() {
      pngParse(Buffer.concat(chunks));
    });
  }
}

// Takes a PNG image steam and pipes to a data stream
function decodeStream(pngData, password, data) { // Stream[, String], Stream
  var inflate = zlib.InflateRaw();
  if (password != null && password.length > 0) {
    var iv, key, decipher;
    var removeiv = new RemoveIV(ivLength, function(ivData) {
      iv = ivData;
      key = crypto.createHash(hashAlgorithm).update(Buffer.concat([new Buffer(password), iv])).digest().slice(0, keyLength);
      decipher = crypto.createDecipheriv(algorithm, key, iv);
      return;
    });
    var inflate2 = zlib.InflateRaw();
    var piping = pngData.pipe(new PNGDecoder).pipe(inflate).pipe(removeiv);
    //piping.on('finish', function() {
      //piping.pipe(decipher).pipe(inflate2).pipe(data);   
    //});
  } else {
    pngData.pipe(new PNGDecoder).pipe(inflate).pipe(data);
  }
}

// Add IV
var AddIV = function(iv) {
  Transform.call(this);
  this.iv = iv;
  this.count = 0;
};
util.inherits(AddIV, Transform);
AddIV.prototype._transform = function(chunk, encoding, callback) {
  if (!this.count++) {
    chunk = Buffer.concat([this.iv, chunk]);
  }
  this.push(chunk);
  callback();
};

// Remove IV
var RemoveIV = function(ivLen, cb) {
  Transform.call(this);
  this.ivLen = ivLen;
  this.cb = cb;
  this.count = 0;
};
util.inherits(RemoveIV, Transform);
RemoveIV.prototype._transform = function(chunk, encoding, callback) {
  if (!this.count++) {
    this.cb(chunk.slice(0, this.ivLen));
    chunk = chunk.slice(this.ivLen);
  }
  this.push(chunk);
  callback();
};

// Export
module.exports = {
  encode: encode,
  decode: decode
};

// Command line
if (process.argv.length > 2) {
  var args = process.argv.slice(2);
  var help = 'Usage: <encode|decode|strencode|strdecode> <dataFile|string> <pngzFile> [password]';

  // Main
  if (args.length >= 3) {
    if (/^(--?|\/)?e(n(code)?)?str(eam)?$/i.test(args[0])) {
      encodeStream(fs.createReadStream(args[1]), args[3] || null, fs.createWriteStream(args[2]));
    } else if (/^(--?|\/)?d(e(code)?)?str(eam)?$/i.test(args[0])) {
      decodeStream(fs.createReadStream(args[2]), args[3] || null, fs.createWriteStream(args[1]));
    } else if (/^(--?|\/)?e(n(code)?)?$/i.test(args[0])) {
      fs.readFile(args[1], function(err, data) {
        if (err) {throw new Error(err);}
        encode(data, args[3] || null, function(err, png) {
          if (err) {return console.log(err);}
          fs.writeFile(args[2], png, function(err) {
            if (err) {throw new Error(err);}
          });
        });
      });
    } else if (/^(--?|\/)?d(e(code)?)?$/i.test(args[0])) {
      fs.readFile(args[2], function(err, png) {
        if (err) {throw new Error(err);}
        decode(png, args[3] || null, function(err, data) {
          if (err) {return console.log(err);}
          fs.writeFile(args[1], data, function(err) {
            if (err) {throw new Error(err);}
          });
        });
      });
    } else if (/^(--?|\/)?stre(n(code)?)?$/i.test(args[0])) {
      encode(args[1], args[3] || null, function(err, png) {
        if (err) {return console.log(err);}
        fs.writeFile(args[2], png, function(err) {
          if (err) {throw new Error(err);}
        });
      });
    } else if (/^(--?|\/)?strd(e(code)?)?$/i.test(args[0])) {
      fs.readFile(args[2], function(err, png) {
        if (err) {throw new Error(err);}
        decode(png, args[3] || null, function(err, data) {
          if (err) {return console.log(err);}
          console.log(data.toString('utf8'));
        });
      });
    } else {
      console.log(help);
    }
  } else {
    console.log(help);
  }
}
