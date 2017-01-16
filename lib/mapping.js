"use strict";
const Bed = require('./range.js').Bed;
const BedArray = require('./range.js').BedArray;
const map_to_gpd_line = require('./formats/mapping/GPD.js').map_to_gpd_line;
const map_to_GFF2 = require('./formats/mapping/GFFBasic.js').map_to_GFF2;
const gene_to_GFF3 = require('./formats/mapping/GFFBasic.js').gene_to_GFF3;

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
  get bed () {
    return new Bed(this.refName,this.start,this.end);
  }
  get start () {
    return this.range.start;
  }
  get end () {
    return this.range.end;
  }
  get range () {
    if (this._range) return this._range;
    this._range = new Bed(this._map[0].chr,
                          this._map[0].start,
                          this._map[this._map.length-1].end);
    return this._range;
  }
  get size () {
    return (new BedArray(this.exons)).size;
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
  //get map () {
  //  return this._map;
  //}
  //convert any mapping into GTF/GFF2 lines
  get_GFF2_entries (options) {
    if (! options) options = {};
    return map_to_GFF2(this,options);
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
    if (options.transcripts) this._transcripts = options.transcripts;
    else this._transcripts = []; // the backbone of this class.  holds transcripts
  }
  add_transcript (inmapping) {
    this._transcripts.push(inmapping);
  }
  get transcripts () {
    return this._transcripts;
  }
  get exons () {
    // return the unique exons
    let bedarray = [];
    for (let t of this.transcripts) {
      for (let e of t.exons) {
        bedarray.push(e);
      }
    }
    return new BedArray(bedarray);
  }
  get unique_exons () {
    // return the unique exons
    return (this.exons).sort().unique();
  }
  get exonic () {
    // return the covered sequence
    return this.exons.merged;
  }
}

class Gene extends GenericTranscriptome {
  // A gene consists of multiple transcripts on the same locus
  // with all transcripts going in the same direction
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
  get direction () {
    if (this._transcripts.length===0) return undefined;
    return this._transcripts[0].direction;
  }
  get strand () {
    return this.direction;
  }
  get bed () {
    if (this._transcripts.length===0) return undefined;
    return new Bed(this._transcripts[0].refName,
                   Math.min.apply(Math,this._transcripts.map(x=>x.start)),
                   Math.max.apply(Math,this._transcripts.map(x=>x.end)));
  }
  get refName () {
    return this._transcripts[0].refName;
  }
  get_GFF3_entries (options) {
    if (! options) options = {};
    return gene_to_GFF3(this,options);
  }
  get gene_name () {
    if (this._gene_name) return this._gene_name;
    if (this._transcripts[0].gene_name) {
      this._gene_name = this._transcripts[0].gene_name;
      return this._gene_name;
    }
    return undefined;
  }
  toString () {
    // make a special report for a gene
    let bed = this.bed;
    let o = '';
    o += "GENE REPORT\n";
    o += 'Gene: '+this.gene_name+"\n";
    o += 'Range: '+bed.chr+':'+(bed.start+1)+'-'+bed.end+"\n";
    o += 'Strand: '+this.strand+"\n";
    o += 'Transcript Count: '+this.transcripts.length+"\n";
    o += 'Total Exons: '+this.exons.entries.length+"\n";
    o += 'Unique Exons: '+this.exons.unique().entries.length+"\n";
    o += 'Merged exonic regions: '+this.exons.merged.entries.length+"\n";
    o += 'Merged exonic region size: '+this.exons.merged.size+" bp\n";
    o += 'Gene size: '+this.bed.length+' bp'+"\n";
    for (let t of this.transcripts) {
      o+='  '+t.size+" bp\n";
    }
    return o;
  }
}

exports.Gene = Gene;
exports.AlignmentDerivedMapping = AlignmentDerivedMapping;
exports.GenericMapping = GenericMapping;
exports.GenericTranscriptome = GenericTranscriptome;
