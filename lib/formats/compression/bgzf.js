"use strict";
// Bring in external package pako
const inherits = require('util').inherits
const deflate = require('pako').deflate;
const inflateRaw = require('pako').inflateRaw;
const deflateRaw = require('pako').deflateRaw;
const Transform  = require('stream').Transform;
const CRC32 = require('crc-32');

// Other modules in this pack
const PipeFitterLowpass = require('../../streams.js').PipeFitterLowpass;
const PipeFitterHighpass = require('../../streams.js').PipeFitterHighpass;
// PipeFitter makes sure we are regardless of inputs, read chunks are the desired size

// Internal numbers
const header_size = 26; // Overhead of bgzf headers
const max_block_size = 65536;  // maximum block size

var createBGZFDecompress = function (options) {
  //Transformable Stream to decompress
  if (! (this instanceof createBGZFDecompress))
    return new createBGZFDecompress(options);
  if (! options) options = {};
  options.objectMode = true;
  // Set a maximum size for highwatermark necessary for gzip
  // Pipefitter makes sure no buffers are larger than what it outputs
  this.cache = new PipeFitterHighpass(max_block_size); // Used to ensure we always read at least the maximum possible number of bytes in each gzip block
  //options.highWaterMark = max_block_size;
  Transform.call(this, options);
  //if (options.level) { this.level = options.level; }
}
// make it a child of Transform
inherits(createBGZFDecompress, Transform);
createBGZFDecompress.prototype._transform = function (indata, encoding, callback) {
  // Main decompression transform puts chunks inot a PipeFitter
  // to ensure that at least 65k is being analyzed each time so we are 
  // garunteed to have read in the entire gzip block
  var out_data, stayin, total, raw_out, remainder, bdata;
  this.cache.add(indata);
  while (this.cache.ready) {
    indata = this.cache.remove();
    bdata = gunzip_block(indata);
    if (bdata.remainder.length > 0) {
      this.cache.putback(bdata.remainder);
    }
    this.push(bdata.data);
  }
  callback();
}
createBGZFDecompress.prototype._flush = function (callback) {
  // Cover the last bit of the buffer sending remaining uncompressed data via push
  var bdata, indata;
  indata = this.cache.drain();
  while (indata.length > 0) {
    // Iterate through the final bit of data until all of it has been decompressed
    bdata = gunzip_block(indata);
    if (bdata.remainder.length > 0) {
      this.cache.putback(bdata.remainder);
    }
    this.push(bdata.data);
    indata = this.cache.drain();
  }
  callback();
}

var gunzip_block = function (indata) {
  //PRE: Take a datablock begins with a gzip and can contain extra data
  //POST: Return the uncompressed data and the extra data separately
  var remainder,odata, bsize, offset, xlen, ulen,clen,ocdata, oucdata, uncompressed_data, crcval, crcold;
  remainder = new Buffer(0);
  // get the size of the data
  const bsize_index = 17;
  bsize = indata.readUInt16LE(bsize_index-1)+1;
  odata = new Buffer(bsize);
  indata.copy(odata,0,0,bsize);
  remainder = new Buffer(indata.length-odata.length);
  indata.copy(remainder,0,bsize,indata.length);
  // now decompress odata
  xlen = odata.readUInt16LE(10);
  offset = 12+xlen;
  clen = bsize-offset-8;
  ocdata = new Buffer(clen);
  odata.copy(ocdata,0,offset,offset+clen);
  uncompressed_data = inflateRaw(ocdata);
  oucdata = new Buffer(uncompressed_data.length);
  for (let i = 0; i < oucdata.length; i+=1) {
    oucdata.writeUInt8(uncompressed_data[i],i);
  }
  crcval = CRC32.buf(oucdata);
  crcold = odata.readInt32LE(odata.length-8);
  if (crcval !== crcold) {
    throw new Error('CRC values do not match');
  }
  return {data:oucdata, remainder:remainder};
}

//Transformable Stream to compress
var createBGZFCompress = function (options) {
  if (! (this instanceof createBGZFCompress))
    return new createBGZFCompress(options);
  if (! options) options = {};
  options.objectMode = true;
  // Set a maximum size for highwatermark necessary for gzip
  // Pipefitter makes sure no buffers are larger than what it outputs
  this.cache = new PipeFitterLowpass(max_block_size-header_size);
  options.highWaterMark = max_block_size-header_size;
  Transform.call(this, options);
  // Get our optional level
  this.level = 9;
  if (options.level) { this.level = options.level; }
}

// make it a child of Transform
inherits(createBGZFCompress, Transform);
createBGZFCompress.prototype._transform = function (indata, encoding, callback) {
  var out_data, stayin, total, raw_out;
  this.cache.add(indata);
  while (this.cache.ready) {
    indata = this.cache.remove();
    raw_out = gzip_block(indata,this.level);
    this.push(raw_out);
  }
  callback();
}

createBGZFCompress.prototype._flush = function (callback) {
  // Cover the last bit of the buffer
  var out_data, indata;
  indata = this.cache.drain();
  if (indata.length > 0) {
    out_data = gzip_block(indata,this.level);
    this.push(out_data);
  }
  callback();
}

var gzip_block = function (indata,inlevel) {
  var compressed_data, blocksize, datasize, out_data, mtime, crcval, z, vdef;
  // overriding _transform

  // No need to check length so long as PipeFitter is doing its job
  //if (indata.length > maxsize) {
  //  // Ensure the highwatermark has done its job
  //  throw new Error('Watermark 2^16 for BGZF exceeded.');
  //}

  // Overhead size for gzip 4+4+4+6+4+4=28
  compressed_data = deflateRaw(indata,{level:inlevel});
  //compressed_data = vdef(indata);
  mtime = Math.floor((new Date).getTime()/1000);
  datasize = compressed_data.length;
  z = 0;  // Keep track of byte index
  blocksize = datasize+header_size;
  out_data = new Buffer(blocksize); // gzipped block allocated
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
  out_data.writeUInt16LE(blocksize-1,z); //BSIZE-1
  z+=2;
  for (let i = 0; i < datasize; i+=1) {
    out_data.writeUInt8(compressed_data[i],z);
    z+=1;
  }
  crcval = CRC32.buf(indata);
  out_data.writeInt32LE(crcval,z);
  z+=4;
  out_data.writeUInt32LE(indata.length,z);
  z+=4;
  return out_data;
}

class BGZFDecompressionCache {
  // a buffer that can have data added to it or taken out
  constructor () {
    this.cache = new PipeFitterHighpass(max_block_size-header_size);
    this.ended = false;
  }
  end () {
    this.ended = true;
  }
  get has_data () {
    if (this.cache.length > 0) return true;
    return false;
  }
  get ready () {
    return this.cache.ready;
  }
  write (indata) {
    if (this.ended) return;
    if (! indata) {
      this.ended = true;
      return;
    }
    this.cache.add(indata);
  }
  read () {
    var indata,outdata, bdata;
    outdata = new Buffer(0);
    if (this.ended) {
      while (this.cache.length > 0) {
        indata = this.cache.drain();
        bdata = gunzip_block(indata);
        if (bdata.remainder.length > 0) {
          this.cache.putback(bdata.remainder);
        }
        outdata = Buffer.concat([outdata,bdata.data]);
      }
    } else {
      while (this.cache.ready) {
        indata = this.cache.remove();
        bdata = gunzip_block(indata);
        if (bdata.remainder.length > 0) {
          this.cache.putback(bdata.remainder);
        }
        outdata = Buffer.concat([outdata,bdata.data]);
      }
    }
    return outdata;
  }
}
//exports.max_block_size = max_block_size;

//exports.header_size = header_size;

exports.createBGZFCompress = createBGZFCompress;

exports.createBGZFDecompress = createBGZFDecompress;

exports.BGZFDecompressionCache = BGZFDecompressionCache;
