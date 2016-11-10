"use strict";

const _NT2NUM = {'A':0,'a':0,'C':1,'c':1,'G':2,'g':2,'T':3,'t':3};
const _NUM2NT = {0:'A',1:'C',2:'G',3:'T'};
class NucleotideSequence {
  // A condensed storage for nucleotide sequences
  constructor (seq) {
    if (seq) {
      this.initialize(seq.length);
      this.set_seq(seq);
    }
  }
  initialize (inlen) {
    // make the object initialized to this length
    this._seq_length = inlen;
    // calculate data size
    let dlen = Math.floor(this._seq_length/4);
    if (this._seq_length % 4 !== 0) { dlen += 1; }
    this._base_data = new ArrayBuffer(dlen);
    // use a sparse array for the mask but we should be careful how we use this
    dlen = Math.floor(this._seq_length/8);
    if (this._seq_length % 8 !== 0) { dlen += 1; }
    this._mask_data = new ArrayBuffer(dlen);
    // traverse input sequence and set data
  }
  // Reverse Complement
  // make a new object and return the reverse complement
  rc () {
    let ont = new NucleotideSequence();
    ont.initialize(this._seq_length);
    for (let i = 0, j = this._seq_length-1; i < this._seq_length ; i++,j--) {
      ont.set_nt(this.get_complement_nt(i),j);
    }
    return ont;
  }
  get length () {
    // getter for length
    return this._seq_length;
  }
  set_seq (seq, start) {
    // initialize needs to be run before the first time this is run
    if (start+seq.length >= this._seq_length) {
      throw "ERROR: length not long enough to add this";
    }
    // traverse input sequence and set data, and set the sequence starting at start index
    if (start===undefined) { 
      start = 0; 
    }
    for(let i  = start; i < start+seq.length; i++) {
      this.set_nt(seq[i],i);
    }
  }
  set_nt (nuc,pos) {
    let j = Math.floor(pos/4);
    let r = pos % 4;
    this._base_data[j] |= _NT2NUM[nuc] << r*2;
    // now work the mask
    j = Math.floor(pos/8);
    r = pos % 8;
    let mask = 0;
    if (_NT2NUM[nuc]===undefined) { mask = 1; }
    this._mask_data[j] |= (mask << r);
  }
  get_nt (pos) {
    let j = Math.floor(pos/4);
    let r = pos % 4;
    let base = _NUM2NT[(this._base_data[j] >>> r*2) & 3];
    j = Math.floor(pos/8);
    r = pos % 8;
    let mask = (this._mask_data[j] >>> r) & 1;
    if (mask) {
      return 'N';
    } 
    return base;
  }
  get_complement_nt (pos) {
    let j = Math.floor(pos/4);
    let r = pos % 4;
    let base = _NUM2NT[(~this._base_data[j] >>> r*2) & 3];
    j = Math.floor(pos/8);
    r = pos % 8;
    let mask = (this._mask_data[j] >>> r) & 1;
    if (mask) {
      return 'N';
    } 
    return base;
  }
  // Access the string.  Use start and stop like python slices
  slice (start, stop) {
    if (start===undefined) { start = 0; }
    else if (start < 0) { start = this._seq_length + start; }
    if (stop ===undefined) { stop = this._seq_length; }
    else if (stop < 0) { stop = this._seq_length + stop; }
    // sanity check our start and stop to bound them to the sequence length
    if (start > this._seq_length) { start = this._seq_length; }
    if (stop < 0) { stop = 0; }
    let ostr = '';
    for (let i = start; i < stop; i++) {
      ostr += this.get_nt(i);
    }
    return new NucleotideSequence(ostr);
  }
  // String representation is simply to take it to string land
  toString() {
    let ostr = '';
    for (let i = 0; i < this._seq_length; i++) {
      ostr += this.get_nt(i);
    }
    return ostr;
  }
  static concat() {
    // static method to return a new NucleotideSequence that is the others concatonated
    // Pre:  arguments contains any number of NucleotideSequence objects
    // Post: returns a single concatonated NucleotideSequence object
    var total_length, out_nt;
    var total_length = 0;
    for (let i=0; i < arguments.length; i++) {
      total_length += arguments[i].length
    }
    out_nt = new NucleotideSequence();
    // set it to the new length
    out_nt.initialize(total_length);
    let z = 0;
    for (let i=0; i < arguments.length; i++) {
      for (let j=0; j < arguments[i].length; j++) {
        out_nt.set_nt(arguments[i].get_nt(j),z);
        z += 1;
      }
    }
    return out_nt;
  }
}
