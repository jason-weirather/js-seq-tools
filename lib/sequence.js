"use strict";

const nucleotide_sequence_permute = require('./simulate/permute.js').nucleotide_sequence_permute;

const _NT2NUM = {'A':0,'a':0,'C':1,'c':1,'G':2,'g':2,'T':3,'t':3};
const _NUM2NT = {0:'A',1:'C',2:'G',3:'T'};

class GenericNucleotideSequence {
  // A generic class for a nucleotide sequence
  // 
  // There many conceivable ways to store an NT sequence
  // This class will define the core functions we would like
  // available to all of them.
  constructor (options) {
    if (! options) options = {};
    if (options.name) { this._name = options.name; }
  }
  set_from_string (seq) {
    throw new Error('generic function must be overriden');
  }
  toString () {
    throw new Error('generic function must be overriden');
  }
  get seq () {
    throw new Error('generic function must be overriden');
  }
  get length () {
    // The sequence length
    throw new Error('generic function must be overriden');
  }
  rc () {
    // Reverse complement
    // returns a new nucleotide sequence that is the reverse complement
    // of this
    throw new Error('generic function must be overriden');
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
    throw new Error('generic function must be overriden');
  }
  //permute (options) {
  //  // Introduce errors into a sequence based on the options
  //  // return a new sequence
  //  throw new Error('generic function must be overriden');
  //}
  // Static functions
  static concat () {
    // Create a new sequence of same type as the members
    throw new Error('generic function must be overriden');
  }

  get_nt (index) {
    // Access a single nucleotide
    return this.slice(index,index+1);
  }
  gc () {
    // Calculate the GC content of the sequence and return
    // returned undefined if no ACTG content
    var seq = this.toString().replace(/[^ATCGatcg]/g,'');
    if (seq.length===0) { return undefined; }
    return seq.replace(/[ATat]/g,'').length/seq.length;
  }
  // Functions that work without being overriden
  [Symbol.iterator]() {
    // An implementation suitable for generic
    var index = 0;
    var seq = this.toString();
    return {
      next: function () {
        index+=1;
        if (seq.length < index) return {done:true};
        return {value:seq[index-1],done:false};
      }
    }
  }
  permute (options) {
    // Call the permute.  It will return with a new objected from this type
    //                    constructed from a string
    if (this._name && ! options.name) { options.name = this._name; }
    return nucleotide_sequence_permute(this,options);
  }
  get name () {
    return this._name;
  }
  set name (indata) {
    this._name = indata;
  }
  get fasta () {
    if (! this._name) throw new Error('name is necessary for a fasta');
    if (! this.seq) throw new Error('seq is necessary for a fasta');
    return '>'+this._name+"\n"+this.seq;
  }

}
var rc_nt = function (nt) {
  switch (nt) {
    case 'A':
      return 'T';
    case 'C':
      return 'G';
    case 'G':
      return 'C';
    case 'T':
      return 'A';
    case 'a':
      return 't';
    case 'c':
      return 'g';
    case 'g':
      return 'c';
    case 't':
      return 'a';
    default:
      return nt;
  }
}

class NucleotideSequence2Bit extends GenericNucleotideSequence {
  // A condensed storage for nucleotide sequences
  constructor (seq) {
    super({});
    if (seq) this.set_from_string(seq);
  }
  set_from_string (seq) {
    if (seq) {
      this.initialize(seq.length);
      this.set_seq(seq);
    }
  }
  initialize (inlen) {
    // Private method to initialize an NT sequence.
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
  equals (that) {
    // Test for equality between two sequences
    // go by byte to make it faster, but have to check 
    if (this._seq_length !== that._seq_length) {
      return false;
    }
    let dlen = Math.floor(this._seq_length/4);
    if (this._seq_length % 4 !== 0) { dlen += 1; }
    for (let i = 0; i < dlen; i++) {
      if (this._base_data[i] != that._base_data[i]) {
        return false;
      }
    }
    dlen = Math.floor(this._seq_length/8);
    if (this._seq_length % 8 !== 0) { dlen += 1; }
    for (let i = 0; i < dlen; i++) {
      if (this._mask_data[i] != that._mask_data[i]) {
        return false;
      }
    }
    return true;
  }
  rc () {
    // Reverse Complement
    // make a new object and return the reverse complement
    // pass the name if we have one
    let ont = new NucleotideSequence2Bit();
    if (this._name) ont.name = this._name;
    ont.initialize(this._seq_length);
    for (let i = 0, j = this._seq_length-1; i < this._seq_length ; i++,j--) {
      ont.set_nt(this.get_complement_nt(i),j);
    }
    ont.name = this.name;
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
    // pass the name if we have one
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
    let res = new NucleotideSequence2Bit(ostr);
    if (this._name) res.name = this._name;
    return res;
  }
  toString () {
    // String representation is simply to take it to string land
    let ostr = '';
    for (let i = 0; i < this._seq_length; i++) {
      ostr += this.get_nt(i);
    }
    return ostr;
  }
  static concat () {
    // static method to return a new NucleotideSequence that is the others concatonated
    // Pre:  arguments contains any number of NucleotideSequence objects
    // Post: returns a single concatonated NucleotideSequence object
    var total_length, out_nt;
    var total_length = 0;
    for (let i=0; i < arguments.length; i++) {
      total_length += arguments[i].length
    }
    out_nt = new NucleotideSequence2Bit();
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
exports.NucleotideSequence2Bit = NucleotideSequence2Bit;
exports.GenericNucleotideSequence = GenericNucleotideSequence;
exports.rc_nt = rc_nt;
