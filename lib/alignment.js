"use strict";

class SmithWatermanAligner {
  constructor () {
    this.params = {}
    this.params['match'] = 2;
    this.params['mismatch'] = -1;
    this.params['gap_open'] = -1;
    this.params['gap_extend'] = -1;
    this.params['max_gap'] = 10;
  }
  align (seq1, seq2) {
    var H;
    H = new Matrix(seq1.length,seq2.length);
    H.zero();
    console.log(H+'');
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
  }
  static _diag_score (H, m, n) {
    if (m-1 < 0 || n-1 < 0) { return 0; } // edge
    return H[m-1][n-1];
  }
  _match_score (c1,c2) {
    // not sure how best to handle N base.
    if (c1==c2) { return this.params['match']; }
    return this.params['mismatch'];
  }
  _row_scores (H, i, j) {
    var oscores = [];
    var bottom = 0;
    if (i==0) {
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
    if (j==0) { 
      oscores.push(0);
      return oscores;
    }
    if (j-this.params['max_gap'] > 0) { bottom = j - this.params['max_gap']; }
    for (let n = bottom; n < j; n++) {
      oscores.push(H[i][n]+this.params['gap_open']+(j-n-1)*this.params['gap_extend']);
    }
  }
}

class Alignment {
  // A condensed storage for nucleotide sequences
  constructor () {
  }
}
