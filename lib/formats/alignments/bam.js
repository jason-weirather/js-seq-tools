"use strict";

//Piping bam files is a major function of this class
const Transform = require('stream').Transform;
const inherits = require('util').inherits;
const bgzf = require('../compression/bgzf.js');
const EventEmitter = require('events').EventEmitter;

// Other modules in this pack
const PipeFitter = require('../../streams.js').PipeFitter;

const _NUM2CIG = {0:'M',1:'I',2:'D',3:'N',4:'S',5:'H',6:'P',7:'=',8:'X'};
const _NUM2SEQ = {0:'=',1:'A',2:'C',3:'M',4:'G',5:'R',6:'S',7:'V',
                  8:'T',9:'W',10:'Y',11:'H',12:'K',13:'D',14:'B',15:'N'};
var createBAMInputStream = function (options) {
  var that = this;
  if (! (this instanceof createBAMInputStream))
    return new createBAMInputStream(options);
  if (! options) options = {};
  options.objectMode = true;
  Transform.call(this,options);
  this.bamreader = new BamDataReader();
  this._header = undefined;
  //this.cache = new PipeFitter(bgzf.max_block_size-bgzf.header_size);
  this._decompress = new bgzf.BGZFDecompressionCache();
}
inherits(createBAMInputStream,Transform);
createBAMInputStream.prototype._transform = function _transform(indata, encoding, callback) {
  var bamdata, uncompressed;
  // take care of compression first
  this._decompress.write(indata);
  while (this._decompress.ready) {
    this.bamreader.add(this._decompress.read());
  }
  // take care of bam decoding second
  while (true) {
    bamdata = this.bamreader.remove();
    if (! bamdata) break;
    if (bamdata) this.push(bamdata);
  }
  callback();
}

createBAMInputStream.prototype._flush = function (callback) {
  var bamdata;
  //we've reached the end
  this._decompress.end();
  while (this._decompress.has_data) {
    this.bamreader.add(this._decompress.read());
  }
  //console.log('hifunfun2 '+this.bamreader.data.length);
  // take care of bam decoding second
  while (true) {
    bamdata = this.bamreader.remove();
    if (! bamdata) break;
    if (bamdata) this.push(bamdata);
  }
  callback();
}

var get_header = function(data) {
      // If there is enough data return a header object, otherwise return undefined
      var failure = undefined;
      //var header = {};
      var bam_header = new BAMHeader();
      //console.log('in header');
      var current_length = data.length;
      // Do we have enough data to get the header:
      if(data.length < 12) { return failure; }
      let z = 0;
      //header.magic = data.readUInt32LE(z);  // magic
      bam_header.magic = data.readUInt32LE(z); //magic
      z += 4;
      //if (header.magic !== 21840194) { 
      //  throw new Error('Header in BAM failure.');
      //}
      let l_text = data.readInt32LE(z); // l_text
      z += 4;
      //console.log('l_text '+l_text);
      if (data.length < z +l_text) { return failure; }
      let text = data.slice(z,z+l_text); // text
      z += l_text;
      //header.text = text.toString('ascii');
      bam_header.text = text;
      if (data.length < z+4) return failure;
      //header.n_ref = data.readInt32LE(z); // n_ref
      bam_header.n_ref = data.readInt32LE(z); //n_ref
      //header.refs = [];
      z += 4;
      //console.log('n_ref '+header.n_ref);
      for (let i = 0; i < bam_header.n_ref; i++) {
        if (data.length < z+4) return failure;
        let l_name = data.readInt32LE(z); // l_name
        z += 4;
        if (data.length < z +l_name) { return failure; }
        let name = data.slice(z,z+l_name);
        //console.log(name.toString('ascii'));
        z += l_name;
        if (data.length < z + 4) return failure;
        let l_ref = data.readInt32LE(z);
        //header.refs.push({'name':name,'l_ref':l_ref});
        bam_header.add_ref(name,l_ref);
        z += 4;
      }
      // if we are still here we succesfully got the header
      return [bam_header, data.slice(z,data.length)];
}

class BAMHeader {
  constructor () {
    this.refs = [];
  }
  toString () {
    return this._text.slice(0,this._text.length-1);
  }
  add_ref(name,l_ref) { // name buffer and length integer
    if (name.readUInt8(name.length-1) !== 0) {
      throw Error('Reference name in BAM header was not null terminated properly');
    }
    this.refs.push({name:name.slice(0,name.length-1).toString('ascii'),l_ref:l_ref});
  }
  // Add getters
  get n_ref () {
    if (! this._n_ref) {
      throw Error('Cant read n_ref, Header has not been read correctly');
    }
    return this._n_ref;
  }
  // Add setters
  set magic (indata) {  //input UInt32LE
    if (indata !== 21840194) { 
      throw new Error('Header in BAM failure.');
    }
    this._magic = indata;
  }
  set text (indata) { //input buffer
    this._text = indata.toString('ascii');
  }
  set n_ref (indata) { //input Int32LE
    this._n_ref = indata;
  }
}

class BAM {
  constructor (alignment_record_data,header,options) {
    this.data = alignment_record_data; //begins with block_size
    this._header = header;
    this.cache = false;
    if (options) {
      if (options.cache) { this.cache = options.cache; }
    }
  }
  toString () {
    // use SAM as output
    var ostr = '';
    ostr += this.read_name+"\t";
    ostr += this.flag+"\t";
    ostr += this.refName+"\t";
    ostr += this.pos+"\t";
    ostr += this.mapq+"\t";
    ostr += this.cigar+"\t";
    ostr += this.next_refName+"\t";
    ostr += this.next_pos+"\t";
    ostr += this.tlen+"\t";
    ostr += this.seq+"\t";
    ostr += this.qual+"\t";
    if (this.auxillary.tags.length > 0) {
      ostr += this.auxillary+'';
    }
    return ostr;
  }

  // getter for non-BAM derivatives
  get refName () {
    if (this.refID === -1) { return '*'; }
    return this._header.refs[this.refID].name;
  }
  get next_refName () {
    if (this.next_refID === -1) { return '*'; }
    return this._header.refs[this.next_refID].name;
  }

  // getter functions for properties from the BAM
  get block_size () {
    return this.data.readInt32LE(0);
  }
  get refID () {
    return this.data.readInt32LE(4);
  }
  get pos () {
    return this.data.readInt32LE(8)+1;
  }
  get name_l () {
    return this._bin_mq_nl() & 0xFF;
  }
  get mapq () {
    return (this._bin_mq_nl()>>>8) & 0xFF;
  }
  get bin () {
    return (this._bin_mq_nl()>>>16) & 0xFFFF;
  }
  _bin_mq_nl () {
    return this.data.readUInt32LE(12);
  }
  get flag () {
    return (this._flag_nc()>>>16) & 0xFFFF;
  }
  get n_cigar_op () {
    return this._flag_nc() & 0xFFFF;
  }
  _flag_nc () {
    return this.data.readUInt32LE(16);
  }
  get l_seq () {
    return this.data.readInt32LE(20);
  }
  get next_refID () {
    return this.data.readInt32LE(24);
  }
  get next_pos () {
    return this.data.readInt32LE(28)+1;
  }
  get tlen () {
    return this.data.readInt32LE(32);
  }
  get read_name () {
    // cache the read name
    if (this._read_name) { return this._read_name; }
    let namedata = this.data.slice(36,this._get_read_name_end());
    if (namedata.readUInt8(namedata.length-1)!==0) {
      throw Error('Should be null terminated read name');
    }
    var read_name = namedata.slice(0,namedata.length-1).toString('ascii');
    if (this.cache) this._read_name = read_name;
    return read_name;
  }
  get cigar () {
    if (this._cigar) return this._cigar;
    var start = this._get_read_name_end();
    var end = this._get_cigar_end();
    var cigar = new CIGAR();
    cigar.load_data(this.data.slice(start,end));
    if (this.cache) this._cigar = cigar;
    return cigar;
  }
  get seq () {
    if (this._seq) { return this._seq; }
    var start = this._get_cigar_end();
    var end = this._get_seq_end();
    var seqdata = this.data.slice(start,end);
    var seq = new BAMSeq();
    seq.load_data(seqdata,this.l_seq);
    if(this.cache) this._seq = seq;
    return seq;
  }
  get qual () {
    var start = this._get_seq_end();
    var end = this._get_qual_end();
    var qualdata = this.data.slice(start,end);
    if (qualdata.length > 0) {
      if (qualdata.readUInt8(0)===255) { return '*'; }
    } else { return '*'; }
    return this.data.slice(start,end).toString('ascii');
  }
  get auxillary () {
    var start = this._get_qual_end();
    var end = this.data.length;
    var auxdata = this.data.slice(start,end);
    var aux = new BAMAuxillary();
    aux.load_data(auxdata);
   return aux;
  }
  // functions to help calculate and cache positions
  _get_read_name_end () {
    if (!this._read_name_end) {
      this._read_name_end = 36+this.name_l;
    }
    return this._read_name_end;
  }
  _get_cigar_end () {
    if (!this._cigar_end) {
      this._cigar_end = this._get_read_name_end()+this.n_cigar_op*4;
    }
    return this._cigar_end;
  }
  _get_seq_end () {
    if (!this._seq_end) {
      this._seq_end = this._get_cigar_end()+Math.floor((this.l_seq+1)/2)
    }
    return this._seq_end;
  }
  _get_qual_end () {
    if (!this._qual_end) {
      this._qual_end = this._get_seq_end() + this.l_seq;
    }
    return this._qual_end;
  }
}
class BAMAuxillary {
  constructor () {
    this._data = new Buffer(0);
  }
  load_data (indata) {
    this._data = indata;
  }
  get tags () {
    return _get_auxillary_info(this._data);
  }
  toString () {
    var ostr = '';
    if (this._data.length === 0) { return seq; }
    let cdata = Buffer.concat([this._data]);
    let tags = _get_auxillary_info(this._data);
    for (let i = 0; i < tags.length; i++) {
      // according to standard for sam representation of any integer is i
      if (tags[i][1].match(/[cCsSiI]/)) {
        tags[i][1] = 'i';
      }
      tags[i] = tags[i].join(':');
    }
    ostr = tags.join("\t");
    return ostr;
  }
}

var _get_auxillary_info = function (indata) {
  // recursive breaking apart of auxillary tags
  let outputs = [];
  let tag = indata.slice(0,2).toString('ascii');
  let val_type = indata.slice(2,3).toString('ascii');
  let val = undefined;
  let remainder = new Buffer(0);
  switch (val_type) {
    case 'A':
      val = indata.slice(3,4).toString('ascii');
      remainder = indata.slice(4,indata.length);
      break;
    case 'c':
      val = indata.readInt8(3);
      remainder = indata.slice(4,indata.length);
      break;
    case 'C':
      val = indata.readUInt8(3);
      remainder = indata.slice(4,indata.length);
      break;
    case 's':
      val = indata.readInt16LE(3);
      remainder = indata.slice(5,indata.length);
      break;
    case 'S':
      val = indata.readUInt16LE(3);
      remainder = indata.slice(5,indata.length);
      break;
    case 'i':
      val = indata.readInt32LE(3);
      remainder = indata.slice(7,indata.length);
      break;
    case 'I':
      val = indata.readUInt32LE(3);
      remainder = indata.slice(7,indata.length);
      break;
    case 'f':
      throw new Error('not implemented f');
      break;
    case 'Z':
      let end = indata.indexOf(0x00,3);
      val = indata.slice(3,end).toString('ascii');
      remainder = indata.slice(end+1,indata.length);
      break;
    case 'H':
      throw new Error('not implemented H');
      break;
    case 'B':
      throw new Error('not implemented B');
      break;
  }
  let othervals = [];
  if (remainder.length > 0) othervals = _get_auxillary_info(remainder);
  outputs.push([tag,val_type,val]);
  for (let i = 0; i < othervals.length; i++) {
    outputs.push(othervals[i]);
  }
  return outputs;
}

class BAMSeq {
  constructor () {
    this._data = new Buffer(0);
    this._slen = 0;
  }
  load_data (indata,slen) {
    if (slen===0) { return; }
    this._data = indata;
    this._slen = slen;
  }
  toString() {
    var seq = '';
    for (let i = 0; i < this._data.length; i++) {
      let byte = this._data.readUInt8(i);
      let b1 = (byte>>>4) & 0xF;
      let b2 = byte & 0xF;
      if (seq.length < this._slen) { seq += _NUM2SEQ[b1]; }
      if (seq.length < this._slen) { seq += _NUM2SEQ[b2]; }
    }
    return seq;
  }
}

class CIGAR {
  constructor () {
    this.data = new Buffer(0);
  }
  _get_array () {
    var ops = [];
    for (let i = 0; i < this.data.length; i+=4) {
      let centry = this.data.readUInt32LE(i);
      let oplen = centry>>>4;
      let op = _NUM2CIG[(centry & 0xF)];
      ops.push([op,oplen]);
    }
    return ops;
  }
  toString () {
    var ops = this._get_array();
    var ostr = '';
    for (let i = 0; i < ops.length; i++) {
      ostr += ops[i][1]+ops[i][0];
    }
    if (ostr === '') ostr = '*';
    return ostr;
  }
  load_data(indata) {
    this.data = indata;
  }
}
class BamDataReader {
  constructor (header) {
    this.data = new Buffer(0);
    this._header = header;
  }
  add (indata) {
    this.data = Buffer.concat([this.data,indata]);
  }
  remove () {
    var failure = undefined;
    // starting from the beginning read one bam entry
    if (! this._header) {
      // Get the header first if we haven't seen one yet.
      let val = get_header(this.data);
      let header = val[0];
      if (! header) { return undefined; } // we probably need to read more
      let remainder = val[1];
      this._header = header;
      // Now clear the header from the buffer
      this.data = remainder;
      return {header:this._header};
    }
    // Now we are iterating over bam entires
    let z = 0;
    if (this.data.length < 4) return failure;
    let block_size = this.data.readInt32LE(z);
    z += 4;
    let outdata = undefined;
    if (this.data.length >= block_size+z) {
      //console.log(this._header);
      //let h = this._header;
      let abuf = new BAM(this.data.slice(0,block_size+z),this._header);
      outdata = {bam:abuf};
    }
    z += block_size;
    this.data = this.data.slice(z,this.data.length);
    return outdata;
  }
}


exports.createBAMInputStream = createBAMInputStream;
