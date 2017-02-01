"use strict";
const _NTS = ['A','C','G','T'];
const _MAX = Math.pow(2,32);

/**
* classes for generating random sequences or other randomness
* @namespace random
*/

/**
* @class
* @memberof random
*/
class RandomSeeded {
  constructor (options) {
    if (! options) options = {};
    if (options.seed) { this._seed = options.seed+101; }
  }
  random () {
    // IMPORTANT All methods of RandomSeeded must use this as the generator.
    if (! this._seed) return Math.random();
    // adapted from stackoverflow.com/questions/521295/javascript-random-seeds answer
    let x = Math.sin(this._seed++)*1000000;
    return x - Math.floor(x);
  }
  choice (arr) {
    return arr[Math.floor(arr.length*this.random())];
  }
  weighted_choice (arr, weights) {
    // the first array arr is what to choose from
    // the second array weights is the weights, must be positive numbers
    let weightsum = weights.filter(x => x > 0).reduce(function(x,y) { return x+y; });
    let cumulative = 0;
    let rnum = this.random();
    for (let i = 0; i < weights.length; i++) {
      if (weights[i] <= 0) continue;
      cumulative += weights[i]/weightsum;
      if (cumulative > rnum) return arr[i];
    }
    throw new Error("Error no positive weights in your weighting array");
  }
  randInt(min,max) {
    return Math.floor(this.random()*(max-min)+min);
  }
  uuid4 () {
    return new uuid4({random:this});
  }
}

/**
* @class
* @memberof random
*/
class uuid4 {
  // Without options it should act as a true uuid4
  constructor(options) {
    if (! options) options = {};
    if (! options.random) this._random = new RandomSeeded();
    else this._random = options.random;
    // Go ahead and set it up.  when we make one we make one.
    this._data = Buffer(16);
    for (let i = 0; i < 16; i++) { // fill out the byte array
      this._data.writeUInt8(this._random.randInt(0,256),i);
    }
    this._data.writeUInt8((0x0F & this._data.readUInt8(6)) | 0x40,6); // this is certain
    let c = this._random.choice([8,9,10,11]) <<4;
    this._data.writeUInt8((0x0F & this._data.readUInt8(8)) | c,8);
  }
  toString () {
    var ostr = '';
    ostr += this._data.slice(0,4).toString('hex')+'-';
    ostr += this._data.slice(4,6).toString('hex')+'-';
    ostr += this._data.slice(6,8).toString('hex')+'-';
    ostr += this._data.slice(8,10).toString('hex')+'-';
    ostr += this._data.slice(10,16).toString('hex');
    return ostr;
  }
  get bytes () {
    return this._data;
  }
}

exports.uuid4 = uuid4;
exports.RandomSeeded = RandomSeeded;
