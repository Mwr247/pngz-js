# pngz-js
A library for encoding/decoding data into PNG images

### Functions

#### `encode(<Buffer>data[, <String>password], <Function(<Error>err, <Buffer>png)>callback)`
Takes in a buffer or string of any sort of data, and produces a buffer for a PNG image file containing that data in compressed form.
When given a password, it will also encrypt the compressed data using AES-256.

#### `decode(<Buffer>png[, <String>password], <Function(<Error>err, <Buffer>data)>callback)`
Takes in a buffer for a PNG image file, and produces a buffer for the decompressed data contained in the image.
When given a password, it will also decrypt the compressed data using AES-256.
