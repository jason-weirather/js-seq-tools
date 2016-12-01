"use strict";
// Bring in external package pako
const inherits = require('util').inherits
const deflate = require('pako').deflate;
const deflateRaw = require('pako').deflateRaw;
const Transform  = require('stream').Transform;
const CRC32 = require('crc-32');
//const Buffer = require('Buffer').
//Transformable Stream to compress
var createBGZFCompress = function (options) {
  if (! (this instanceof createBGZFCompress))
    return new createBGZFCompress(options);
  if (! options) options = {};
  options.objectMode = true;
  // Set a maximum size for highwatermark necessary for gzip
  this.headersize = 26;
  this.totalmax = 65536; // size we absolutely cannot be bigger than
  this.maxsize = this.totalmax-this.headersize; // most we want to compress due to headers
  this.buffer = new Buffer(this.totalmax); // how much data can be stored
  this.datalen = 0; // how much data has been stored
  options.highWaterMark = this.maxsize;
  Transform.call(this, options);
  // Impart custom
}
// make it a child of Transform
inherits(createBGZFCompress, Transform);
createBGZFCompress.prototype._transform = function _transform(indata, encoding, callback) {
  var out_data;
  if (indata.length > this.maxsize) {
   
  }

  out_data = _gzip_block(indata,this.maxsize);
  this.push(out_data);
  callback();
}

var _gzip_block = function (indata,maxsize) {
  var compressed_data, bsize, out_data, mtime, crcval, z, vdef;
  // overriding _transform
  if (indata.length > maxsize) {
    // Ensure the highwatermark has done its job
    throw new Error('Watermark 2^16 for BGZF exceeded.');
  }
  // Overhead size for gzip 4+4+4+6+4+4=28
  //compressed_data = deflate(indata,{level:9,windowBits:47});
  compressed_data = deflateRaw(indata,{level:9});
  //compressed_data = vdef(indata);
  mtime = Math.floor((new Date).getTime()/1000);
  bsize = compressed_data.length;
  z = 0;
  //out_data = Buffer.alloc(bsize+28); // gzipped block allocated
  out_data = new Buffer(bsize+28); // gzipped block allocated
  out_data.writeUInt8(31,z); // ID1
  z+=1;
  out_data.writeUInt8(139,z); // ID2
  z+=1;
  out_data.writeUInt8(8,z); // CM
  z+=1;
  out_data.writeUInt8(4,z); // FLG
  z+=1;
  out_data.writeUInt32LE(mtime,z); // MTIME
  z+=4;
  out_data.writeUInt8(2,z); // XFL
  z+=1;
  out_data.writeUInt8(255,z); // OS = Unknown OS
  z+=1;
  out_data.writeUInt16LE(6,z); //XLEN
  z+=2;
  out_data.writeUInt8(66,z); //SI1
  z+=1;
  out_data.writeUInt8(67,z); //SI2
  z+=1;
  out_data.writeUInt16LE(2,z); //SLEN
  z+=2;
  out_data.writeUInt16LE(bsize-1,z); //BSIZE-1
  z+=2;
  for (let i = 0; i < bsize; i+=1) {
    out_data.writeUInt8(compressed_data[i],z);
    z+=1;
  }
  //z+=bsize;
  crcval = CRC32.buf(indata);
  out_data.writeInt32LE(crcval,z);
  z+=4;
  out_data.writeUInt32LE(indata.length,z);
  z+=4;
  console.log(z+' '+(bsize+this.headersize)+' '+indata.length);
  return out_data;
}
exports.createBGZFCompress = createBGZFCompress;

