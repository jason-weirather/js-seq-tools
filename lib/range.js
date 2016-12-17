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
  distance (rng2) {
    if (this.overlaps(rng2)) return 0;
    if (this.end < rng2.start+1) return rng2.start-this.end;
    if (this.start+1 > rng2.end) return this.start-rng2.end;
    throw new Error('Unchecked distance compare');
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
  copy () {
    return new Bed(this.chr,this.start,this.end,this.payload);
  }
  distance (rng2) {
    if (this.chr != rng2.chr) return Infinity; 
    return Range.prototype.distance.call(this,rng2);
  }
  overlaps (rng2) {
    if (this.chr != rng2.chr) return false; 
    return Range.prototype.overlaps.call(this,rng2);
  }
}

exports.Range = Range;
exports.Bed = Bed;
