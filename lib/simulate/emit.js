"use strict";
const ns = require('../sequence.js');

const _NTS = ['A','C','G','T'];
class NucleotideSequenceEmitter {
  // Optional arguments in an object
  // random: FUNCTION to produce number between 0 and 1 at random
  // gc: FLOAT between 0 and 1 for gc content fraction
  constructor () {
    this.gc
    this.random = Math
    if (arguments[0]) {
      if (arguments[0].random) this.random = arguments[0].random;
      if (arguments[0].gc) this.gc = arguments[0].gc;
    }
    //console.log(this.random());
    //console.log(this._random_nt());
  }
  sequence (slen) {
    var o = new ns.NucleotideSequence;
    o.initialize(slen);
    for (let i=0; i< slen; i++) {
      o.set_nt(this._random_nt(),i);
    }
    return o;
  }
  _random_nt() {
    var rnum = this.random.random();
    if (rnum < this.gc/2) {
      return 'G';
    } else if (rnum < this.gc) {
      return 'C';
    } else if (rnum > this.gc+(1-this.gc)/2) {
      return 'A';
    }
    return 'T';
  }
}

class GenomeEmitter {
  //Output a chromosome and spliced genome
  // Exon sizes
  // Exon numbers
  // Number of genes
  // Intron sizes
  constructor () {
    
  }
}

exports.NucleotideSequenceEmitter = NucleotideSequenceEmitter;
exports.GenomeEmitter = GenomeEmitter;
