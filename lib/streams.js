"use strict";

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
    return this.buffer;
  }
}
exports.PipeFitter = PipeFitter;

