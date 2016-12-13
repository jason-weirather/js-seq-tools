"use strict";

class Matrix {
  constructor (m,n) {
    this.rows = m;
    this.columns = n;
    for (let i = 0; i < this.rows; i++) {
      this[i] = [];
      for (let j = 0; j < this.columns; j++) {
        this[i][j] = undefined;
      }
    }
  }
  dim () { return {m:this.rows,n:this.columns}; }
  zero () {
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.columns; j++) {
        this[i][j] = 0;
      }
    }
  }
  toString () {
    var ostr = '';
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.columns; j++) {
        ostr += this[i][j]+" ";
      }
      ostr += "\n";
    }
    return ostr;
  }
}

exports.Matrix = Matrix;
