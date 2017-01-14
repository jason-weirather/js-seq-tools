"use strict";
//const GenericTranscriptome = require('../../mapping.js').GenericTranscriptome;
//const GenericMapping = require('../../mapping.js').GenericMapping;

class GFFDataGeneric {
  // A dataline from a GFF file
  constructor (inline) {
    this._line = inline;
    this._fields = undefined;
  }
  is_comment () {
    if (! /^#/.exec(this._line)) return false;
    //console.log('is comment '+this._line);
    return true;
  }
  get entries () {
    if (this._fields) return this._fields;
    this._fields = this._line.replace(/\s*\n$/,'').split("\t");
    return this._fields;
  }
  get line () {
    return this._line;
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
  toString () {
    return this._line;
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
  // A dataline from a GFF2 file
  constructor (inline) {
    super(inline);
  }
  get attributes () {
    //console.log('geting attributes');
    if (! this.entries[8]) return undefined;
    if (this.entries[8] === '') return undefined;
    return new GFF2Attributes({inline:this.entries[8]});
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
  get entries () {
    throw new Error('needs to be overriden by child');
  }
  [Symbol.iterator]() {
    // Allow iterate over the present attributes
    let index = 0;
    return {
      next: ()=> {
        let value = index;
        if (value >= this.entries.length) return {done:true};
        index += 1;
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
  l1 += "mRNA\t";
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

exports.map_to_GFF2 = map_to_GFF2;
exports.GFF2Data = GFF2Data;
exports.GFF_entry_compare = GFF_entry_compare;
