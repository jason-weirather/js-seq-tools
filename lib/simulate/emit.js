"use strict";
const ns = require('../sequence.js');
const RandomSeeded = require('../random.js').RandomSeeded;

const _NTS = ['A','C','G','T'];

class GenericEmitter {
  // handle the default things all emitters need to do which
  // for one thing is to accept a seeded random number genetor or a seed
  // as an input
  constructor (options) {
    if (! options) options = {};
    if (options.random) this.random = options.random;
    else this.random = new RandomSeeded({seed:options.seed});
  }
}

class NucleotideSequenceEmitter extends GenericEmitter {
  // Optional arguments in an object
  // random: FUNCTION to produce number between 0 and 1 at random
  // gc: FLOAT between 0 and 1 for gc content fraction
  constructor (options) {
    if (! options) options = {};
    super(options); // Super class will deal with the RNG
    if (options.gc) this.gc =options.gc;
    else this.gc = 0.5;
  }
  sequence (slen) {
    var o = new ns.NucleotideSequence2Bit;
    o.initialize(slen);
    for (let i=0; i< slen; i++) {
      o.set_nt(this._random_nt(),i);
    }
    o.name = this.random.uuid4();
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
exports.GenericEmitter = GenericEmitter;
