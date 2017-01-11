"use strict";
const GenericTranscriptome = require('../../mapping.js').GenericTranscriptome;
const GenericMapping = require('../../mapping.js').GenericMapping;

// A GFF transcript class ... more for the purposes of outputting transcripts contained in a GFF file and maintaining the extra info
class GFFTranscript extends GenericMapping {
  constructor (options) {
    if (! options) options = {};
    super(options);
    this.source = options.source;
    this.score = options.score;
    this.phase = options.phase;
  }
}

class GFF2 extends GenericTranscriptome {
  constructor (options) {
    if (! options) options = {};
    super(options);
    this.source = options.source;
  }
  // The iterator will print the GFF2 file
  [Symbol.iterator]() {
    // Make the iterator of a GFF be the lines
    let index = 0;
    let buffer = [];
    let source = this.source;
    return {
      next: () => {
        let res = undefined;
        // try to get another value
        if (buffer.length > 0) {
        } else if (index < this._transcripts.length) {
          buffer = this._transcripts[index].get_GFF2_entries({source:source})
          index += 1;
        } else return {done:true};
        res = buffer.shift();
        return {value:res,done:false};
      }
    }
  }
}

class GTF extends GFF2 {
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
}


exports.GFF2 = GFF2;
exports.GTF = GTF;
