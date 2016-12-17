"use strict";
const SAM = require('./formats/alignment/sam.js').SAM;
const AlignmentDerivedMapping = require('./mapping.js').AlignmentDerivedMapping;

class GenericAlignment {
  // Make a general alignment class to be overridden 
  // by more specific alignment formats
  constructor (options) {
    this._min_intron = 68;
    if (options.min_intron) this._min_intron = options.min_intron;
  }
  get _map () {
    // this one is key to being available for making alignments universal
    // it contains a query and a reference array
    throw new Error('generic class must be overriden');
  }
  get qname () {
    throw new Error('generic class must be overriden');
  }
  get rname () {
    throw new Error('generic class must be overriden');
  }
  get qseq () {
    // this will be the reverse complement of the query sequence
    // if direction is negative
    throw new Error('generic class must be overriden');
  }
  get tlen () {
    throw new Error('generic class must be overriden');
  }
  get rseq () {
    throw new Error('generic class must be overriden');
  }
  get qual () {
    throw new Error('generic class must be overriden');
  }
  // Functions that can be called on any alignment but can also be overriden
  get direction () {
    // If - then qseq has been reverse complemented for this
    throw new Error('generic class must be overriden');
  }
  get min_intron () {
    return this._min_intron;
  }
  set min_intron (indata) {
    this._min_intron = indata;
  }
  // NOW UNIVERSALY AVAILABLE METHODS
  set ref (refDict) {
    this._ref = refDict;
  }
  get cigar () {
    if (! this._map) return '*';
    if (this._map.query.length === 0) return '*';
    var cstr = '';
    // start with left side
    if (this._map.query[0].start > 0) {
      cstr += this._map.query[0].start+'S'
    }
    for (let i = 0; i < this._map.query.length; i++) {
      cstr += this._map.query[i].length+'M'
      if (i === this._map.query.length-1) continue;
      // check the next
      if (this._map.query[i].end === this._map.query[i+1].start) {
        let dlen = this._map.reference[i+1].start-this._map.reference[i].end;
        if (dlen >= this._min_intron) cstr += dlen+'N';
        else cstr += dlen+'D';
      } else {
        // we have a gap in query so it is deletion
        cstr += (this._map.query[i+1].start-this._map.query[i].end)+'I';
      }
    }
    let rem = this.qseq.length-this._map.query[this._map.query.length-1].end;
    if (rem > 0) cstr += rem + 'S';
    return cstr;
  }
  get aligned_length () {
    let l = 0;
    for (let i = 0; i < this._map.query.length; i++) {
      l += this._map.query[i].length;
    }
    return l;
  }
  get psl_line () {
    // requires qseq and rseq
    // or
    // descriptive cigar and tlen
    var stats = this._psl_stats();
    var ostr = '';
    ostr += stats.matches+"\t";
    ostr += stats.misMatches+"\t";
    ostr += stats.repeats+"\t";
    ostr += stats.nCount+"\t";
    ostr += stats.qNumInsert+"\t";
    ostr += stats.qBaseInsert+"\t";
    ostr += stats.tNumInsert+"\t";
    ostr += stats.tBaseInsert+"\t";
    ostr += this.direction+"\t";
    ostr += this.qname+"\t";
    ostr += this.qseq.length+"\t";
    ostr += this._map.query[0].start+"\t";
    ostr += this._map.query[this._map.query.length-1].end+"\t";
    ostr += this.rname+"\t";
    ostr += this.tlen+"\t";
    ostr += this._map.reference[0].start+"\t";
    ostr += this._map.reference[this._map.reference.length-1].end+"\t";
    ostr += this._map.query.length+"\t";
    ostr += this.aligned_length+"\t";
    // get blocks
    for (let i = 0; i < this._map.query.length; i++) {
      ostr+= this._map.query[i].length+','
    }
    ostr += "\t"
    for (let i = 0; i < this._map.query.length; i++) {
      ostr+= this._map.query[i].start+','
    }
    ostr += "\t"
    for (let i = 0; i < this._map.query.length; i++) {
      ostr+= this._map.reference[i].start+','
    }
    return ostr;
  }
  _psl_stats () {
    // return the number of matches
    let miscnt = 0;
    let mcnt = 0;
    let ncnt = 0;
    let qnins = 0; // number of inserts
    let qbins = 0; // number of base inserts
    let qndel = 0; // deleted in query
    let qbdel = 0; // deleted bases in query
    if (this.qseq && this.rseq) {
      for (let i = 0; i < this._map.query.length; i++) {
        let qr = this._map.query[i];
        let rr = this._map.reference[i];
        let qs = this.qseq.slice(qr.start,qr.end).toString().toUpperCase();
        let rs = this.rseq.slice(rr.start,rr.end).toString().toUpperCase();
        for (let j = 0; j < qs.length; j++) {
          if (qs[j] === 'N') ncnt++;
          else if (qs[j] === rs[j]) mcnt++;
          else miscnt++;
        }
        // count our repeats here
        if (i === this._map.query.length-1) continue; // cant get gap info
        let qgap = this._map.query[i+1].start-qr.end;
        let rgap = this._map.reference[i+1].start-rr.end;
        if (qgap > 0 && qgap < this.min_intron) {
          qndel++;
          qbdel += qgap;
        }
        if (rgap > 0) {
          qnins++;
          qbins += rgap;
        }
      }
      return {matches:mcnt,
              misMatches:miscnt,
              repeats:0,
              nCount:0,
              qNumInsert:qnins,
              qBaseInsert:qbins,
              tNumInsert:qndel,
              tBaseInsert:qbdel
             }
    }
    throw new Error('string based error');
  }
  get sam_line () {
    // need a qname and a rname
    // we will construct a sam line
    var ostr = '';
    ostr += this.qname+"\t";
    if (this.direction === '+') {
      ostr += '0'+"\t";
    } else { ostr += '16'+"\t"; }
    ostr += this.rname+"\t";
    ostr += (this._map.query[0].start+1)+"\t";
    ostr += '255'+"\t";
    ostr += this.cigar+"\t";
    ostr += '*'+"\t";
    ostr += '0'+"\t";
    if (! this.tlen) {
      ostr += '0'+"\t";
    } else {
      ostr += this.tlen+"\t";
    }
    if (! this.qseq) {
      ostr += '*'+"\t";
    } else {
      ostr += this.qseq+"\t";
    }
    if (! this.qual) {
      ostr += '*';
    } else {
      ostr += this.qual;
    }
    return ostr;
  }
  pretty_print (linelength) {
    if (! linelength) linelength = 50;
    // return a string with the alignment in a pretty output format
    if (! this.qseq) throw new Error('cannot pretty print without query sequence')
    if (! this.rseq) throw new Error('cannot pretty print without the refernece sequences')
    let qlong = '';
    let rlong = '';
    let qprev = undefined;
    let rprev = undefined;
    for (let i = 0; i < this._map.query.length; i++) {
      let q = this._map.query[i];
      let r = this._map.reference[i];
      // see what we may need to fill
      if (qprev) {
        if (qprev.end < q.start) {
          rlong+=Array(q.start-qprev.end+1).join('-');
          qlong+=this.qseq.slice(qprev.end,q.start);
        }
      }
      if (rprev) {
        if (rprev.end < r.start) {
          qlong+=Array(r.start-rprev.end+1).join('-');
          rlong+=this.qseq.slice(rprev.end,r.start);
        }
      }
      let qpart = this.qseq.slice(q.start,q.end);
      let rpart = this.rseq.slice(r.start,r.end);
      qlong += qpart;
      rlong += rpart;
      qprev = q;
      rprev = r;
    }
    let digits = Math.max((qlong.length+'').length,(rlong.length+'').length);
    let qlongs = split_chunks(qlong,linelength);
    let rlongs = split_chunks(rlong,linelength);
    let ostr = '';
    let qstart = this._map.query[0].start+1;
    let rstart = this._map.reference[0].start+1;
    for (let i = 0; i < qlongs.length; i++) {
      let mms = '';
      for (let j = 0; j < qlongs[i].length; j++) { //mismatch string
        if (qlongs[i][j] !== '-' && rlongs[i][j] !== '-' && qlongs[i][j] !== rlongs[i][j]) {
          mms += '*';
        } else {
          mms += ' ';
        }
      }
      let spacer = Array(digits+1).join(' ');
      ostr += '  '+''+spacer+'   '+mms+"\n";
      ostr += 'Q '+this.direction+pad(qstart,digits)+': '+qlongs[i]+"\n";
      ostr += 'R '+' '+pad(rstart,digits)+': '+rlongs[i]+"\n";
      qstart += qlongs[i].replace(/-/g,'').length;
      rstart += rlongs[i].replace(/-/g,'').length;
    }
    return ostr;
  }
  map_to_query (options) {
    // Produce a mapping objet of the query alignment
    if (! options) options = {};
    options.inmap = this._map.query;
    options.name = this.qname;
    options.direction = this.direction;
    return new AlignmentDerivedMapping(options);
  }
  map_to_reference (options) {
    if (! options) options = {};
    options.inmap = this._map.reference;
    options.name = this.qname;
    options.direction = this.direction;
    return new AlignmentDerivedMapping(options);
    // Produce a mapping object of the reference alignment
  }
}
var pad = function (num,digits) {
  // for the pretty print function add spaces
  let cdig = (num+'').length;
  return Array(digits-cdig+1).join(' ')+num;
}

var split_chunks = function (instr, size) {
  return instr.match(new RegExp('.{1,'+size+'}','g'));
}

exports.GenericAlignment = GenericAlignment;
