// Dependencies
var fs = require('fs');
var PNGz = require('./index.js');

// Config
var args = process.argv.slice(2);

// Main
if (args.length >= 3) {
  if (/^(--?|\/)?e(n(code)?)?$/i.test(args[0])) {
    fs.readFile(args[1], function(err, data) {
      if (err) {throw new Error(err);}
      PNGz.encode(data, args[3] || null, function(err, png) {
        if (err) {return console.log(err);}
        fs.writeFile(args[2], png, function(err) {
          if (err) {throw new Error(err);}
        });
      });
    });
  } else if (/^(--?|\/)?d(e(code)?)?$/i.test(args[0])) {
    fs.readFile(args[1], function(err, png) {
      if (err) {throw new Error(err);}
      PNGz.decode(png, args[3] || null, function(err, data) {
        if (err) {return console.log(err);}
        fs.writeFile(args[2], data, function(err) {
          if (err) {throw new Error(err);}
        });
      });
    });
  }
} else {
  console.log('Usage: <encode|decode> <fileNameFrom> <fileNameTo> [password]');
}
