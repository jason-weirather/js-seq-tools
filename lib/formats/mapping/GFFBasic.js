"use strict";
//const GenericTranscriptome = require('../../mapping.js').GenericTranscriptome;
//const GenericMapping = require('../../mapping.js').GenericMapping;
const Bed = require('../../range.js').Bed;

class GFFDataGeneric {
  // A dataline from a GFF file
  constructor (inline) {
    //this._line = inline;
    // To save space lets only save the split of this
    this._fields = inline.replace(/\s*\n$/,'').split("\t");
  }
  is_comment () {
    if (! /^#/.exec(this._fields[0])) return false;
    //console.log('is comment '+this._line);
    return true;
  }
  get bed () {
    if (! this.sequence) return;
    return new Bed(this.sequence,this.start-1,this.end);
  }
  get entries () {
    //if (this._fields) return this._fields;
    //this._fields = this._line.replace(/\s*\n$/,'').split("\t");
    return this._fields;
    //return this._line.replace(/\s*\n$/,'').split("\t");
  }
  get line () {
    return this._fields.join("\t");
    //return this._line;
  }
  get seqid () { 
    return this.entries[0]; 
  }
  get sequence () {
    return this.seqid;
  }
  get source () { 
    if (this.entries[1] === '.') return undefined;
    return this.entries[1]; 
  }
  get type () {
    return this.entries[2];
  }
  get method () {
    return this.type;
  }
  get start () {
    return Math.floor(this.entries[3]);
  }
  get end () {
    return Math.floor(this.entries[4]);
  }
  get score () {
    if (this.entries[5] === '.') return undefined;
    return parseFloat(this.entries[5]);
  }
  get strand () {
    if (this.entries[6] === '.') return undefined;
    return this.entries[6];
  }
  get phase () {
    if (this.entries[7] === '.') return undefined;
    return Math.floor(this.entries[7]);
  }
  get attributes () {
    throw new Error('this needs to be overriden by child');
  }
  strip_to_transcriptome () {
    throw new Error('this needs to be overriden by child');
  }
  toString () {
    return this.line;
  }
}

var GFF_entry_compare = function (x,y) {
  //if (! x) return 0;
  //if (! y) return 0;
  if (x.sequence < y.sequence) return -1;
  if (x.sequence > y.sequence) return 1;
  if (x.start < y.start) return -1;
  if (x.start > y.start) return 1;
  if (x.end < y.end) return -1;
  if (x.end > y.end) return 1;
  return 0;
}

class GFF2Data extends GFFDataGeneric {
  constructor (inline) {
    super(inline);
  }
  get attributes () {
    if (! this.entries[8]) return undefined;
    if (this.entries[8] === '') return undefined;
    return new GFF2Attributes({inline:this.entries[8]});
  }
  strip_to_transcriptome () {
    //console.log('stripping');
    if (this.type !== 'exon' && this.type !== 'transcript' && this.type !== 'mRNA' && this.type !== 'mrna') return undefined;
    let gene_ids = this.attributes.query({key:'gene_id'});
    let transcript_ids = this.attributes.query({key:'transcript_id'});
    let exon_numbers = this.attributes.query({key:'exon_number'});
    //console.log(exon_numbers);
    let f = this.toString().split("\t");
    // now we can replace the f[8]
    let as = [];
    for (let x of gene_ids) as.push(x);
    for (let x of transcript_ids) as.push(x);
    for (let x of exon_numbers) as.push(x);
    f[8] = as.map(x=>x.toString()).join('; ');
    return new GFF2Data(f.join("\t"));
  }
}

class GFF3Data extends GFFDataGeneric {
  constructor(inline) {
    super(inline);
  }
}

class GFFAttributesGeneric {
  constructor (options) {
    if (! options) options = {};
    if (options.inline) {
      this._line = options.inline;
    }
    this._attributes = undefined;
  }
  query (options) {
    let o = [];
    if (options.key) {
      o = this.entries.filter(x=>options.key===x.key);
      if (options.value) return o.filter(x=>options.value===x.value);
      return o;
    }
    if (options.value) { // only on value
      return this.entries.filter(x=>options.value===x.value);
    }
    return o;
  }
  get entries () {
    throw new Error('needs to be overriden by child');
  }
  [Symbol.iterator]() {
    // Allow iterate over the present attributes
    let index = 0;
    return {
      next: ()=> {
        let value = index;
        index += 1;
        if (value >= this.entries.length) return {done:true};
        return {value:this.entries[value],done:false};
      }
    }
  }
  toString () {
    // should work okay for all formats
    return this.entries.join('; ');
  }
}

class GFF2Attributes extends GFFAttributesGeneric {
  // GFF2 format atributes are a little different in how entries are parsed
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
  get entries () {
    if (this._attributes) return this._attributes;
    this._attributes = [];
    // Has not been set yet
    let entries = this._line.replace(/\n$/,'').split(/\s*;\s*/);
    for (let x of entries) {
      let m0 = /^\s*$/.exec(x);
      if (m0) continue; // skip ahead if theres nothing
      this._attributes.push(new GFF2Attribute({instring:x}));
    }
    return this._attributes;
  }
}

class GFFAttributeGeneric {
  // a single attribute
  constructor (key,value) {
    this._key = key;
    this._value = value;
  }
  get key () {
    return this._key;
  }
  get value () {
    return this._value;
  }
  toString () {
    throw new Error('child overrides this');
  }
}

class GFF2Attribute extends GFFAttributeGeneric {
  // a single attribute
  constructor (options) {
    if (! options) options = {};
    if (options.instring) {
      let m1 = /(\S+)\s+"(.*)"[^"]*$/.exec(options.instring);
      let m2 = /(\S+)\s+(.*)$/.exec(options.instring);
      let k = undefined;
      let v = undefined;
      if (m1) {
        k = m1[1];
        v = m1[2];
      } else if (m2) {
        k = m2[1];
        v = m2[2];
      } else {
        throw new Error('unparsed attribute '+x);
      }
      super(k,v);
    }
    else if (options.key !== undefined && options.value !== undefined) super(options.key,options.value);
    else throw new Error('need to give attribute either instring, or key and value');
  }
  toString () {
    return this._key+' "'+this._value+'"';
  }
}

var map_to_GFF2 = function (map,options) {
  if (! options) options = {};
  let o = [];
  let l1 = map.refName+"\t";
  if (options.source !== undefined) l1+= options.source+"\t";
  else if(map.source !== undefined) l1 += map.source+"\t"
  else l1 += ".\t";
  l1 += "transcript\t";
  l1 += (map.range.start+1)+"\t";
  l1 += map.range.end+"\t";
  // check here, and on the transcript for score
  if (options.score !== undefined) l1 += options.score+"\t";
  else if (map.score !== undefined) l1 += map.score+"\t";
  else l1 += ".\t";
  if (map.direction) l1 += map.direction+"\t";
  else l1 += ".\t";
  // check for phase
  if (options.phase !== undefined) l1 += options.phase+"\t";
  else if (map.phase !== undefined) l1 += map.phase+"\t";
  else l1 += ".\t";
  let group =  'gene_id "'+map.gene_name+'"; transcript_id "'+map.transcript_name+'";';
  l1 += group;
  // Got the first line
  o.push(new GFF2Data(l1));
  // Now do exons
  for (let i = 0; i < map.exonCount; i++) {
    let ln = map.refName + "\t";
    if (options.source !== undefined) ln += options.source+"\t";
    else if(map.source !== undefined) ln += map.source+"\t"
    else ln += ".\t";
    ln += "exon\t";
    ln += (map.exons[i].start+1)+"\t";
    ln += (map.exons[i].end)+"\t";
    if (map.exons[i].score) ln += map.exons[i].score+"\t";
    else ln += ".\t";
    if (map.direction) ln += map.direction+"\t";
    else ln += ".\t";
    if (map.phase) ln += map.phase+"\t";
    else ln += '.'+"\t";
    ln += group+' exon_number "'+(i+1)+'"';
    o.push(new GFF2Data(ln));
  }
  return o;
}
var transcript_to_GFF3 = function (tx,options) {
  if (! options) options = {};
  let o = [];
  let l1 = tx.refName+"\t";
  if (options.source !== undefined) l1+= options.source+"\t";
  else if(tx.source !== undefined) l1 += tx.source+"\t"
  else l1 += ".\t";
  l1 += "transcript\t";
  l1 += (tx.start+1)+"\t";
  l1 += tx.end+"\t";
  // check here, and on the transcript for score
  if (options.score !== undefined) l1 += options.score+"\t";
  else if (tx.score !== undefined) l1 += tx.score+"\t";
  else l1 += ".\t";
  if (tx.direction) l1 += tx.direction+"\t";
  else l1 += ".\t";
  // check for phase
  if (options.phase !== undefined) l1 += options.phase+"\t";
  else if (tx.phase !== undefined) l1 += tx.phase+"\t";
  else l1 += ".\t";
  let group =  'gene_id "'+tx.gene_name+'"; transcript_id "'+tx.transcript_name+'";';
  l1 += group;
  // Got the first line
  o.push(new GFF3Data(l1));
  // Now do exons
  for (let i = 0; i < tx.exons.length; i++) {
    let ln = tx.refName + "\t";
    //console.log('YOLO '+ln);
    if (options.source !== undefined) ln += options.source+"\t";
    else if(tx.source !== undefined) ln += tx.source+"\t"
    else ln += ".\t";
    ln += "exon\t";
    ln += (tx.exons[i].start+1)+"\t";
    ln += (tx.exons[i].end)+"\t";
    if (tx.exons[i].score) ln += tx.exons[i].score+"\t";
    else ln += ".\t";
    if (tx.direction) ln += tx.direction+"\t";
    else ln += ".\t";
    if (tx.phase) ln += tx.phase+"\t";
    else ln += '.'+"\t";
    ln += group+' exon_number "'+(i+1)+'"';
    o.push(new GFF3Data(ln));
  }
  return o;
}

var gene_to_GFF3 = function (gene,options) {
  if (! options) options = {};
  let o = [];
  if (gene.transcripts.length === 0) return o;
  let l1 = gene.refName+"\t";
  if (options.source !== undefined) l1+= options.source+"\t";
  else if(gene.source !== undefined) l1 += gene.source+"\t"
  else l1 += ".\t";
  l1 += "gene\t";
  l1 += (gene.bed.start+1)+"\t";
  l1 += gene.bed.end+"\t";
  // check here, and on the transcript for score
  if (options.score !== undefined) l1 += options.score+"\t";
  else if (gene.score !== undefined) l1 += gene.score+"\t";
  else l1 += ".\t";
  if (gene.direction) l1 += gene.direction+"\t";
  else l1 += ".\t";
  // check for phase
  if (options.phase !== undefined) l1 += options.phase+"\t";
  else if (gene.phase !== undefined) l1 += gene.phase+"\t";
  else l1 += ".\t";
  let group =  'gene_id "'+gene.gene_name+'"; transcript_id "'+gene.transcript_name+'";';
  l1 += group;
  // Got the first line
  o.push(new GFF3Data(l1));
  // Now do transcripts
  for (let t of gene.transcripts) {
    for (let tg of transcript_to_GFF3(t,options)) {
      o.push(tg);
    }
  }
  return o;
}

exports.gene_to_GFF3 = gene_to_GFF3;
exports.map_to_GFF2 = map_to_GFF2;
exports.GFF2Data = GFF2Data;
exports.GFF_entry_compare = GFF_entry_compare;
