"use strict";
const GenericTranscriptome = require('../../mapping.js').GenericTranscriptome;
const GenericMapping = require('../../mapping.js').GenericMapping;
const GFF2Data = require('./GFFBasic.js').GFF2Data;
const GFF_entry_compare = require('./GFFBasic.js').GFF_entry_compare;

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

class GFFGeneric {
  // Basic parent of GFFs.  Encompases GFF2, GTF and GFF3
  // All GFF files are composed of lines
  // All GFF files may have multiple sequences (stranded or not)
  // All GFF files may have multiple features
  constructor (options) {
    if (! options) options = {};
    // now see if we have any input from options
    this._init();
    if (options.data) {
      this.set_lines(options.data.replace(/\n$/,'').split(/\n/));
    }
    if (options.lines) {
      this.set_lines(options.lines);
    }
  }
  _init () {
    this._lines = [];
    this._sequences = {};
    this._sources = {};
    this._types = {}; // also methods
  }
  set_lines (inlines) {
    // set lines and store the values
    this._lines = inlines;
    for (let i = 0; i < inlines.length; i++) {
      this._store_line(i);
    }
    return;
  }
  get lines () {
    return this._lines;
  }
  get sequences () {
    return Object.keys(this._sequences);
  }
  get sources () {
    return Object.keys(this._sources);
  }
  get types () {
    return Object.keys(this._types);
  }
  get methods () {
    return this.types;
  }
  sort () {
    // sort and then output
    //let output = Object.create(Object.getPrototypeOf(this));
    let output = Object.create(this);
    output = new output.constructor({
      lines:this._lines.map(x=>this.to_gff_entry(x)).sort(GFF_entry_compare).map(x=>x.line)
    });
    //output.set_lines(this._lines);
    return output;
  }
  _store_line (index) {
    // file away the line at index
    if (! this._lines[index]) throw new Error('accesing line out of bounds');
    let ln = this._lines[index];
    // see if its a comment first
    if (/^#/.exec(ln)) return;
    let f = ln.split("\t");
    let sequence = f[0];
    if (! this._sequences[sequence]) {
      this._sequences[sequence] = [];
    }
    this._sequences[sequence].push(index); // add the index to the line for this sequence
    let source = f[1];
    if (! this._sources[source]) {
      this._sources[source] = [];
    }
    this._sources[source].push(index); 
    let type = f[2];
    if (! this._types[type]) {
      this._types[type] = [];
    }
    this._types[type].push(index); 
  }
  get_type (mytype) {
    let o = [];
    for (let i = 0; i < this._types[mytype].length; i++) {
      o.push(this._types[mytype][i]);
    }
    return o.map(x=>this._lines[x]);
  }
  add_line (line, options) {
    this._lines.push(line.replace(/\n$/,''));
    this._store_line(this._lines.length-1);
  }
  to_gff_entry (line) {
    // convert a line to a gff entry
    throw new Error('must be overridden');
  }
  [Symbol.iterator]() {
    // Make the iterator of a GFF be the lines
    let index = 0;
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


class GFF2 extends GFFGeneric {
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
  to_gff_entry (line) {
    // convert a line to a gff entry
    return new GFF2Data(line);
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
