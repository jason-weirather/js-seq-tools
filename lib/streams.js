"use strict";

// A Generic pipe to buffer data in and out of
class PipeFitterGeneric {
  constructor () {
    this._cache = new Buffer(0);
  }
  get length () {
    return this._cache.length;
  }
  drain () {
    // remove any remaining bits
    let res = this._cache.slice(0,this._cache.length);
    this._cache = new Buffer(0);
    return res;
  }
  add (indata) {
    // add any number or size of buffers
    this._cache = Buffer.concat([this._cache,indata]);
  }
  putback (indata) {
    // add this data to the beginning of the buffers
    if (this._cache.length==0) {
      this._cache = indata;
      return;
    }
    this._cache = Buffer.concat([indata,this._cache]);
  }
  remove() {
    // override this
    // remove a chunk
  }
  get ready () {
    // override this
    // true if we have a chunk big enough to read
  }
}

// Ensure that chunks of <maxsize> are
// the largest data that can be read
class PipeFitterLowpass extends PipeFitterGeneric {
  constructor (maxsize) {
    super();
    this.maxsize = maxsize;
  }
  remove() {
    // remove an aritrary chunksize
    // return undefined if not ready
    if ( !this.ready) return undefined; // not enough data
    let res = this._cache.slice(0,this.maxsize);
    if (this._cache.length > this.maxsize) {
      this._cache = this._cache.slice(this.maxsize,this._cache.length);
    } else {
      this._cache = new Buffer(0);
    }
    return res;
  }
  remove_all () {
    // remove all that are ready (does not drain)
    var outputs = [];
    while (this.ready) {
      outputs.push(this.remove());
    }
    return outputs;
  }
  get ready () {
    // true if we have a chunk big enough to read
    if (this.length >= this.maxsize) return true;
    return false;
  }
}
// Ensure chunks are at least <minsize>
class PipeFitterHighpass extends PipeFitterGeneric {
  constructor (minsize) {
    super();
    this.minsize = minsize;
  }
  remove() {
    // remove an aritrary chunksize
    // return undefined if not ready
    // dump everything if we are ready
    if (! this.ready) return undefined; // not enough data
    let res = this._cache.slice(0,this._cache.length);
    this._cache = new Buffer(0);
    return res;
  }
  get ready () {
    // true if we have a chunk big enough to read
    if (this._cache.length > this.minsize) return true;
    return false;
  }
}


// Send outgoing chunks of a fixed size
// with the exception of the last chunk
// Input: Buffer, use <pipefitter>.add(mybuffer) to add data
// Output: Check if ready using BOOL = <pipfitter>.is_ready()
//         then read with BUFFER = <pipefitter>.remove()
class PipeFitter {
  constructor (maxsize) {
    this.maxsize = maxsize;
    this.buffer = new Buffer(0);
  }
  is_ready () {
    if (this.buffer.length >= this.maxsize) return true;
    return false;
  }
  add (indata) {
    //this.buffer = Buffer.concat([this.buffer,indata],this.buffer.length+indata.length);
    this.buffer = Buffer.concat([this.buffer,indata]);
  }
  remove () {
    if (! this.is_ready()) return false;
    // We have enough to pass value
    let obuf = new Buffer(this.maxsize);
    this.buffer.copy(obuf,0,0,this.maxsize);
    let nbuf = new Buffer(this.buffer.length-this.maxsize);
    //console.log(this.maxsize+' '+this.buffer.length);
    this.buffer.copy(nbuf,0,this.maxsize,this.buffer.length);
    //console.log(nbuf.length);
    this.buffer = nbuf;
    return obuf;
  }
  putback (indata) {
    //console.log(indata.length);
    //console.log(indata);
    var nbuf;
    if (this.buffer == 0) {
      this.buffer = indata;
    } else {
      nbuf = Buffer.concat([indata,this.buffer],indata.length+this.buffer.length);
      this.buffer = nbuf;
    }
  }
  last () {
    var oval = this.buffer;
    this.buffer = new Buffer(0);
    return oval;
  }
}
exports.PipeFitter = PipeFitter;
exports.PipeFitterLowpass = PipeFitterLowpass;
exports.PipeFitterHighpass = PipeFitterHighpass;
