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

exports.PipeFitterLowpass = PipeFitterLowpass;
exports.PipeFitterHighpass = PipeFitterHighpass;
