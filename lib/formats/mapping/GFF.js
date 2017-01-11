"use strict";
const GenericTranscriptome = require('../../mapping.js').GenericTranscriptome;
const GenericMapping = require('../../mapping.js').GenericMapping;
const GFF2Data = require('./GFFBasic.js').GFF2Data;

// A GFF transcript class ... more for the purposes of outputting transcripts contained in a GFF file and maintaining the extra info
class GFFTranscript extends GenericMapping {
  constructor (options) {
    if (! options) options = {};
    if (options.transcript) options.inmap =options.transcript.map;
    super(options);
    // copy all the transcript properties brought in
    for (let i in options.transcript) this[i] = options.transcript[i];
  }
}

class GFFGeneric extends GenericTranscriptome {
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
  add_transcript (tx, options) {
    this._lines = undefined; // we will redefined from transcripts if we are adding them
    if (! options) options = {};
    if (! tx.source) tx.source = options.source;
    if (! tx.score) tx.score = options.score;
    if (! tx.phase) tx.phase = options.phase;
    //let txout = new GFFTranscript({transcript:tx});
    this._transcripts.push(tx);
  }
  [Symbol.iterator]() {
    throw new Error('needs overriden');
  }
}

class GFF2 extends GFFGeneric {
  constructor (options) {
    if (! options) options = {};
    super(options);
    this._lines = undefined;
    if (options.data) {
      this._lines = options.data.replace(/\n$/,'').split(/\n/);
    }
  }
  _set_lines_from_transcriptome () {
    let buffer = [];
    this._lines = [];
    for (let tx of this._transcripts) {
      buffer = tx.get_GFF2_entries()
      for (let b of buffer) {
        this._lines.push(b.toString());
      }
    }
  }
  // The iterator will print the GFF2 file
  [Symbol.iterator]() {
    // Make the iterator of a GFF be the lines
    let index = 0;
    if (! this._lines) this._set_lines_from_transcriptome();  // set lines from transcript
    let lines = this._lines;
    // If lines is set then we dont have any work to do really
    return {
      next: () => {
        let val = index;
        index += 1;
        if (index >= lines.length) return {done:true};
        return {value:lines[val],done:false};
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
