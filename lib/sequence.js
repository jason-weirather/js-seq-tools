"use strict";

const _NT2NUM = {'A':0,'a':0,'C':1,'c':1,'G':2,'g':2,'T':3,'t':3};
const _NUM2NT = {0:'A',1:'C',2:'G',3:'T'};
class NucleotideSequence {
  // A condensed storage for nucleotide sequences
  constructor (seq) {
    if (seq) {
      this.set_seq(seq);
    }
  }
  set_seq (seq) {
    this._seq_length = seq.length;
    // calculate data size
    let dlen = Math.floor(this._seq_length/4);
    if (this._seq_length % 4 !== 0) { dlen += 1; }
    this._base_data = new ArrayBuffer(dlen);
    // use a sparse array for the mask but we should be careful how we use this
    dlen = Math.floor(this._seq_length/8);
    if (this._seq_length % 8 !== 0) { dlen += 1; }
    this._mask_data = new ArrayBuffer(dlen);
    // traverse input sequence and set data
    for(let i  = 0; i < this._seq_length; i++) {
      let j = Math.floor(i/4);
      let r = i % 4;
      this._base_data[j] |= _NT2NUM[seq[i]] << r*2;
      // now work the mask
      j = Math.floor(i/8);
      r = i % 8;
      let mask = 0;
      if (_NT2NUM[seq[i]]===undefined) { mask = 1; }
      this._mask_data[j] |= (mask << r);
    }
  }
  // Access the string.  Use start and stop like python slices
  get_seq (start, stop) {
    if (start===undefined) { start = 0; }
    else if (start < 0) { start = this._seq_length + start; }
    if (stop ===undefined) { stop = this._seq_length; }
    else if (stop < 0) { stop = this._seq_length + stop; }
    // sanity check our start and stop to bound them to the sequence length
    if (start > this._seq_length) { start = this._seq_length; }
    if (stop < 0) { stop = 0; }
    let ostr = '';
    for (let i = start; i < stop; i++) {
      let j = Math.floor(i/4);
      let r = i % 4;
      let base = _NUM2NT[(this._base_data[j] >>> r*2) & 3];
      j = Math.floor(i/8);
      r = i % 8;
      let mask = (this._mask_data[j] >>> r) & 1;
      if (mask) {
        ostr += 'N';
      } else {
        ostr += base;
      }
    }
    return ostr;
  }
}
