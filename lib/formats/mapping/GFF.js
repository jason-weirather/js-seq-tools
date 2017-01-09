"use strict";

// GTF and GFF files contain many mappings
class GFFTranscript {
  constructor (transcript,options) {
    if (! options) options = {};
    this._transcript = transcript;
    this.source = options.source;
    this.score = options.score;
    this.phase = options.phase;
  }
  get GFF2_lines () {
    let o = [];
    let l1 = this.transcript.refName+"\t"+this.source+"\tmRNA\t";
    l1 += (this.transcript.range.start+1)+"\t";
    l1 += this.transcript.range.end+"\t";
    // check here, and on the transcript for score
    if (this.score !== undefined) l1 += this.score+"\t";
    else if (this.transcript.score !== undefined) l1 += this.transcript.score+"\t";
    else l1 += ".\t";
    if (this.transcript.direction) l1 += this.transcript.direction+"\t";
    else l1 += ".\t";
    // check for phase
    if (this.phase !== undefined) l1 += this.phase+"\t";
    else if (this.transcript.phase !== undefined) l1 += this.transcript.phase+"\t";
    else l1 += ".\t";
    let group =  'gene_id "'+this.transcript.gene_name+'"; transcript_id "'+this.transcript.transcript_name+'";';
    l1 += group;
    // Got the first line
    o.push(l1);
    // Now do exons
    for (let i = 0; i < this.transcript.exonCount; i++) {
      let ln = this.transcript.refName + "\t" + this.source + "\texon\t";
      ln += (this.transcript.exons[i].start+1)+"\t";
      ln += (this.transcript.exons[i].end)+"\t";
      if (this.transcript.exons[i].score) ln += this.transcript.exons[i].score+"\t";
      else ln += ".\t";
      if (this.transcript.direction) ln += this.transcript.direction+"\t";
      else ln += ".\t";
      ln += group+' exon_number "'+(i+1)+'";';
      o.push(ln);
    }
    return o;
  }
  get transcript () {
    return this._transcript;
  }
}

class GFF2  {
  constructor (options) {
    if (! options) options = {};
    this.source = options.source;
    this._transcripts = [];
  }
  add_transcript (inmapping) {
    if (! inmapping.name) throw new Error('need transcript name to add transcript');
    if (! inmapping.gene_name) throw new Error('need gene name to add transcript');
    this._transcripts.push(new GFFTranscript(inmapping,this.source));
    //if (! inmapping.name)
  }
  //set transcripts (inmappings) {
  //  // set all the mappings (overwrites)
  //  this._transcripts = inmappings;
  //}
  [Symbol.iterator]() {
    // Make the iterator of a GFF be the lines
    let index = 0;
    let buffer = [];
    return {
      next: () => {
        let res = undefined;
        // try to get another value
        if (buffer.length > 0) {
        } else if (index < this._transcripts.length) {
          buffer = this._transcripts[index].GFF2_lines;
          index += 1;
        } else return {done:true};
        res = buffer.shift();
        return {value:res,done:false};
      }
    }
  }
}

class GTF extends GFF2 {
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
}


exports.GFF2 = GFF2;
exports.GTF = GTF;
