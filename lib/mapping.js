"use strict";
const Bed = require('./range.js').Bed;
const BedArray = require('./range.js').BedArray;
const map_to_gpd_line = require('./formats/mapping/gpd.js').map_to_gpd_line;
const map_to_GFF2 = require('./formats/mapping/gffbasic.js').map_to_GFF2;
const gene_to_GFF3 = require('./formats/mapping/gffbasic.js').gene_to_GFF3;
const SpliceAnalysis = require('./splice.js').SpliceAnalysis;

/**
* This module contains the most general classes for describing how an object is mapped to a sequence.  This would include the very general basis for gpd and bed12 formats etc...
* @namespace mapping
*/

/**
* Only mapping a single exon, requires a direction
* @class
* @memberof mapping
*/
class Exon extends Bed {
  constructor (chr,start,end,direction,options) {
    if (! options) options = {};
    options.direction = direction;
    super(chr,start,end,options);
  }
  copy () {
    return new Exon(this.chr,this.start,this.end,this.direction,{payload:this.payload});
  }
  get threePrimeBase () {
    if (! this.strand) throw new Error('cannot get strand');
    if (this.strand==='+') {
      return new Bed(this.chr,this.end-1,this.end);
    }
    return new Bed(this.chr,this.start,this.start+1);
  }
  get fivePrimeBase () {
    if (! this.strand) throw new Error('cannot get the strand');
    if (this.strand==='+') {
      return new Bed(this.chr,this.start,this.start+1);
    }
    return new Bed(this.chr,this.end-1,this.end);
  }
}

/**
* A generic mapping is like a transcript but does not require direction
* @class
* @memberof mapping
*/
class GenericMapping {
  // A generic mapping object
  constructor (options) {
    // must recieve a map
    if (! options.inmap) throw new Error('You should not be able to call this without map');
    if (options.direction) this._direction = options.direction;
    this._map = options.inmap;
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
    return createNewObjectLike(this,{inmap:o,
                                     name:this.name,
                                     direction:this.direction,
                                     gene_name:this.gene_name});
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
  get strand () {
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
  gpd_line (options) {
    // leave the details to the formats to the GPD package
    if (! options) options = {};
    if (this.gene_name && (! options.gene_name)) options.gene_name = this.gene_name;
    return map_to_gpd_line(this,options);
  }
  get_GFF2_entries (options) {
    if (! options) options = {};
    return map_to_GFF2(this,options);
  }
}

/**
* Transcript is a direction specific mapping
* @class
* @extends GenericMapping
* @memberof mapping
*/
class Transcript extends GenericMapping {
  constructor (options) {
    // Requires inmap (with direction set on the exons)
    // Will not accept introns
    if (! options) throw new Error('requires at least inmap');
    if (options.direction) throw new Error('direction should be set in exons and NOT passed as an option');
    if (! options.inmap) throw new Error(' all mapings need an inmap');
    if (! options.inmap[0]) throw new Error(' inmap needs at least one range');
    if (! options.inmap[0].direction) throw new Error(' inmap needs at least one exon');
    let dir = options.inmap[0].direction;
    // a cannonical transcript has all exons in the same direction
    options.inmap.map(function(x) {
      if (dir !== x.direction) throw new Error('Exons need be same direction in a cannonical transcript');
    });
    super(options);
    this._direction = dir;
    this._gene_name = options.gene_name;
  }
  get fivePrimeExon () {
    if (! this.strand) throw new Error('no direction');
    if (this.strand==='+') return this.exons[0];
    return this.exons[this.exons.length-1];
  }
  get threePrimeExon () {
    if (! this.strand) throw new Error('no direction');
    if (this.strand==='-') return this.exons[0];
    return this.exons[this.exons.length-1];
  }
  get fivePrimeBase () {
    return this.fivePrimeExon.fivePrimeBase;
  }
  get threePrimeBase () {
    return this.threePrimeExon.threePrimeBase;
  }
}

/**
* @class
* @extends GenericMapping
* @memberof mapping
*/
class AlignmentDerivedMapping extends GenericMapping {
  // A type of mapping object produced by the Alignment class
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
}

/**
* @class
* @memberof mapping
*/
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

/**
* A canonical gene is a collection of transcripts at a single locus in a single direction.  This is a specific type of transcriptome.
* @class
* @extends GenericTranscriptome
* @memberof mapping
*/
class Gene extends GenericTranscriptome {
  // A gene consists of multiple transcripts on the same locus
  // with all transcripts going in the same direction
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
  splice_analysis (options) {
    return new SpliceAnalysis(this,options);
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

var createNewObjectLike = function (obj,params) {
  let output = Object.create(obj);
  return new output.constructor(params);
}

exports.Exon = Exon;
exports.GenericMapping = GenericMapping;
exports.Transcript = Transcript;
exports.AlignmentDerivedMapping = AlignmentDerivedMapping;
exports.GenericTranscriptome = GenericTranscriptome;
exports.Gene = Gene;
