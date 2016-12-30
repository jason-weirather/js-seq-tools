"use strict";
const ns = require('../sequence.js');

const _NTS = ['A','C','G','T'];
const _NTNEW = { 'A':['C','G','T'],
                 'C':['A','G','T'],
                 'G':['A','C','T'],
                 'T':['A','C','G']
               };

// This class will provide tools for adding noise to data
var nucleotide_sequence_permute = function (nt,options) {
  // Take a nucleotide sequence and options as inputs
  // Nt is any GenericNucleotideSequence or subclass
  // Options are
  //   rate:  could be insertion, deletion, or one of three mismatches
  //          each has a 20% chance IF an error must occur.
  // The last function will optionally construct a sequence from a string
  if (! options) options = {};
  let getrand = Math;
  if (options.random) getrand = options.random;
  let ostr = '';
  for (let c of nt) {
    // See if we are doing a simple permutation by rate
    if (options.rate) {
      if (getrand.random() < options.rate) { // we need to permute
        // We will put in some kind of error
        let rtypenum = getrand.random();
        let type = 2;
        if (rtypenum < 0.2) {
          type = -2; // insertion
        } else if (rtypenum < 0.4) {
          type = -1; // deletion
        } else if (rtypenum < 0.6) {
          type = 0; // mismatch1
        } else if (rtypenum < 0.8) {
          type = 1; // mismatch2
        }
        if (type >= 0 && type <= 2) {
          //console.log('mismatch '+c+'->'+_NTNEW[c][type]);
          c = _NTNEW[c][type];
        } else if (type === -1) {
          c = '';
          //console.log('delete');
        } else { // we have an insertion (-2)
          let rnum = rtypenum*40 -4; // now ranges form -4 to 4
          if (rnum < 0) {
            // left side
            rnum *= -1;
            c = _NTS[Math.floor(rnum)]+c;
            //console.log('left '+_NTS[Math.floor(rnum)]);
          } else {
            // right side
            c = c + _NTS[Math.floor(rnum)];
            //console.log('right '+_NTS[Math.floor(rnum)]);
          }
        }
      }
    }// done options
    ostr += c;
  }
  let robj =  Object.create(nt);
  robj.set_from_string(ostr);
  return robj;
}

exports.nucleotide_sequence_permute = nucleotide_sequence_permute;
