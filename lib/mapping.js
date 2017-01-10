"use strict";
const Bed = require('./range.js').Bed;
const map_to_gpd_line = require('./formats/mapping/GPD.js').map_to_gpd_line;

class GenericMapping {
  // A generic mapping object
  constructor (options) {
    // must recieve a map
    if (! options.inmap) throw new Error('You should not be able to call this without map');
    this._map = options.inmap;
    if (options.direction) this._direction = options.direction;
    if (options.name) this._name = options.name;
    this._range = undefined; //cache
  }
  smooth (min_intron) {
    // Return a new mapping object with idels removed
    var o = [];
    var buf = this._map[0].copy(); // do copies so you dont modify other objects
    for (let i=1; i < this._map.length; i++) {
      let cur = this._map[i].copy();
      if (cur.distance(buf) <= min_intron) { // combine
        buf.end = cur.end;
      } else {
       o.push(buf)
       buf = cur 
      }
    }
    o.push(buf);
    return new GenericMapping({inmap:o,name:this.name,direction:this.direction});
  }
  get name () {
    return this._name;
  }
  get transcript_name () {
    return this._name; // by default assume name is a transcript name
  }
  get refName () {
    return this._map[0].chr;
  }
  get direction () {
    return this._direction;
  }
  get length () {
    // sum up the lengths of the beds
    return this._map.map(x=>x.length).reduce((pre,cur) => pre+cur,0);
  }
  get exonCount () {
    return this._map.length;
  }
  get range () {
    if (this._range) return this._range;
    this._range = new Bed(this._map[0].chr,this._map[0].start,this._map[this._map.length-1].end);
    return this._range;
  }
  gpd_line (options) {
    // leave the details to the formats to the GPD package
    // use gene_name if anything has set it
    if (! options) options = {};
    if (this.gene_name && (! options.gene_name)) options.gene_name = this.gene_name;
    return map_to_gpd_line(this,options);
  }
  get exons () {
    return this._map;
  }
  overlaps (inmap,options) {
    if (! options) options = {};
    if (options.direction && inmap.direction && this.direction) {
      if (this.direction !== inmap.direction) return false;
    }
    for (let i = 0; i < inmap.exons.length; i++) {
      for (let j = 0; j < this.exons.length; j++) {
        if (inmap.exons[i].overlaps(this.exons[j])) return true;
      }
    }
    return false;
  }
  //convert any mapping into GTF/GFF2 lines
  get_GFF2_lines (options) {
    if (! options) options = {};
    let o = [];
    let l1 = this.refName+"\t"+options.source+"\tmRNA\t";
    l1 += (this.range.start+1)+"\t";
    l1 += this.range.end+"\t";
    // check here, and on the transcript for score
    if (options.score !== undefined) l1 += options.score+"\t";
    else if (this.score !== undefined) l1 += this.score+"\t";
    else l1 += ".\t";
    if (this.direction) l1 += this.direction+"\t";
    else l1 += ".\t";
    // check for phase
    if (options.phase !== undefined) l1 += options.phase+"\t";
    else if (this.phase !== undefined) l1 += this.phase+"\t";
    else l1 += ".\t";
    let group =  'gene_id "'+this.gene_name+'"; transcript_id "'+this.transcript_name+'";';
    l1 += group;
    // Got the first line
    o.push(l1);
    // Now do exons
    for (let i = 0; i < this.exonCount; i++) {
      let ln = this.refName + "\t" + options.source + "\texon\t";
      ln += (this.exons[i].start+1)+"\t";
      ln += (this.exons[i].end)+"\t";
      if (this.exons[i].score) ln += this.exons[i].score+"\t";
      else ln += ".\t";
      if (this.direction) ln += this.direction+"\t";
      else ln += ".\t";
      ln += group+' exon_number "'+(i+1)+'";';
      o.push(ln);
    }
    return o;
  }
}

class AlignmentDerivedMapping extends GenericMapping {
  // A type of mapping object produced by the Alignment class
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
}

class GenericTranscriptome {
  constructor (options) {
    if (! options) options = {};
    this._transcripts = []; // the backbone of this class.  holds transcripts
  }
  add_transcript (inmapping) {
    this._transcripts.push(inmapping);
  }
}

exports.AlignmentDerivedMapping = AlignmentDerivedMapping;
exports.GenericMapping = GenericMapping;
exports.GenericTranscriptome = GenericTranscriptome;
