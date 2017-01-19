"use strict";

/**
* classes to help work with streams
* @namespace streams
*/

/**
*A Generic buffer for data in and out to fit output to a certain size
* @class
* @memberof streams
*/
class PipeFitterGeneric {
  /**
  * length of cached data
  * @memberof streams.PipeFitterGeneric
  * @member {Number}
  * @readonly
  */
  constructor () {
    this._cache = new Buffer(0);
  }
  /**
  * length of cached data
  * @memberof streams.PipeFitterGeneric
  * @member {Number}
  * @readonly
  */
  get length () {
    return this._cache.length;
  }
  /**
  * remove any remaining bits
  * @memberof streams.PipeFitterGeneric
  * @return {Buffer}
  */
  drain () {
    let res = this._cache.slice(0,this._cache.length);
    this._cache = new Buffer(0);
    return res;
  }
  /**
  * Add data to the buffer
  * @memberof streams.PipeFitterGeneric
  */
  add (indata) {
    this._cache = Buffer.concat([this._cache,indata]);
  }
  /**
  * Add data to the read-end of the buffer
  * @memberof streams.PipeFitterGeneric
  */
  putback (indata) {
    if (this._cache.length==0) {
      this._cache = indata;
      return;
    }
    this._cache = Buffer.concat([indata,this._cache]);
  }
  remove() {
    throw new Error('must be overriden by child');
  }
  get ready () {
    throw new Error('must be overriden by child');
  }
}

/**
* Ensure that chunks of <maxsize> are the largest data that can be read from the pipe
* @class
* @memberof streams
* @param {Number} maxsize - maximum size of output chunks
*/
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

/**
* Ensure chunks are at least <minsize>
* @class
* @memberof streams
*/
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
