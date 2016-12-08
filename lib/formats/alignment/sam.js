"use strict";

//Piping bam files is a major function of this class
const Transform = require('stream').Transform;
const inherits = require('util').inherits;

class SAM {
  constructor (options) {
    if (!options) { options = {}; }
    if (options.sam_line) {
      this._sam_line = options.sam_line.replace('\s+$','');
      this._f = this._sam_line.split("\t");
    }
    if (options.cache) { this.cache = options.cache; }
  }
  set sam_line (intext) {
    this._sam_line = intext;
    this._f = this._samline.replace('\s+$','').split("\t");
  }
  toString () {
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
    var f;
    f = this._sam_line.replace('\s+$','').split("\t");
    //console.log(f);
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
    d1.writeUInt32LE((bin<<16)|(mapq<<8)|nl);
    z += 4;
    let flag = Math.floor(f[1]);
    let ncigarlen = (f[5].replace(/^\d+/,'').split(/\d+/)).length;
    d1.writeUInt32LE((flag<<16)|ncigarlen);
    z += 4;
    let slen;
    //if (f[9]==='*') slen = -1;
    //else slen = f[9].length;
    slen = f[9].length;
    d1.writeInt32LE(slen);
    z += 4;
    z += 4; // next ref
    let pnext;
    if (f[7]==='*') pnext = -1;
    else pnext = Math.floor(f[7])-1;
    d1.writeInt32LE(pnext);
    z += 4;
    d1.writeInt32LE(Math.floor(f[8])); // tlen
    // done with d1
    let d2 = new Buffer(f[0].length+1); // read name 
    let d3 = new Buffer(ncigarlen*4);  // encoded cigar
    let sarrlen = Math.floor((slen+1)/2);
    let d4 = new Buffer(sarrlen);  // encoded seq
    let d5 = new Buffer(slen); // Fill with 0xFF if not set
    if (f[10] === '*') {
      for (let i = 0; i < slen; i++) {
        d5.writeUInt8(255,i);
      }
    } else {
      d5.write(f[10]);
    }
    return Buffer.concat([d1,d2,d3,d4,d5]);
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
}

exports.SAM = SAM;
