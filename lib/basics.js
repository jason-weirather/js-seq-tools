"use strict";

/**
* basic objects of universal importance
* @namespace basics
*/

/**
* @class
* @param {Number} m - number of rows
* @param {Number} n - number of columns
* @memberof basics
*/
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

  /**
  * Get the dimensions of the matrix
  * @returns {Object} dimensions object with m and n properties
  * @instance
  * @memberof basics.Matrix
  */
  dim () { return {m:this.rows,n:this.columns}; }

  /**
  * Set all elements of the matrix to zero
  * @instance
  * @memberof basics.Matrix
  */
  zero () {
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.columns; j++) {
        this[i][j] = 0;
      }
    }
  }

  /**
  * Get a string with what the matrix looks like
  * @instance
  * @returns {String} output value
  * @memberof basics.Matrix
  */
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
