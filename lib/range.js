"use strict";

class Range {
  constructor(n1,n2,itersize) {
    if (this.end <= this.start) throw new Error('start needs to come before end');
    this.start = n1; // 0-indexed
    this.end = n2;   // 1-indexed
    this._itersize = 1;
    if (itersize !== undefined) this._itersize = itersize;
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
  [Symbol.iterator]() {
    let index = this.start;
    let isize = this._itersize;
    return {
      next: ()=> {
        let value = index;
        if (value >= this.end) return {done:true};
        index += isize;
        return {value:value,done:false};
      }
    }
  }
}

class Bed extends Range {
  constructor(chr,start,end,options) {
    // Take either chr, start, end, payload (optional)
    // or a bed line
    if (! options) options = {};
    if (start === undefined) {
        let f = chr.replace('\s+$','').split("\t");
        super(Math.floor(f[1]),Math.floor(f[2]));
        chr = f[0];
        if (f.length > 3) payload = f.slice(3,f.length).join("\t");
    } else {
        super(start,end);
    }
    if (options.payload) {
      this.payload = options.payload;
    }
    if (options.direction) {
      this.direction = options.direction;
    }
    this.chr = chr;
    if (options.id) this._id = id;
  }
  set id (inid) { this._id = inid; }
  get id () { return this._id; }
  copy () {
    return new Bed(this.chr,this.start,this.end,this.payload);
  }
  merge (rng2) {
    if (! this.overlaps(rng2)) return undefined;
    let left = rng2.start;
    if (this.start < rng2.start) left = this.start;
    let right = rng2.end;
    if (this.end > rng2.end) right = this.end;
    return new Bed(this.chr,left, right);
  }
  distance (rng2) {
    if (this.chr != rng2.chr) return Infinity; 
    return Range.prototype.distance.call(this,rng2);
  }
  overlaps (rng2) {
    if (this.chr != rng2.chr) return false; 
    return Range.prototype.overlaps.call(this,rng2);
  }
  toString () {
    return this.chr.toString()+"\t"+this.start+"\t"+this.end+"\t"+this.payload;
  }
  valueOf () {
    return this.chr.toString()+"\t"+this.start+"\t"+this.end;
  }
  equals (x) {
    if (this.valueOf() === x.valueOf()) return true;
    return false;
  }
  static localeCompare (x,y) {
    if (x.chr !== y.chr) return x.chr.toString().localeCompare(y.chr.toString());
    if (x.start !== y.start) {
      if (x.start < y.start) return -1;
      else return 1;
    }
    if (x.end !== y.end) {
      if (x.end < y.end) return -1;
      else return 1;
    }
    return 0;
  }
}

// An object to work with bed arrays
class BedArray {
  constructor(inlist,options) {
    if (! options) options = {};
    this._beds = inlist;
    this._sorted = options.sorted;
    this._index = -1;
  }
  get entries () { return this._beds; }
  sort (sort_function) {
    // sorts in place
    if (! sort_function) sort_function = Bed.localeCompare;
    return new BedArray(this._beds.sort(Bed.localeCompare),{sorted:true});
  }
  copy () {
    let bs = [];
    for (let b of this._beds) {
      bs.push(b);
    }
    return new BedArray(bs,{sorted:this._sorted});
  }
  get size () {
    // get the sum the base pairs
    return this.entries.reduce(
      function (a,b) {
        return a+b.length;
      },
    0);
  }
  get merged () {
    // smash down different beds into a nonredundant set
    let u = this.unique();
    let prev = undefined;
    let beds = [];
    for (let e of u) {
      if (prev && e.overlaps(prev)) beds[beds.length-1] = e.merge(prev);
      else beds.push(e.copy());
      beds[beds.length-1].payload = undefined;
      prev = beds[beds.length-1];
    }
    return new BedArray(beds,{sorted:true});
  }
  unique () {
    let sa = this;
    let prev = undefined;
    if (! this._sorted) {
      sa = this.copy().sort();
    }
    // sa HAS been sorted
    let ubeds = [];
    for (let s of sa) {
      let n = s.copy();
      n.payload = 1;
      if (prev && ! s.equals(prev)) ubeds.push(n);
      else if (! prev) ubeds.push(n);
      else if (ubeds.length > 0) ubeds[ubeds.length-1].payload+=1;
      //ubeds[ubeds.lastIndexOf()].payload+=1;
      prev = s;
    }
    return new BedArray(ubeds,{sorted:true});
  }
  [Symbol.iterator]() {
    var index = -1;
    var beds = this._beds;
    return {
      next: function () {
        index += 1;
        if (index >= beds.length) return {done: true};
        return { done: false, value: beds[index]};
      }
    };
  }
}

exports.Range = Range;
exports.Bed = Bed;
exports.BedArray = BedArray;
