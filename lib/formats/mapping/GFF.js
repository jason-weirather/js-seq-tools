"use strict";
const GenericTranscriptome = require('../../mapping.js').GenericTranscriptome;
const GenericMapping = require('../../mapping.js').GenericMapping;
const GFF2Data = require('./GFFBasic.js').GFF2Data;
const GFF_entry_compare = require('./GFFBasic.js').GFF_entry_compare;

// A GFF transcript class ... more for the purposes of outputting transcripts contained in a GFF file and maintaining the extra info
class GFFTranscript extends GenericMapping {
  constructor (options) {
    if (! options) options = {};
    super(options);
    this.gene_name = options.gene_name;
    // copy all the transcript properties brought in
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
    if (options.filter_sequence) this.filter_sequence = options.filter_sequence;
    if (options.gff_entries) {
      for (let g of options.gff_entries) {
        this.add_line(g.line);
      }
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
    for (let line of inlines) {
      this.add_line(line);
      //this._lines = inlines;
      //for (let i = 0; i < inlines.length; i++) {
      //  this._store_line(i);
      //}
    }
    return;
  }
  get lines () {
    return this._lines.map(x=>x.line);
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
      lines:this._lines.sort(GFF_entry_compare).map(x=>x.line)
    });
    //output.set_lines(this._lines);
    return output;
  }
  _store_line (index) {
    // file away the line at index
    if (! this._lines[index]) throw new Error('accesing line out of bounds');
    let ln = this._lines[index];
    // see if its a comment first
    if (/^#/.exec(ln.line)) return; // its a comment
    //let f = ln.line.split("\t");
    let sequence = ln.sequence;
    if (! this._sequences[sequence]) {
      this._sequences[sequence] = [];
    }
    this._sequences[sequence].push(index); // add the index to the line for this sequence
    let source = ln.source;
    if (! this._sources[source]) {
      this._sources[source] = [];
    }
    this._sources[source].push(index); 
    let type = ln.type;
    if (! this._types[type]) {
      this._types[type] = [];
    }
    this._types[type].push(index); 
  }
  query_attribute (options) {
    // Returns a new GFF object that is a subset of this
    let o = [];
    if (options.key) { // if key is set limit lines with that attribute
      for(let i = 0; i < this._lines.length; i++) {
        let v = this._lines[i].attributes.query({key:options.key});
        if (v.length===0) continue;
        if (options.value) {
          v = v.filter(x=>x.value===options.value);
        }
        if (v.length===0) continue;
        o.push(this._lines[i]);
      }
    } else if (options.value) { // no key just value
      for (let i = 0; i < this._lines.length; i++) {
        let v = this._lines[i].attributes.query({value:options.value});
        if (v.length===0) continue;
        o.push(this._lines[i]);
      }
    }
    //######o; // nothing to query
    let output = Object.create(this);  // make a new gff file
    output = new output.constructor({gff_entries:o});
    return output;
  }
  query_type (mytype) {
    let o = [];
    for (let i = 0; i < this._types[mytype].length; i++) {
      o.push(this._types[mytype][i]);
    }
    return o.map(x=>this._lines[x]);
    let output = Object.create(this);  // make a new gff file
    output = new output.constructor({gff_entries:o});
    return output;
  }
  add_line (line, options) {
    let entry = this.to_gff_entry(line.replace(/\n$/,''));
    if (this.filter_sequence) {
      if (this.filter_sequence !== entry.sequence) return;
    }
    this._lines.push(entry);
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
  // get transcript mappings
  get_transcripts (options) {
    let outputs = [];
    if (! options) options = {};
    let t = {};
    if (options.type) { t[options.type] = 1; }
    else if (options.types) { for (let x in options.types) { t[x] = 1; } }
    else {
      // if no basic type set try to gather up all these
      if (this._types['transcript']) t['transcript'] = 1;
      if (this._types['mRNA']) t['mRNA'] = 1;
      if (this._types['mrna']) t['mrna'] = 1;
    }
    let transcripts = {};
    for (let type in t) {
      let gtf = this.query_type(type);
      for (let g of gtf) {
        let txs = g.attributes.query({key:'transcript_id'}).map(x=>x.value);
        let genes = g.attributes.query({key:'gene_id'}).map(x=>x.value);
        //console.log(txs);
        //console.log(genes);
        if (! txs[0] || ! genes[0]) throw new Error('unexpected layout of GTF');
        if (! transcripts[txs[0]]) { // not set yet
          transcripts[txs[0]] = {};
          transcripts[txs[0]]['gene'] = genes[0];
          transcripts[txs[0]]['exons'] = [];
        } else {
          throw new Error('multiple definitions for transcript');
        }
      }
    }
    for (let g of this.query_type('exon')) {
      let ex = g.attributes.query({key:'exon_number'})[0].value;
      let tx = g.attributes.query({key:'transcript_id'})[0].value;
      let gn = g.attributes.query({key:'gene_id'})[0].value;
      let strand =g.strand;
      if (!ex || !tx || !gn) throw new Error('exon not fully annotated');
      if (! transcripts[tx]) throw new Error('unaccounted for exon transcript');
      if (transcripts[tx]['gene'] !== gn) continue;
      transcripts[tx]['exons'].push([Math.floor(ex),g.bed]);
      transcripts[tx]['strand'] = strand;
    }
    for (let tx of Object.keys(transcripts)) {
      // now we can make transcripts
      let gene = transcripts[tx]['gene'];
      let strand = transcripts[tx]['strand'];
      let exons = transcripts[tx]['exons'].sort(function(x,y){
        if (x[0] < y[0]) return -1;
        if (x[0] > y[0]) return 1;
        if (x[0] === y[0]) throw new Error('multiple exons of same number');
        return 0;
      }).map(x=>x[1]);
      // set up the transcript
      let output = new GFFTranscript({inmap:exons,name:tx,gene:gene,direction:strand});
      outputs.push(output);
    }
    return outputs;
  }
}

class GTF extends GFF2 {
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
}

class GTFTranscriptome extends GTF {
  // This will try to strip down the GTF to just simply a transcriptome
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
  add_line (line) {
    let g = this.to_gff_entry(line)
    if (this.filter_sequence) {
      if (this.filter_sequence !== g.sequence)  return;
    }
    g = g.strip_to_transcriptome();
    if (! g) return;
    // we need to strip down line
    GTF.prototype.add_line.call(this,g.line); // After filter
  }
  
}

exports.GFF2 = GFF2;
exports.GTF = GTF;
exports.GTFTranscriptome = GTFTranscriptome;
