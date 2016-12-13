"use strict";

class Range {
  constructor(n1,n2) {
    if (this.end <= this.start) throw new Error('start needs to come before end');
    this.start = n1; // 0-indexed
    this.end = n2;   // 1-indexed
  }
  overlaps (rng2) {
    if (this.start <= rng2.start && this.end >= rng2.end) return true;
    if (this.start >= rng2.start && this.end <= rng2.end) return true;
    if (this.start <= rng2.start && this.end-1 >= rng2.start) return true;
    if (this.start <= rng2.end-1 && this.end >= rng2.end-1) return true;
    if (rng2.start <= this.start && rng2.end-1 >= this.start) return true;
    if (rng2.start <= this.end-1 && rng2.end-1 >= this.end-1) return true;
    return false;
  }
  // works for any range
  get length () {
    return this.end-this.start;
  }

}
class Bed extends Range {
  constructor(chr,start,end,payload) {
    // Take either chr, start, end, payload (optional)
    // or a bed line
    if (start === undefined) {
        let f = chr.replace('\s+$','').split("\t");
        super(Math.floor(f[1]),Math.floor(f[2]));
        chr = f[0];
        if (f.length > 3) payload = f.slice(3,f.length).join("\t");
    } else {
        super(start,end);
    }
    this.payload = payload;
    this.chr = chr;
  }
}

exports.Range = Range;
exports.Bed = Bed;
