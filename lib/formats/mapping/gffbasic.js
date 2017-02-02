"use strict";
//const GenericTranscriptome = require('../../mapping.js').GenericTranscriptome;
//const GenericMapping = require('../../mapping.js').GenericMapping;
const Bed = require('../../range.js').Bed;

/**
* these classes define the basic underlying classes for dealing with GFF file formats which differ but have enough similarities to call for a more generic class.  If we do a better job arranging things these could probably be combined with the GFF proper module. for now they are kind of generic helpers.
* @namespace gffbasic
* @memberof formats.mapping
*/


/**
* The generic class for defining a GFF data line
* @class
* @param {String} inline - one data line of a gff file
* @memberof formats.mapping.gffbasic
*/
class GFFDataGeneric {
  // A dataline from a GFF file
  constructor (inline) {
    //this._line = inline;
    // To save space lets only save the split of this
    this._fields = inline.replace(/\s*\n$/,'').split("\t");
  }
  /**
  * Check if the line is actually a comment, where the line starts with #
  * @returns {bool} is_comment
  * @memberof formats.mapping.gffbasic.GFFDataGeneric
  */
  is_comment () {
    if (! /^#/.exec(this._fields[0])) return false;
    return true;
  }
  /**
  * getter Get the bed object for this line
  * @instance
  * @readonly
  * @returns {Bed} bed range
  * @memberof formats.mapping.gffbasic.GFFDataGeneric
  */
  get bed () {
    if (! this.sequence) return;
    return new Bed(this.sequence,this.start-1,this.end);
  }
  /**
  * getter Gets all the fields in array form
  * @instance
  * @readonly
  * @returns {Array} line fields
  * @memberof formats.mapping.gffbasic.GFFDataGeneric
  */
  get entries () {
    return this._fields;
  }
  /**
  * getter Puts the line back together
  * @instance
  * @readonly
  * @returns {String} line 
  * @memberof formats.mapping.gffbasic.GFFDataGeneric
  */
  get line () {
    return this._fields.join("\t");
  }
  /**
  * getter for the chromosome, same as the chromosome or reference name
  * @instance
  * @readonly
  * @returns {String} chromosome
  * @memberof formats.mapping.gffbasic.GFFDataGeneric
  */
  get seqid () { 
    return this.entries[0]; 
  }
  /**
  * getter for the sequence is the same as the seqid its the reference chromosome
  * @instance
  * @readonly
  * @returns {String} chromosome
  * @memberof formats.mapping.gffbasic.GFFDataGeneric
  */
  get sequence () {
    return this.seqid;
  }
  /**
  * getter for the source of this annotation
  * @instance
  * @readonly
  * @returns {String} source
  * @memberof formats.mapping.gffbasic.GFFDataGeneric
  */
  get source () { 
    if (this.entries[1] === '.') return undefined;
    return this.entries[1]; 
  }
  /**
  * getter for the feature type
  * @instance
  * @readonly
  * @returns {String} type
  * @memberof formats.mapping.gffbasic.GFFDataGeneric
  */
  get type () {
    return this.entries[2];
  }
  /**
  * getter for the feature method is the same as type GFF2 and GFF3 are use differnet words for this
  * @instance
  * @readonly
  * @returns {String} type
  * @memberof formats.mapping.gffbasic.GFFDataGeneric
  */
  get method () {
    return this.type;
  }
  /**
  * getter for the 1-indexed start coordinate, this differs from the start coordinate for BED and GPD but is like the POS of SAM
  * @instance
  * @readonly
  * @returns {Number} start
  * @memberof formats.mapping.gffbasic.GFFDataGeneric
  */
  get start () {
    return Math.floor(this.entries[3]);
  }
  /**
  * getter for the 1-indexed end coordinate
  * @instance
  * @readonly
  * @returns {Number} end
  * @memberof formats.mapping.gffbasic.GFFDataGeneric
  */
  get end () {
    return Math.floor(this.entries[4]);
  }
  /**
  * getter for the score field -outputs a numerical value for the score
  * @instance
  * @readonly
  * @returns {Number} score
  * @memberof formats.mapping.gffbasic.GFFDataGeneric
  */
  get score () {
    if (this.entries[5] === '.') return undefined;
    return parseFloat(this.entries[5]);
  }
  /**
  * getter for the strand or direction is +/-
  * @instance
  * @readonly
  * @returns {char} strand - can me + or -
  * @memberof formats.mapping.gffbasic.GFFDataGeneric
  */
  get strand () {
    if (this.entries[6] === '.') return undefined;
    return this.entries[6];
  }
  /**
  * getter for the number of bases that should be removed to reach the next codon when relevant
  * @instance
  * @readonly
  * @returns {Number} phase - is 0 1  or 2, or undefined if not applicable 
  * @memberof formats.mapping.gffbasic.GFFDataGeneric
  */
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

/**
* Compare two GFF entries for their order like cmp function
*
* -1 x is < y, 0 they are the same, 1 x > y
*
* @param {GFFData} x - one data line of a gff file
* @param {GFFData} y - one data line of a gff file
* @memberof formats.mapping.gffbasic
*/
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

/**
* The class to describe data line in GFF2
* @class
* @extends GFFDataGeneric
* @param {String} inline - one data line of a gff file
* @memberof formats.mapping.gffbasic
*/
class GFF2Data extends GFFDataGeneric {
  constructor (inline) {
    super(inline);
  }
  /**
  * getter for the attributes. will return an object for the attributes that facilitates accessing the data
  * @instance
  * @readonly
  * @returns {GFF2Attributes} attributes - return attirbutes specific to GFF2
  * @memberof formats.mapping.gffbasic.GFF2Data
  */
  get attributes () {
    if (! this.entries[8]) return undefined;
    if (this.entries[8] === '') return undefined;
    return new GFF2Attributes({inline:this.entries[8]});
  }
  /**
  * break some down to only trasncript related features.
  *
  * This one may have some issues because its not apparent how it plugs in yet.
  * It seems like the attributes fields get cleared of everything but hte transcirptome info
  *
  * @instance
  * @returns {GFF2Data} attributes - return attirbutes specific to GFF2
  * @memberof formats.mapping.gffbasic.GFF2Data
  */
  strip_to_transcriptome () {
    if (this.type !== 'exon' && this.type !== 'transcript' && this.type !== 'mRNA' && this.type !== 'mrna') return undefined;
    let gene_ids = this.attributes.query({key:'gene_id'});
    let transcript_ids = this.attributes.query({key:'transcript_id'});
    let exon_numbers = this.attributes.query({key:'exon_number'});
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

/**
* The class to describe data line in GFF3
* @class
* @extends GFFDataGeneric
* @param {String} inline - one data line of a gff file
* @memberof formats.mapping.gffbasic
*/
class GFF3Data extends GFFDataGeneric {
  constructor (inline) {
    super(inline);
  }
  /**
  * getter for the attributes. will return an object for the attributes that facilitates accessing the data
  * @instance
  * @readonly
  * @returns {GFF2Attributes} attributes - return attirbutes specific to GFF2
  * @memberof formats.mapping.gffbasic.GFF2Data
  */
  get attributes () {
    if (! this.entries[8]) return undefined;
    if (this.entries[8] === '') return undefined;
    return new GFF3Attributes({inline:this.entries[8]});
  }
  /**
  * break some down to only trasncript related features.
  *
  * This one may have some issues because its not apparent how it plugs in yet.
  * It seems like the attributes fields get cleared of everything but hte transcirptome info
  *
  * @instance
  * @returns {GFF23ata} attributes - return attirbutes specific to GFF2
  * @memberof formats.mapping.gffbasic.GFF3Data
  */
  strip_to_transcriptome () {
    if (this.type !== 'exon' && this.type !== 'transcript' && this.type !== 'mRNA' && this.type !== 'mrna') return undefined;
    let gene_ids = this.attributes.query({key:'gene_id'});
    let transcript_ids = this.attributes.query({key:'transcript_id'});
    let exon_numbers = this.attributes.query({key:'exon_number'});
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

/**
* The class to describe a generic set of attributes of a GFF entry
* @class
* @param {Object} options
* @param {String} options.inline - just the remainder of the line with the data
* @memberof formats.mapping.gffbasic
*/
class GFFAttributesGeneric {
  constructor (options) {
    if (! options) options = {};
    if (options.inline) {
      this._line = options.inline;
    }
    this._attributes = undefined;
  }
  /**
  * query the attribute based on a key
  * @instance
  * @readonly
  * @param {Object} options
  * @param {String} options.key - query the attribute with a key
  * @returns {Array} return the values identified by a key
  * @memberof formats.mapping.gffbasic.GFFAttributesGeneric
  */
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

/**
* The class specifically for GFF3 attributes
* @class
* @extends GFFAttributesGeneric
* @param {Object} options
* @param {String} options.inline - handled by parent
* @memberof formats.mapping.gffbasic
*/
class GFF3Attributes extends GFFAttributesGeneric {
  // GFF3 format atributes are a little different in how entries are parsed
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
  /**
  * get the distinct entries from GFF3 attributes
  * @instance
  * @readonly
  * @returns {Array} entries - the array of GFF3Attribute objects
  * @memberof formats.mapping.gffbasic.GFF3Attributes
  */
  get entries () {
    if (this._attributes) return this._attributes;
    this._attributes = [];
    // Has not been set yet
    let entries = this._line.replace(/\n$/,'').split(/\s*;\s*/);
    for (let x of entries) {
      let m0 = /^\s*$/.exec(x);
      if (m0) continue; // skip ahead if theres nothing
      this._attributes.push(new GFF3Attribute({instring:x}));
    }
    return this._attributes;
  }
}

/**
* The class specifically for GFF2 attributes
* @class
* @extends GFFAttributesGeneric
* @param {Object} options
* @param {String} options.inline - handled by parent
* @memberof formats.mapping.gffbasic
*/
class GFF2Attributes extends GFFAttributesGeneric {
  // GFF2 format atributes are a little different in how entries are parsed
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
  /**
  * get the distinct entries from GFF2 attributes
  * @instance
  * @readonly
  * @returns {Array} entries - return the array of GFF3Attribute objects
  * @memberof formats.mapping.gffbasic.GFF3Attributes
  */
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

/**
* The class generically defines a single GFFAttribute
* @class
* @param {String} key - the type of attribute this is
* @param {String} value - the value of this attribute
* @memberof formats.mapping.gffbasic
*/
class GFFAttributeGeneric {
  // a single attribute
  constructor (key,value) {
    this._key = key;
    this._value = value;
  }
  /**
  * getter for the key associated with this object
  * @instance
  * @readonly
  * @returns {String} return the key for this attribute
  * @memberof formats.mapping.gffbasic.GFFAttributeGeneric
  */
  get key () {
    return this._key;
  }
  /**
  * getter for the values associated with this object
  * @instance
  * @readonly
  * @returns {String} return the value for this attribute
  * @memberof formats.mapping.gffbasic.GFFAttributeGeneric
  */
  get value () {
    return this._value;
  }
  toString () {
    throw new Error('child overrides this');
  }
}

/**
* The specifically define a GFF3 attribute
* @class
* @extends GFFAttributeGeneric
* @param {Object} options
* @param {String} options.instring - let this class parse the attribute and pass the key value back to the parent
* @memberof formats.mapping.gffbasic
*/
class GFF3Attribute extends GFFAttributeGeneric {
  // a single attribute
  constructor (options) {
    if (! options) options = {};
    if (options.instring) {
      let m1 = /^(\S+)\s*=\s*(.*)$/.exec(options.instring);
      let k;
      let v;
      if (m1) {
        k = m1[1];
        v = m1[2];
      } else {
        throw new Error('unparsed attribute '+x);
      }
      super(k,v);
    }
    else if (options.key !== undefined && options.value !== undefined) super(options.key,options.value);
    else throw new Error('need to give attribute either instring, or key and value');
  }
  toString () {
    return this._key+'='+this._value;
  }
}
/**
* The specifically define a GFF2 attribute
* @class
* @extends GFFAttributeGeneric
* @param {Object} options
* @param {String} options.instring - let this class parse the attribute
* @memberof formats.mapping.gffbasic
*/
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

/**
* Convert a map into an Array of GFF2 objects
*
* This might be better served by converting to String lines and having this in the mapping class
*
* @param {Transcript} map - input map probably could be any GenericMapping type
* @param {Object} options
* @param {Object} options.source - check for source in options first them in map before going with unknown "." default
* @returns {Array} GFF2 Objs
* @memberof formats.mapping.gffbasic
*/
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
/**
* Convert a map into an Array of GFF3 objects
*
* This might be better served by converting to String lines and having this in the mapping class
*
* @param {Transcript} map - input map probably could be any GenericMapping type
* @param {Object} options
* @param {Object} options.source - check for source in options first them in map before going with unknown "." default
* @returns {Array} GFF3 Objs
* @memberof formats.mapping.gffbasic
*/
var transcript_to_GFF3 = function (tx,options) {
  if (! options) options = {};
  let o = [];
  let l1 = tx.refName+"\t";
  if (options.source !== undefined) l1+= options.source+"\t";
  else if(tx.source !== undefined) l1 += tx.source+"\t"
  else l1 += ".\t";
  l1 += "mRNA\t";
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
  let group = 'ID='+tx.transcript_name+';Parent='+tx.gene_name+';gene_id='+tx.gene_name+';transcript_id='+tx.transcript_name;
  l1 += group;
  // Got the first line
  o.push(new GFF3Data(l1));
  // Now do exons
  for (let i = 0; i < tx.exons.length; i++) {
    let ln = tx.refName + "\t";
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
    let group2 = 'ID='+tx.exons[i].id+';Parent='+tx.transcript_name+';gene_id='+tx.gene_name+';transcript_id='+tx.transcript_name+';';
    ln += group2+'exon_number='+(i+1);
    o.push(new GFF3Data(ln));
  }
  return o;
}
/**
* Convert a gene into an Array of GFF3 objects
*
* This might be better served by converting to String lines and having this in the mapping class
*
* @param {Gene} gene - input gene (a group of transcripts)
* @param {Object} options
* @param {Object} options.source - check for source in options first them in map before going with unknown "." default
* @returns {Array} GFF3 Objs
* @memberof formats.mapping.gffbasic
*/
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
  let group =  'ID='+gene.gene_name+';gene_id='+gene.gene_name
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
exports.GFF3Data = GFF3Data;
exports.GFF2Data = GFF2Data;
exports.GFF_entry_compare = GFF_entry_compare;

