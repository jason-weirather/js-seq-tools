"use strict";
const Matrix = require('./basics.js').Matrix;
const Bed = require('./range.js').Bed;
const GenericAlignment = require('./alignment.js').GenericAlignment;

/**
* This module contains classes for DOING alignments.  See alignment for the general definition of an alignment.
* @namespace aligner
*/

/**
* Members are not exported
* @namespace private
* @memberof aligner
*/

/**
* A class for generating results from a Smith-Waterman aligner
* @class
* @param {Object} H_matrix_positve_strand
* @param {Object} sequence_1
* @param {Object} sequence_2
* @param {Object} H_matrix_negative_strand
* @param {Object} sequence_1_reverse_complement
* @memberof aligner.private
*/
class SmithWatermanResults {
  //return new SmithWatermanResult(H,inputs.query,inputs.reference,Hneg,qrev);
  // You can emit alignment
  constructor (H_matrix,s1,s2,H_neg,s1rev) {
    this._H = H_matrix;
    this._Hrev = H_neg;
    this.s1 = s1;
    this.s2 = s2;
    this.s1rev = s1rev; // RC of s1
    this._entries = this._rank_best();
    this._index = 0;
  }

  /**
  * Get the alignment stored at the input index
  * @instance
  * @param {Number} index
  * @returns {Object} SmithWatermanAlignment
  * @memberof aligner.private.SmithWatermanResults
  */
  get_entry (index) {
    var entry = this._entries[index];
    let maxscore = entry[2];
    let currscore = entry[2];
    var s1o = [];
    var s2o = [];
    let a1 = '';
    let a2 = '';
    let isave = 0;
    let jsave = 0;
    let i = entry[0];
    let j = entry[1];
    let s1start = 0;
    let s2start = 0;
    // Figure out which H we are using
    let H = this._H;
    let s1 = this.s1;
    let direction = entry[3];
    if (entry[3] === '-') {
      H = this._Hrev;
      s1 = this.s1rev;
    }
    while (currscore > 0 && i >= 0 && j >= 0) {
      isave = i;
      jsave = j;
      let nextvals = this._next_coord(H,i,j);
      currscore = nextvals[0];
      let inext = nextvals[1];
      let jnext = nextvals[2];
      if (inext===i) {
        s1o.unshift(s1.get_nt(j));
        s2o.unshift('-');
      } else if (jnext === j) {
        s1o.unshift('-');
        s2o.unshift(this.s2.get_nt(i));
      } else {
        s1o.unshift(s1.get_nt(j));
        s2o.unshift(this.s2.get_nt(i));
      }
      i = inext;
      j = jnext;
    }
    s1start = jsave+1;
    s2start = isave+1;
    //  At this point we have what we need to build the alignment
    // maxscore, s1start, and s2start
    let in_chunk = false;
    let chunks = [];
    let current_chunk = undefined;//new Bed(this.s1.name,jsave,jsave+1),new Bed(this.s2.name,isave,isave+1)];
    let si1 = jsave;
    let si2 = isave;
    //console.log('');
    //console.log(s1o.join(''))
    //console.log(s2o.join(''))
    for (let k = 0; k < s1o.length; k++) {
      if (s1o[k] !=='-' && s2o[k] !== '-') {
        // we should be in a chunk now if we aren't
        if (! in_chunk) {
          if (current_chunk) chunks.push(current_chunk);
          current_chunk = [new Bed(this.s1.name,si1,si1+1),new Bed(this.s2.name,si2,si2+1)];
          in_chunk = true;
        } else {
          // grow the current chunk
          current_chunk[0].end++;
          current_chunk[1].end++;
        }
        si1++;
        si2++;
      }
      if (s1o[k] === '-') {
        in_chunk = false;
        si2++;
      }
      if (s2o[k] === '-') {
        in_chunk = false;
        si1++;
      }
    }
    if (in_chunk) { chunks.push(current_chunk); }
    // Now chunks contains the meat of the alignment data
    let qmap = [];
    let rmap = [];
    for (let i = 0; i < chunks.length; i++) {
      qmap.push(chunks[i][0]);
      rmap.push(chunks[i][1]);
    }
    //console.log(chunks);
    return new SmithWatermanAlignment({
      qmap:qmap,
      rmap:rmap,
      query:s1,
      reference:this.s2,
      direction:direction});
  }
  _next_coord (H,i,j) {
    // Input H matrix part of this
    // current i and j coords
    // Output nextscore inext and jnext
    let rowval = 0;
    if(i-1 >= 0) rowval = H[i-1][j];
    let colval = 0;
    if (j-1 >= 0) colval = H[i][j-1];
    let diagval =0;
    if (i-1>=0 && j-1 >=0) diagval = H[i-1][j-1];
    if (diagval >= rowval && diagval >= colval) return [diagval,i-1,j-1];
    if (rowval >= colval) return [rowval,i-1,j];
    return [colval,i,j-1];
  }
  _rank_best () {
    var vals = [];
    for (let m = 0; m < this._H.rows; m++) {
      for (let n = 0; n < this._H.columns; n++) {
        vals.push([m,n,this._H[m][n],'+']);
      }
    }
    for (let m = 0; m < this._Hrev.rows; m++) {
      for (let n = 0; n < this._Hrev.columns; n++) {
        vals.push([m,n,this._Hrev[m][n],'-']);
      }
    }
    return vals.sort(function(a,b){
      if (a[2] > b[2]) return -1;
      if (a[2] <= b[2]) return 1;
      return 0;
    });
  }
}

/**
* A class for performing a local alignment
* @class
* @param {Object} options
* @param {Number} [options.match=2]
* @param {Number} [options.mismatch=-2]
* @param {Number} [options.gap_open=-5]
* @param {Number} [options.gap_extend=-2]
* @param {Number} [options.max_gap=-10]
* @memberof aligner
*/
exports.SmithWatermanAligner = class SmithWatermanAligner {
  constructor (options) {
    if (! options) options = {};
    this.params = {}
    this.params['match'] = options.match || 2;
    this.params['mismatch'] = options.mismatch || -2;
    this.params['gap_open'] = options.gap_open || -5;
    this.params['gap_extend'] = options.gap_extend || -2;
    this.params['max_gap'] = options.max_gap || 10;
  }

  /**
  * Execute the alignment
  * @instance
  * @param {Object} inputs
  * @param {Object} inputs.query - Query Sequence
  * @param {Object} inputs.reference - Reference Sequence
  * @returns {Object} SmithWatermanResults - returns an object of executing and reteiving smithwaterman alignments
  * @memberof aligner.SmithWatermanAligner
  */
  align (inputs) {
    let qrev = inputs.query.rc();
    let Hpos = this._align_basics({query:inputs.query,reference:inputs.reference});
    let Hneg = this._align_basics({query:qrev,reference:inputs.reference});
    return new SmithWatermanResults(Hpos,inputs.query,inputs.reference,Hneg,qrev);
  }
  _align_basics (inputs) {
    // take {query:squence,reference:sequence} as inputs
    // output a smithwaterman result
    var seq1 = inputs.query;
    var seq2 = inputs.reference;
    var H;
    H = new Matrix(seq1.length,seq2.length);
    H.zero();
    for (let i = 0; i < H.rows; i++) {
      for (let j= 0; j < H.columns; j++) {
        H[i][j] = Math.max(
                    SmithWatermanAligner._diag_score(H,i,j)+
                     this._match_score(seq1.get_nt(j),seq2.get_nt(i)),
                    Math.max.apply(Math,this._row_scores(H,i,j)),
                    Math.max.apply(Math,this._col_scores(H,i,j)),
                    0);
      }
    }
    // Now H has been scored.
    return H;
  }
  static _diag_score (H, m, n) {
    if (m-1 < 0 || n-1 < 0) { return 0; } // edge
    return H[m-1][n-1];
  }
  _match_score (c1,c2) {
    // not sure how best to handle N base.
    if (c1===c2) { return this.params['match']; }
    return this.params['mismatch'];
  }
  _row_scores (H, i, j) {
    var oscores = [];
    var bottom = 0;
    if (i===0) {
      oscores.push(0);
      return oscores;
    }
    if (i-this.params['max_gap'] > 0) { bottom = i-this.params['max_gap']; }
    for (let m = bottom; m < i; m++) {
      oscores.push(
       H[m][j]+this.params['gap_open']+(i-m-1)*this.params['gap_extend']);
    }
    return oscores;
  }
  _col_scores (H, i, j) {
    var oscores = [];
    var bottom = 0;
    if (j===0) { 
      oscores.push(0);
      return oscores;
    }
    if (j-this.params['max_gap'] > 0) { bottom = j - this.params['max_gap']; }
    for (let n = bottom; n < j; n++) {
      oscores.push(
       H[i][n]+this.params['gap_open']+(j-n-1)*this.params['gap_extend']);
    }
    return oscores;
  }
}

/**
* A single alignment from among Smith-Waterman aligner results. This is not created by the the user. It is created by SmithWatermanResults
* @class
* @param {Object} options - These must be set when generating an the alignment
* @param {Object} options.qmap
* @param {Object} options.rmap
* @param {Object} options.reference
* @param {Object} options.direction
* @param {Object} options.score
* @extends GenericAlignment
* @memberof aligner.private
*/
class SmithWatermanAlignment extends GenericAlignment {
  // The class derive from a smith waterman alignment
  // Takes four things in the constructor to create it
  // 'qmap', and 'rmap' the alignment bed arrays
  // and the two sequences 'query' and 'reference'
  // 'direction' is - if the query was reverse complimented
  // optionally take the 'score'
  constructor (options) {
    if (! options) options = {};
    super(options);
    this._qmap = options.qmap;
    this._rmap = options.rmap;
    this._qseq = options.query;
    this._rseq = options.reference;
    this._direction = options.direction;
    this._sw_score = options.score;
  }

  /**
  * getter, but Quality is not set and not available
  * @instance
  * @returns {undefined} undefined
  * @memberof aligner.private.SmithWatermanAlignment
  */
  get qual () {
    return undefined;
  }

  /**
  * getter for name of Query
  * @instance
  * @returns {String} qname
  * @memberof aligner.private.SmithWatermanAlignment
  */
  get qname () {
    return this._qseq.name;
  }
  get _map () {
    return {query:this._qmap,reference:this._rmap};
  }

  /**
  * getter for name of Reference
  * @instance
  * @returns {String} rname
  * @memberof aligner.private.SmithWatermanAlignment
  */
  get rname () {
    return this._rseq.name;
  }

  /**
  * getter for length of the reference (target) sequence
  * @instance
  * @returns {Number} tlen
  * @memberof aligner.private.SmithWatermanAlignment
  */
  get tlen () {
    return this._rseq.length;
  }

  /**
  * getter for query sequence
  * @instance
  * @returns {Object} Sequence
  * @memberof aligner.private.SmithWatermanAlignment
  */
  get qseq () {
    // this will be the reverse complement of the query sequence
    // if direction is negative
    return this._qseq;
  }

  /**
  * getter for reference sequence
  * @instance
  * @returns {Object} Sequence
  * @memberof aligner.private.SmithWatermanAlignment
  */
  get rseq () {
    return this._rseq;
  }

  // Functions that can be called on any alignment but can also be overriden
  /**
  * getter for direction
  * @instance
  * @returns {String} direction - Strand +/-
  * @memberof aligner.private.SmithWatermanAlignment
  */
  get direction () {
    // If - then qseq has been reverse complemented for this
    return this._direction;
  }
}
