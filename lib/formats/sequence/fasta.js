"use strict";

//Piping bam files is a major function of this class
const Transform = require('stream').Transform;
const GenericNucleotideSequence = require('../../sequence.js').GenericNucleotideSequence;
const rc_nt = require('../../sequence.js').rc_nt;
const gzip_block = require('../compression/bgzf.js').gzip_block;
const BGZFBlock = require('../compression/bgzf.js').BGZFBlock;

class FastaNTEntry extends GenericNucleotideSequence {
  // A fasta entry consist of two entries
  // The header <buffer>
  // The nucleotides
  // Names wil be defined as the first non-whitespace characters read after >
  // This is the most basic Fasta unit
  constructor (options) {
    super(options);
    this._head = undefined;
    this._seq = '';
  }
  get header () {
    return this._head;
  }
  set header (indata) {
    this._head = indata;
  }
  add_seq (indata) {
    this._seq += indata.replace(/^[\r\n]/g,'');
  }
  set seq (indata) {
    this._seq = indata;
  }
  get seq () {
    return this._seq;
  }
  get length () {
    return this._seq.length;
  }
  get name () {
    let match = /^>(\S+)/.exec(this.header);
    this._name = match[1];
    return this._name;
  }
  get fasta () {
    return this.header+"\n"+this.seq+"\n";
  }
  rc () {
    // override RC. Make a new Fasta object with the same header but
    // with different sequence
    let o = new FastaNTEntry();
    o.header = this.header;
    o.seq = '';
    let j = this.seq.length;
    for (let i = this.seq.length-1; i >= 0; i--) {
      o.add_seq(rc_nt(this.seq[i]));
    }
    return o;
  }
  slice (num1,num2) {
    // Return a new nucleotide sequence that is a substring based
    //   on the following rules.
    // If num1 is undefined set the 0-indexed
    //   start to zero
    // If num1 is greater than or equal to zero.
    //   then set the 0-index string start to num1
    // If num1 is less than 0, then set the 0-indexed
    //   string start to the length of the string plus num1
    // If num2 is undefined set the 1-indexed end 
    //   to the length of the string
    // If num2 is less than or equal to 0 set the one indexed end
    //   to the length of the string plus num2
    // If num2 is greater than 0 set the 1-indexed end to num2
    let o = new FastaNTEntry();
    o.header = this.header;
    if (num1===undefined) num1 = 0;
    else if (num1 < 0) num1 = this.length + num1;
    if (num2===undefined) num2 = this.length;
    else if (num2 < 0) num2 = this.length+num2;
    o.seq = this.seq.slice(num1,num2);
    return o;
  }
}

class ToFastaNTEntry extends Transform {
  // Transform a data stream into Fasta Nucleotide Objects
  constructor (options) {
    if (! options) options = {};
    options.objectMode = true;
    super(options);
    this._buffer = new FastaBuffer();
    this._curr = new FastaNTEntry();
  }
  _transform (indata,encoding,callback) {
    this._buffer.push(indata);
    var fdata = this._buffer.read();
    for (let i = 0; i < fdata.length; i++) {
      if (fdata[i].head) {
        if (this._curr.header) { // we have a header defined
          this.push(this._curr);
          this._curr = new FastaNTEntry();
        }
        this._curr.header = fdata[i].head;
      }
      if (fdata[i].seq) {
        this._curr.add_seq(fdata[i].seq);
      }
    }
    callback();
  }
  _flush (callback) {
    let fdata = this._buffer.drain();
    for (let i = 0; i < fdata.length; i++) {
      if (fdata[i].head) {
        if (this._curr.header) { // we have a header defined
          this.push(this._curr);
          this._curr = new FastaEntry();
        }
        this._curr.header = fdata[i].head;
      }
      if (fdata[i].seq) {
        this._curr.add_seq(fdata[i].seq);
      }
    }
    if (this._curr.header) this.push(this._curr);
    callback();
  }
}

// Begin defining a more exotic kind of fasta storage
// That keeps all the NTs in BGZF format for random access.
// and compression both

class ToFastaBGZFEntry extends Transform {
  constructor (options) {
    if (! options) options = {};
    options.objectMode = true;
    super(options);
    this._buffer = new FastaBuffer();
    this._curr = new FastaBGZFEntry();
  }
  _transform (indata,encoding,callback) {
    this._buffer.push(indata);
    var fdata = this._buffer.read();
    for (let i = 0; i < fdata.length; i++) {
      if (fdata[i].head) {
        if (this._curr.header) { // we have a header defined
          this.push(this._curr);
          this._curr = new FastaBGZFEntry();
        }
        this._curr.header = fdata[i].head;
      }
      if (fdata[i].seq) {
        this._curr.add_seq(fdata[i].seq);
      }
    }
    callback();
  }
  _flush (callback) {
    let fdata = this._buffer.drain();
    for (let i = 0; i < fdata.length; i++) {
      if (fdata[i].head) {
        if (this._curr.header) { // we have a header defined
          this.push(this._curr);
          this._curr = new FastaEntry();
        }
        this._curr.header = fdata[i].head;
      }
      if (fdata[i].seq) {
        this._curr.add_seq(fdata[i].seq);
      }
    }
    if (this._curr.header) this.push(this._curr);
    callback();
  }
}

class FastaBuffer {
  constructor () {
    this._buffer = "\n";
  }
  push (data) {
    if (data.length == 0) return;
    this._buffer += data.toString('ascii');
  }
  read () {
    var outputs = [];
    let csize = 64000;
    while (true) {
      let j = 0;
      //check for sequence before header
      let match = /^([^>]+)\n>/.exec(this._buffer);
      if (match) {
        this._buffer = this._buffer.slice(match[1].length,this._buffer.length);
        outputs.push({seq:match[1].replace(/\n/g,'')});
        continue;
      }
      //check for header
      match = /^(\n>[^\n]+)\n/.exec(this._buffer);
      if (match) {
        this._buffer = this._buffer.slice(match[1].length,this._buffer.length);
        outputs.push({head:match[1].replace(/\n/g,'')});
        continue;
      }
      //check for sequence
      match = /^([^>]{64000,64000})/.exec(this._buffer);
      if (match) {
        this._buffer = this._buffer.slice(match[0].length,this._buffer.length);
        outputs.push({seq:match[0].replace(/\n/g,'')});
        continue;
      }
      //if we are still here then theres not enough seq and no header
      break;
    }
    return outputs;
  }
  drain () {
    let outputs = this.read();
    outputs.push({seq:this._buffer.replace(/\n/g,'')});
    return outputs;
  }
}

class FastaBGZF {
  // a collection of FastaBGZFEntries
  // this class is pretty hard will be kind of a work in progress
  constructor (options) {
    this._entries = [];
  }
  add (indata) {
    this._entries.push(indata);
    //console.log(indata);
  }
  get_index () {
    let offset = 0;
    let bsize = 0;
    for (let i = 0; i < this._entries.length; i++) {
      let e = this._entries[i];
      offset += e.header_archive.length;
      let name = e.name;
      let start = 0;
      let end = 0;
      let spans = [];
      for (let j = 0; j < e.seq_archives.length; j++) {
        let b = new BGZFBlock({archive:e.seq_archives[j]});
        let end = start + b.data.length-1;
        let bsize = b.archive.length;
        spans.push([i,start,end,offset,bsize]);
        offset += bsize;
        start = end;
      }
      console.log(spans);
    }
  }
}

class FastaBGZFEntry extends GenericNucleotideSequence {
  // A fasta entry consist of two entries
  // The header <buffer>
  // The nucleotides <array of buffers>
  // Each buffer will be a bgzf gzip compatible archive
  //    If you write them out in order you would 
  //    have a gzip compatible fast archive
  // The length of each nucleotide buffer will be maintained
  //    and be used for efficient index construction
  // When writing the class to a file index can be stored in
  //    extra field of empty entries
  // Names wil be defined as the first non-whitespace characters read after >
  constructor (options) {
    super(options);
    this._head = undefined;
    this._seqs = [];
    this._len = 0;
  }
  get header () {
    return this._head;
  }
  get header_archive () {
    return this._head_data;
  }
  set header (indata) {
    this._head = indata;
    this._head_data = gzip_block(new Buffer(indata+"\n"),9);
  }
  get seq_archives () {
    return this._seqs;
  }
  add_seq (indata) {
    let buff = new Buffer(indata+"\n");
    this._seqs.push(gzip_block(buff,9));
    this._len += indata.length;
  }
  get length () {
    return this._len;
  }
  get name () {
    let match = /^>(\S+)/.exec(this.header);
    this._name = match[1];
    return this._name;
  }
  get bgzf_binary () {
    return Buffer.concat([this._head_data].concat(this._seqs));
  }
}

exports.FastaNTEntry = FastaNTEntry;
exports.ToFastaNTEntry = ToFastaNTEntry;

exports.FastaBGZFEntry = FastaBGZFEntry;
exports.ToFastaBGZFEntry = ToFastaBGZFEntry;
exports.FastaBGZF = FastaBGZF;
