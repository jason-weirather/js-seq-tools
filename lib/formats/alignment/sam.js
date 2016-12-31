"use strict";
const AlignmentDerivedMapping = require('../../mapping.js').AlignmentDerivedMapping;

//Piping bam files is a major function of this class
const Transform = require('stream').Transform;
const GenericAlignment = require('../../alignment.js').GenericAlignment;
const Bed = require('../../range.js').Bed;

const _CIGAR2NUM = { M:0,I:1,D:2,N:3,S:4,H:5,P:6,'=':7,X:8}
const _SEQ2NUM = {'=':0,A:1,C:2,M:3,G:4,R:5,S:6,V:7,T:8,W:9,Y:10,H:11,K:12,D:13,B:14,M:15}
const _MAGIC = 21840194;


class SAM extends GenericAlignment {
  constructor (options) {
    if (!options) { options = {}; }
    super(options);
    if (options.sam_line) {
      this._sam_line = options.sam_line.replace('\s+$','');
      this._f = this._sam_line.split("\t");
    }
    if (options.header) this._header = options.header;
    if (options.cache) { this.cache = options.cache; }
  }
  get qseq () { // overriding for generic alignment access 
    if (this.seq === '*') return undefined;
    return this.seq;
  }
  get rseq () {
    if (! this._reference_sequence) throw new Error("cannot use a call to rseq if a reference sequence has not been provided. Try setting the rseq for your alignment\n");
    return this._reference_sequence;
  }
  set rseq (inseq) {
    this._reference_sequence = inseq; // Input Sequence Object
  }
  get qname () {
    return this.read_name;
  }
  get direction () {
    if (this.flag && 16 !== 0) return '-';
    return '+';
  }
  get _map () {
    let output = {};
    // we need to set this._map.query and this._map.reference
    if (this.cigar.toString() === '*') return undefined;
    let refs = [new Bed(this.refName,this.pos-1,this.pos-1)];
    let soft_count = 0;
    let queries = [new Bed(this.read_name,0,0)];
    for (let i = 0; i < this.cigar.ops.length; i++) {
      let op = this.cigar.ops[i][0];
      let num = this.cigar.ops[i][1];
      if (op === 'H') continue; // it is not in query sequence dont worry
      // This case is a bit ambiguous in the spec but it seems if an H is present at the beginning that it is not part of the position offset
      let re = refs.length-1; // last entry
      let qe = queries.length-1; // last entry
      if (op === 'S' && soft_count === 0) { // make sure we are only working with the first soft clipping to do an offset
        soft_count += 1;
        refs[re].start += num;
        refs[re].end += num;
        queries[qe].start += num;
        queries[qe].end += num;
      } else if (/^[M=X]$/.test(op)) {
        soft_count += 1; // we are no longer at the start
        refs[re].end += num;
        queries[qe].end += num;
      } else if (op === 'P') {
        throw new Error('padding in entry not yet supported');
      }
      // we will be making a new exon 
      if (/^[NDI]$/.test(op)) { // we will have a new exon
        refs.push(refs[re].copy());
        queries.push(queries[qe].copy());
        re = refs.length - 1;
        refs[re].start = refs[re].end;
        refs[re].end = refs[re].start;
        qe = queries.length - 1;
        queries[qe].start = queries[qe].end;
        queries[qe].end = queries[qe].start;
      }
      if (op === 'N') {
        // Just an intron shift the position on the reference
        refs[re].start += num;
        refs[re].end += num;
      } else if (op === 'D') {
        // Just a deletion from the reference
        refs[re].start += num;
        refs[re].end += num;
      } else if (op === 'I') {
        // Just an insertion
        queries[qe].start += num;
        queries[qe].end += num;
      }
    }
    output.query = queries;
    output.reference = refs;
    //console.log(queries);
    //console.log(refs);
    return output;
  }
  to_query_map (options) {
    if (! options) options = {};
    options.inmap = this._map.query;
    options.name = this.qname;
    options.direction = this.direction;
    return new AlignmentDerivedMapping(options);
  }
  to_reference_map (options) {
    if (! options) options = {};
    options.inmap = this._map.reference;
    options.name = this.qname;
    options.direction = this.direction;
    return new AlignmentDerivedMapping(options);
  }
  set sam_line (intext) {
    this._sam_line = intext;
    this._f = this._samline.replace('\s+$','').split("\t");
  }
  get sam_line () { return this._sam_line; } // same as toString
  toString () {
    //console.log(this._sam_line);
    return this._sam_line;
  }
  // getters
  get refName () {
    // this one is always cached in case we are working as a SAM
    return this._f[2];
  }
  get next_refName () {
    return this._f[6];
  }
  get pos () {
    if (this._f[3] === '*') return 0;
    return Math.floor(this._f[3]);
  }
  get mapq () {
    return Math.floor(this._f[4]);
  }
  get flag () {
    return Math.floor(this._f[1]);
  }
  get next_pos () {
    if (this._f[7] === '*') return 0;
    return Math.floor(this._f[7]);
  }
  get tlen () {
    return Math.floor(this._f[8]);
  }
  get read_name () {
    return this._f[0];
  }
  get cigar () {
    if (this._cigar) return this._cigar;
    //var start = this._get_read_name_end();
    //var end = this._get_cigar_end();
    //var cigar = new CIGAR();
    //cigar.load_data(this.data.slice(start,end));
    this._cigar = new CIGAR(this._f[5]);
    //return cigar;
    return this._cigar;
  }
  get seq () {
    //if (this._seq) { return this._seq; }
    //var start = this._get_cigar_end();
    //var end = this._get_seq_end();
    //var seqdata = this.data.slice(start,end);
    //var seq = new BAMSeq();
    //seq.load_data(seqdata,this.l_seq);
    //if(this.cache) this._seq = seq;
    return this._f[9];
  }
  get qual () {
    //var start = this._get_seq_end();
    //var end = this._get_qual_end();
    //var qualdata = this.data.slice(start,end);
    //if (qualdata.length > 0) {
    //  if (qualdata.readUInt8(0)===255) { return '*'; }
    //} else { return '*'; }
    //return this.data.slice(start,end).toString('ascii');
    return this._f[11];
  }
  get auxillary () {
    if (this._aux) return this._aux;
    let v = [];
    if (this._f.length > 11) {
      v = this._f.slice(11,this._f.length);
    }
    this._aux = new SAMAuxillary(v);
    return this._aux;
  }
  get bam_data () {
    //  A tough getter function.  
    //  This one uses this structure to return BAM data prior to bgzf compression
    var f;
    if (! this._header) {
      throw new Error('a header is necessary to bam encode');
    }
    f = this._sam_line.replace('\s+$','').split("\t");
    // use the sam line to se the data
    var d1 = new Buffer(36); // everything up to variable length fields
    let z = 0;
    z += 4; // we dont know block size yet
    z += 4; // we don't yet konw refID
    let pos;
    if (f[3]==='*') pos = -1;
    else pos = Math.floor(f[3])-1;
    d1.writeInt32LE(pos,z); //pos
    z += 4;
    let bin = 0;  // not sure about this one
    let mapq = Math.floor(f[4]);
    let nl = Math.floor(f[0].length+1);
    d1.writeUInt32LE((bin<<16)|(mapq<<8)|nl,z);
    z += 4;
    let flag = Math.floor(f[1]);
    let ncigarlen;
    if (f[5]==='*') {
      ncigarlen = 0;
    } else {
      ncigarlen = (f[5].replace(/^\d+/,'').split(/\d+/)).length;
    }
    d1.writeUInt32LE((flag<<16)|ncigarlen,z);
    z += 4;
    let slen;
    slen = f[9].length;
    d1.writeInt32LE(slen,z);
    z += 4;
    z += 4; // next ref not known yet
    let pnext;
    if (f[7]==='*') pnext = -1;
    else pnext = Math.floor(f[7])-1;
    d1.writeInt32LE(pnext,z);
    z += 4;
    d1.writeInt32LE(Math.floor(f[8]),z); // tlen
    z += 4;
    // done with d1
    let d2 = new Buffer(f[0].length+1); // read name 
    z += d2.length;
    d2.write(f[0]+"\0");
    let d3 = new Buffer(ncigarlen*4);  // encoded cigar
    z += d3.length;
    this.cigar.bam_data.copy(d3);

    let sarrlen = Math.floor((slen+1)/2);
    let d4 = new Buffer(sarrlen);  // encoded seq
    z += sarrlen;
    let s_index = 0;
    let b_index = 0;
    while (s_index < slen) {
      let val = 0;
      val = _SEQ2NUM[this.seq[s_index]];
      s_index += 1;
      if (s_index >= slen) {
        d4.writeUInt8(val<<4,b_index);
        break;
      }
      val = (val<<4)|_SEQ2NUM[this.seq[s_index]];
      d4.writeUInt8(val,b_index);
      s_index += 1;
      b_index += 1;
    }
    let d5 = new Buffer(slen); // Fill with 0xFF if not set
    z += slen;
    if (f[10] === '*') {
      for (let i = 0; i < slen; i++) {
        d5.writeUInt8(255,i);
      }
    } else {
      d5.write(f[10]);
    }
    // now we only need to encode the auxillary data
    let d6 = this.auxillary.bam_data;
    z += d6.length;

    // now we can revisit block size and refID in the d1 
    let block_size = z;
    d1.writeInt32LE(block_size-4,0);
    let ref_index;
    if (this.refName === '*') {
      ref_index = -1;
    } else {
      ref_index = this._header.refs.map(function(x){return x.name;}).indexOf(this.refName);
    }
    d1.writeInt32LE(ref_index,4);
    let next_ref_index;
    if (this.next_refName === '*') {
      next_ref_index = -1;
    } else {
      next_ref_index = this._header.refs.map(function(x){return x.name;}).indexOf(this.next_refName);
    }
    d1.writeInt32LE(next_ref_index,24);

    // block_size and refID are set now

    //console.log(refs);
    let retval = Buffer.concat([d1,d2,d3,d4,d5,d6]);
    //console.log(retval.length);
    //console.log(z);
    return retval
  }

}

class SAMAuxillary {
  constructor (aux) {
    this._f = aux;
  }
  get tags () {
    if (this._tags) return this._tags;
    this._tags = _get_auxillary_info(this._f);
    return this._tags;
  }
  toString () {
    var ostr = '';
    ostr = this._f.join("\t");
    return ostr;
  }
  get bam_data () {
    //console.log('getting bam data');
    //var output = new Buffer(0);
    let tags = this.tags;
    var buffers = [];
    for (let i = 0; i < tags.length; i++) {
      let p;
      let n = new Buffer(2);
      n.write(tags[i][0]);
      // for numeric tags we can calculate tag by number size
      let ttype = tags[i][1];
      let val = tags[i][2];
      if (ttype.match(/[cCsSiI]/)) {
        if (val >= Math.pow(-2,7) && val <= Math.pow(2,7)-1) {
          ttype = 'c';
        } else if (val >= 0 && val < Math.pow(2,8)) {
          ttype = 'C';
        } else if (val >= Math.pow(-2,15) && val <= Math.pow(2,15)-1) {
          ttype = 's';
        } else if (val >= 0 && val < Math.pow(2,16)) {
          ttype = 'S';
        } else if (val >= Math.pow(-2,31) && val < Math.pow(2,31)) {
          ttype = 'i';
        } else if (val >= 0 && val < Math.pow(2,32)) {
          ttype = 'I';
        } else {
          ttype = 'i';
        }
      }
      let o = new Buffer(1);
      o.write(ttype);
      switch (ttype) {
        case 'A':
          p = new Buffer(1);
          p.write(tags[i][2]);
          break;
        case 'c':
          p = new Buffer(1);
          p.writeInt8(tags[i][2]);
          break;
        case 'C':
          p = new Buffer(1);
          p.writeUInt8(tags[i][2]);
          break;
        case 's':
          p = new Buffer(2);
          p.writeInt16LE(tags[i][2]);
          break;
        case 'S':
          p = new Buffer(2);
          p.writeUInt16LE(tags[i][2]);
          break;
        case 'i':
          p = new Buffer(4);
          p.writeInt32LE(tags[i][2]);
          break;
        case 'I':
          p = new Buffer(4);
          p.writeUInt32LE(tags[i][2]);
          break;
        case 'f':
          throw new Error('f not implemented');
          break;
        case 'Z':
          p = new Buffer(tags[i][2].length+1);
          p.write(tags[i][2]+"\0");
          break;
        case 'H':
          throw new Error ('not implemented H');
          break;
        case 'B':
          throw new Error ('not implemented H');
          break;
        default:
          throw new Error ('unimplemented tag: '+tags[i][1])
      }
      buffers.push(Buffer.concat([n,o,p]));
    }
    return Buffer.concat(buffers);
  }
}

var _get_auxillary_info = function (indata) {
  // recursive breaking apart of auxillary tags
  let outputs = [];
  for (let i = 0; i < indata.length; i++) {
    let vals = indata[i].split(':');
    vals[2] = vals.slice(2,vals.length).join(':');
    if (vals[1].match(/[cCsSiI]/)) vals[2] = Math.floor(vals[2]);
    outputs.push(vals);
  }
  return outputs;
}

class CIGAR {
  constructor (cigar_string) {
    if (cigar_string) {
      this._cigar_string = cigar_string;
    }
    this._ops = undefined;
  }
  get ops () {
    if (this._ops) return this._ops;
    let vals1 = this._cigar_string.split(/\d+/)
    vals1 = vals1.splice(1,vals1.length);
    let vals2 = this._cigar_string.split(/\D+/)
    vals2 = vals2.splice(0,vals2.length-1);
    this._ops = [];
    for (let i = 0; i < vals1.length; i++) {
      this._ops.push([vals1[i],Math.floor(vals2[i])]);
    }
    return this._ops;
  }
  toString () {
    return this._cigar_string;
  }
  get bam_data () {
    // return a buffer for bam data
    var output = new Buffer(4*this.ops.length);
    let z = 0;
    for (let i = 0; i < this.ops.length; i++) {
      output.writeUInt32LE((this.ops[i][1]<<4)|_CIGAR2NUM[this.ops[i][0]],z);
      z += 4;
    }
    return output;
  }
}

class DataToSAMObj extends Transform {
  constructor (options) {
    if (! options) options = {};
    options.objectMode = true;
    super(options);
    this._header = undefined;
    this._buffer = '';
    this._z = 0;
    this._c = 0;
    this._header_text = '';
  }
  _transform (indata, encoding, callback) {
    var vstr = this._buffer + indata.toString('ascii')
    var lines = vstr.split("\n");
    this._buffer = '';
    this._c += 1;
    if (lines.length > 0) {
      let remainder = lines.pop();
      this._buffer += remainder;
    }
    // now lines contains data
    for (let i = 0; i < lines.length; i++) {
      //console.log(i+' '+lines[i]);
      this._z += 1;
      if (this._z===1 && lines[i].match(/^@HD\s+VN:/)) {
        this._header_text += lines[i]+"\n";
        this._in_header = true;
      } else if (this._in_header) {
        if (lines[i].split("\t").length > 10) {
          this._in_header = false;
          this._header = new SAMHeader({text:this._header_text});
          this.push({header:this._header});
        } else {
          this._header_text += lines[i]+"\n";
        }
      }
      // we are not in the header
      if (! this._in_header  && lines[i].split("\t").length > 10) {
        let s = new SAM({sam_line:lines[i],header:this._header});
        this.push({sam:s});
      }
    }
    callback();
  }
  _flush (callback) {
    //console.log('flush');
    callback();
  }
}

class SAMHeader {
  constructor(options) {
    this.refs = [];
    if (options.text) {
      this._text = options.text;
      let vals = this._text.split("\n").map(function(x){return x.split("\t")}).filter(function(x){return x[0]=='@SQ'}); 
      for (let i=0; i < vals.length; i++) {
        let chr = vals[i][1].split(':')[1];
        let ln = Math.floor(vals[i][2].split(':')[1]);
        this.refs.push([chr,ln]);
      }
    }
  }
  get n_ref () {
    return this.refs.length;
  }
  toString () {
    return this._text;
  }
  get bam_data () {
    // return a bam compatible header prior to bgzf compression
    let d1 = new Buffer(4);
    d1.writeUInt32LE(_MAGIC);
    let d2 = new Buffer(4);
    d2.writeInt32LE(this._text.length);
    let d3 = new Buffer(this._text.length);
    d3.write(this._text);
    let d4 = new Buffer(4);
    d4.writeInt32LE(this.n_ref);
    let names = [];
    for (let i=0; i < this.n_ref; i++) {
      let l_name = this.refs[i][0].length+1;
      let t1 = new Buffer(4);
      t1.writeInt32LE(l_name);
      let t2 = new Buffer(l_name);
      t2.write(this.refs[i][0]+"\0");
      let t3 = new Buffer(4);
      t3.writeInt32LE(this.refs[i][1]);
      names.push(Buffer.concat([t1,t2,t3]));
    }
    let d5 = Buffer.concat(names);
    return Buffer.concat([d1,d2,d3,d4,d5]);
  }
}

exports.SAMHeader = SAMHeader;
exports.SAM = SAM;
exports.DataToSAMObj = DataToSAMObj;
