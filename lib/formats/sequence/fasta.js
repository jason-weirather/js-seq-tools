"use strict";

//Piping bam files is a major function of this class
const Transform = require('stream').Transform;
const inherits = require('util').inherits;
const GenericSequence = require('../../sequence.js')

class FastaEntry extends GenericNucleotideSequence {
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
  }
}

exports.FastaEntry = FastaEntry;
