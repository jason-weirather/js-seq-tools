"use strict";
// Bring in external package pako
const inherits = require('util').inherits
const deflate = require('pako').deflate;
const inflateRaw = require('pako').inflateRaw;
const deflateRaw = require('pako').deflateRaw;
const Transform  = require('stream').Transform;
const CRC32 = require('crc-32');
const _EOF = '1f 8b 08 04 00 00 00 00 00 ff 06 00 42 43 02 00 1b 00 03 00 00 00 00 00 00 00 00 00'.replace(/ /g,'');

// Other modules in this pack
const PipeFitterLowpass = require('../../streams.js').PipeFitterLowpass;
const PipeFitterHighpass = require('../../streams.js').PipeFitterHighpass;
// PipeFitter makes sure we are regardless of inputs, read chunks are the desired size

// Internal numbers
const header_size = 26; // Overhead of bgzf headers
const max_block_size = 65536;  // maximum block size

/**
* classes for accessing bgzf compression
* @namespace bgzf
* @memberof formats.compression
*/


/**
* Give on-demand block data and stats and take either unzipped or zipped data as an input
* @class
* @param {Object} options
* @param {Buffer} options.data - data to use to make the BGZF block. must be smaller than max_block_size
* @param {Buffer} options.archive - data is already compressed
* @param {Number} options.level - compression level (default 9)
* @memberof formats.compression.bgzf
*/
class BGZFBlock {
  constructor (options) {
    if (! options.archive && ! options.data) {
      throw new Error("specify either archive or data in the constructor options");
    }
    if (options.data) {
      if (options.data.length > max_block_size) throw new Error("You can't make a BGZF block from that much data");
      this._data = options.data;
    }
    if (options.archive) {
      this._archive = options.archive;
    }
    this.level = 9;
    if (options.level) { this.level = options.level; }
  }
  /**
  * getter
  * @instance
  * @readonly
  * @returns {Buffer} archive - bgzf compressed data
  * @memberof formats.compression.bgzf.BGZFBlock
  */
  get archive () {
    if (this._archive) return this._archive;
    if (! this._data) throw new Error('data has not been set yet');
    this._archive = gzip_block(this._data);
    return this._archive;
  }
  /**
  * getter
  * @instance
  * @readonly
  * @returns {Buffer} data - uncompressed data
  * @memberof formats.compression.bgzf.BGZFBlock
  */
  get data () {
    if (this._data) return this._data;
    if (! this._archive) throw new Error('archive has not been set yet');
    this._data = gunzip_block(this._archive).data;
    return this._data;
  }
}

/**
* Stream data into BGZF Blocks for writing data, objects emitted have the property 'archive' that contains a Buffer of compressed data
* @class
* @extends Transform
* @param {Object} options
* @memberof formats.compression.bgzf
*/
class ToBGZFBlocks extends Transform {
  // Stream data into their BGZF block objects
  constructor (options) {
    if (! options) options = {};
    options.objectMode = true;
    super(options);
    this.cache = new BGZFBlockCache();
  }
  _transform (indata, encoding, callback) {
    // Emit BGZFBlock objects
    var out_data, stayin, total, raw_out, remainder, bdata;
    this.cache.add(indata);
    while (true) {
      let binary = this.cache.remove();  // remove as many as we can
      if (! binary) break;
      let bdata = new BGZFBlock({archive:binary});
      this.push(bdata);
    }
    callback();
  }
  _flush (callback) {
    while (true) {
      let binary = this.cache.remove();
      if (! binary) break;
      let bdata = new BGZFBlock({archive:binary});
      this.push(bdata);
    }
    callback();
  }
}

/**
* buffer data, and allow emitting entire gzip blocks at a time
* @class
* @param {Object} options
* @memberof formats.compression.bgzf
*/
class BGZFBlockCache {
  constructor () {
    this._data = new Buffer(0);
  }
  /**
  * method to add put more data in the buffer
  * @instance
  * @param {Buffer} indata
  * @memberof formats.compression.bgzf.BGZFBlockCache
  */
  add (indata) {
    this._data = Buffer.concat([this._data, indata]);
  }
  /**
  * remove data from the buffer
  * @instance
  * @returns {Buffer} data_chunk - returns false if not enough data is ready
  * @memberof formats.compression.bgzf.BGZFBlockCache
  */
  remove () {
    // see if we can break off a chunk and emit it
    // if not ready return false;
    let block_size = get_block_length(this._data);
    if (! block_size) return false;
    if (this._data.length < block_size) return false;
    let odata = this._data.slice(0,block_size);
    if (this._data.length > block_size) {
      this._data = this._data.slice(block_size,this._data.length);
    } else this._data = new Buffer(0);
    return odata;
  }
}

var get_block_length = function (data) {
    // return false if unable to get the block length
    if (data.length < 128) return false; // we need to have enough for a beginning header
    let j = 0;
    // we can read the block data
    let id1 = data.readUInt8(j);
    j++;
    if (id1 !== 31) throw Error('invalid bgzf ID1');
    let id2 = data.readUInt8(j);
    j++;
    if (id2 !== 139) throw Error('invalid bgzf ID2');
    let CM = data.readUInt8(j);
    j++;
    if (CM !== 8) throw Error('invalid bgzf CM');
    let FLG = data.readUInt8(j);
    j++;
    if (FLG !== 4) throw Error('invalid bgzf FLG');
    // The beginning checks out
    j += 6;  // skip some time field and other stuff
    let XLEN = data.readUInt16LE(j);
    j+= 2;
    if (data.length < j + XLEN) return false; // cant read subfields
    let subend = j+XLEN;
    while (j < subend) { // reading subfields
      let SI1 = data.readUInt8(j);
      j += 1;
      //if (SI1 !== 66) throw Error('invalid bgzf SI1');
      let SI2 = data.readUInt8(j);
      j += 1;
      //if (SI2 !== 67) throw Error('invalid bgzf SI2 '+SI2);
      let SLEN = data.readUInt16LE(j);
      j += 2; // subfield size
      if (SI1 === 66 && SI2 === 67 && SLEN ===2) { // BGZF field
        let block_size = data.readUInt16LE(j)+1;
        j += 2;
        return block_size;
      } else j += SLEN;
    }
    throw new Error('unable to find BGZF fields');
}

/**
* stream compressed data in and uncompressed data out
* @class
* @extends Transform
* @param {Object} options
* @memberof formats.compression.bgzf
*/
class BGZFDecompress extends Transform {
  constructor (options) {
    //Transformable Stream to decompress
    if (! options) options = {};
    options.objectMode = true;
    super(options);
    // Set a maximum size for highwatermark necessary for gzip
    // Pipefitter makes sure no buffers are larger than what it outputs
    this.cache = new PipeFitterHighpass(max_block_size); // Used to ensure we always read at least the maximum possible number of bytes in each gzip block
  }
  _transform (indata, encoding, callback) {
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
  } // end _transform
  _flush (callback) {
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
  } // end _flush
}

/**
* PRE: Take a datablock begins with a gzip and can contain extra data
* POST: Return the uncompressed data and the extra data separately
* @param {Buffer} indata - compressed data
* @returns {Object} outdata - uncompressed data in an Object {data:Buffer,remainder:buffer}
* @memberof formats.compression.bgzf
*/
var gunzip_block = function (indata) {
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

/**
* stream uncompressed data in and compressed data out
* @class
* @extends Transform
* @param {Object} options
* @memberof formats.compression.bgzf
*/
class BGZFCompress extends Transform {
  constructor (options) {
    if (! options) options = {};
    options.highWaterMark = max_block_size-header_size;
    options.objectMode = true;
    super(options);
    // Set a maximum size for highwatermark necessary for gzip
    // Pipefitter makes sure no buffers are larger than what it outputs
    this.cache = new PipeFitterLowpass(max_block_size-header_size);
    // Get our optional level
    this.level = 9;
    if (options.level) { this.level = options.level; }
    if (options.no_EOF) { this.do_EOF = false; }
    else { this.do_EOF = true; }
  }
  _transform (indata, encoding, callback) {
    var out_data, stayin, total, raw_out;
    this.cache.add(indata);
    while (this.cache.ready) {
      indata = this.cache.remove();
      raw_out = gzip_block(indata,this.level);
      this.push(raw_out);
    }
    callback();
  } // end _transform
  _flush (callback) {
    // Cover the last bit of the buffer
    var out_data, indata;
    indata = this.cache.drain();
    if (indata.length > 0) {
      out_data = gzip_block(indata,this.level);
      this.push(out_data);
    }
    if (this.do_EOF) {
      let eof = new Buffer(28);
      eof.write(_EOF,'hex');
      this.push(eof);
      //console.log(eof);
    }
    callback();
  } // end _flush
  //_write (chunk, encoding, callback) {
  //  console.log(chunk);
  //  callback();
  //}
}

/**
* PRE: Take the uncompressed data not checked for max length since it must be fit going into this
* POST: Output bgzf zipped block
* @param {Buffer} indata - uncompressed data
* @param {Number} inlevel - compression level recommend 9
* @returns {Buffer} outdata - compressed data
* @memberof formats.compression.bgzf
*/
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

/**
* Cache class for decompressing BGZF files
* @class
* @memberof formats.compression.bgzf
*/
class BGZFDecompressionCache {
  // a buffer that can have data added to it or taken out
  constructor () {
    this.cache = new PipeFitterHighpass(max_block_size-header_size);
    this.ended = false;
  }
  /**
  * trigger the flag that the data has ended
  * @instance
  * @memberof formats.compression.bgzf.BGZFDecompressionCache
  */
  end () {
    this.ended = true;
  }
  /**
  * getter
  * @instance
  * @readonly
  * @returns {bool} has_data - true if there is data in there
  * @memberof formats.compression.bgzf.BGZFDecompressionCache
  */
  get has_data () {
    if (this.cache.length > 0) return true;
    return false;
  }
  /**
  * getter
  * @instance
  * @readonly
  * @returns {bool} ready - data is ready to be read
  * @memberof formats.compression.bgzf.BGZFDecompressionCache
  */
  get ready () {
    return this.cache.ready;
  }
  /**
  * write data to the buffer
  * @instance
  * @param {Buffer} indata - data is added to the cache
  * @memberof formats.compression.bgzf.BGZFDecompressionCache
  */
  write (indata) {
    if (this.ended) return;
    if (! indata) {
      this.ended = true;
      return;
    }
    this.cache.add(indata);
  }
  /**
  * read / decompress data from the cache ... just one block. you need to call read repeatedly to read all if there is a lot
  * @instance
  * @returns {Buffer} outdata - data is decompressed from one block
  * @memberof formats.compression.bgzf.BGZFDecompressionCache
  */
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

exports.BGZFCompress = BGZFCompress;

exports.BGZFDecompress = BGZFDecompress;

exports.BGZFDecompressionCache = BGZFDecompressionCache;

exports.gzip_block = gzip_block;

exports.BGZFBlock = BGZFBlock;

exports.ToBGZFBlocks = ToBGZFBlocks;
