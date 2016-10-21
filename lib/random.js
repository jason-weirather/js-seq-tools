"use strict";
const _NTS = ['A','C','G','T'];
const _MAX = Math.pow(2,32);
class RandomSeeded {
  constructor (seed) {
    if (!seed) { seed = Math.floor(_MAX*Math.random()); }
    this._seed = seed+101;
  }
  random () {
    let x = Math.sin(this._seed++)*10000;
    return x - Math.floor(x);
  }
  choice (arr) {
    return arr[Math.floor(arr.length*this.random())]
  }
  nucleotide () {
    return this.choice(_NTS);
  }
}
