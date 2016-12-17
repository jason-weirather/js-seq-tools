"use strict";
const Bed = require('./range.js').Bed;
const map_to_gpd_line = require('./formats/mapping/GPD.js').map_to_gpd_line;

class GenericMapping {
  // A generic mapping object
  constructor (options) {
    // must recieve a map
    if (! options.inmap) throw new Error('You should not be able to call this without map');
    this._map = options.inmap;
    if (options.direction) this._direction = options.direction;
    if (options.name) this._name = options.name;
    this._range = undefined; //cache
  }
  smooth (min_intron) {
    // Return a new mapping object with idels removed
    var o = [];
    var buf = this._map[0].copy(); // do copies so you dont modify other objects
    for (let i=1; i < this._map.length; i++) {
      let cur = this._map[i].copy();
      if (cur.distance(buf) <= min_intron) { // combine
        buf.end = cur.end;
      } else {
       o.push(buf)
       buf = cur 
      }
    }
    o.push(buf);
    return new GenericMapping({inmap:o,name:this.name,direction:this.direction});
  }
  get name () {
    return this._name;
  }
  get refName () {
    return this._map[0].chr;
  }
  get direction () {
    return this._direction;
  }
  get length () {
    // sum up the lengths of the beds
    return this._map.map(x=>x.length).reduce((pre,cur) => pre+cur,0);
  }
  get exonCount () {
    return this._map.length;
  }
  get range () {
    if (this._range) return this._range;
    this._range = new Bed(this._map[0].chr,this._map[0].start,this._map[this._map.length-1].end);
    return this._range;
  }
  gpd_line (options) {
    // leave the details to the formats to the GPD package
    return map_to_gpd_line(this,options);
  }
}

class AlignmentDerivedMapping extends GenericMapping {
  // A type of mapping object produced by the Alignment class
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
}

exports.AlignmentDerivedMapping = AlignmentDerivedMapping;
