"use strict";
const Bed = require('./range.js').Bed;
const BedArray = require('./range.js').BedArray;
const map_to_gpd_line = require('./formats/mapping/gpd.js').map_to_gpd_line;
const map_to_GFF2 = require('./formats/mapping/gffbasic.js').map_to_GFF2;
const gene_to_GFF3 = require('./formats/mapping/gffbasic.js').gene_to_GFF3;

/**
* classes for analyzing splices and isoform composition
* @namespace splice
*/

/**
* @class
* @memberof splice
*/
class SpliceAnalysis {
  // Analyze the splice composition of a gene
  // Intron Retentions - associate each exon with whether it is an intron retention
  // Exon skipping - associate each exon with whether or not it can be skipped
  //                 relative to any overlapped exon
  // Alternate 5' start - associate each exon with whether or not its an alternative 5' start
  //                      Exon: relative to any overlapped exon that is 5'
  //                      Transcript: relative to all 5' starts
  // Alternative 3' stop - associate each exon with whether or not its an alternative 3' end
  //                       Exon: relative to any overlapped exon that is 3'
  //                       Transcript: relative to all 3' stops
  // Alternative 5' splice - whether or not any overlapped exon has a different 5' splice
  // Alternative 3' splice - whether or not any overlapped exon has a different 3' splice
  // TotallyUnique - an exon has no overlap with other exons in other transcripts
  // Identical - Exon same as another
  // PartiallyShared - Exon is partially the same as another
  // Most of those evaluations are on a per exon basis.
  constructor (gene,options) {
    if (! options) options = {};
    this._gene = gene;
    this._classified_exons = undefined; // this is cached when called with getter
    // make a catalog of exons
    this._unique_exons = this._gene.unique_exons.entries.map(function(x) {
      return {exon:x.copy(),transcripts:[]};
    });
    // Find which transcripts each exon is a member of
    for (let e of this._unique_exons) {
      e.exon.direction = this._gene.direction;
      let txs = this._gene.transcripts.filter(x=>
        x.exons.filter(y=>y.equals(e.exon)).length>0
      );
      e.transcripts = txs;
    }
  }
  describe_exon (exon) {
    //use classified exons to describe it
    return this.classified_exons.filter(x=>x.exon.equals(exon))[0];
  }
  analyze_transcripts () {
    let tes = this.analyze_transcript_ends();
    // transcript ends has the transcirpt data
    // describe exon has the specifics on individual exons
    for (let t of tes) {
      console.log(t.transcript);
    }
  }
  analyze_transcript_ends () {
    // Go through transcripts
    let fivePs = this._gene.transcripts.map(x=>x.fivePrimeBase);
    let threePs = this._gene.transcripts.map(x=>x.threePrimeBase);
    let unique_five_primes = (new BedArray(fivePs)).unique().entries;
    let unique_three_primes = (new BedArray(threePs)).unique().entries;
    let tx_count = this._gene.transcripts.length;
    let v = [];
    for (let t of this._gene.transcripts) {
      let match5 = fivePs.filter(x=>t.fivePrimeBase.equals(x)).length;
      let match3 = threePs.filter(x=>t.threePrimeBase.equals(x)).length;
      v.push(
        {transcript:t,
         totally_unique_five_prime:(match5===1),
         alternate_five_prime:(match5!==tx_count),
         only_five_prime:(match5===tx_count),
         totally_unique_three_prime:(match3===1),
         alternate_three_prime:(match3!==tx_count),
         only_three_prime:(match3===tx_count)
        }
      );
    }
    return v;
  }
  _connected_transcripts (exon) {
    // get the transcripts associated with an exon
    return this._unique_exons.filter(x=>x.exon.equals(exon))[0].transcripts;
  }
  get classified_exons () {
    if (this._classified_exons) return this._classified_exons;
    this._classified_exons = this._get_classified_exons();
    return this._classified_exons;
  }
  _get_classified_exons () {
    let ri = this.retained_introns;
    let conex = this.connected_exons;
    let ce = [];
    for (let e of this.unique_exons) {
      let exon = e;
      let retained_intron = (ri.filter(x=>x.equals(e)).length > 0);
      let children = conex.filter(x=>x.exon.equals(e))[0].children;
      let no_alternate = (children.length===0);
      let txs = this._connected_transcripts(e);
      let totally_unique = false;
      if (txs.length===1 && no_alternate) totally_unique = true;
      let fiveP = e.fivePrimeBase;
      let threeP = e.threePrimeBase;
      let alternate_fiveP = (children.map(x=>x.fivePrimeBase).filter(x=>x.equals(fiveP)).length===0);
      let alternate_threeP = (children.map(x=>x.threePrimeBase).filter(x=>x.equals(threeP)).length===0);
      ce.push({
        exon:e,
        retained_intron:retained_intron,
        no_alternate:no_alternate,
        totally_unique:totally_unique,
        alterante_five_prime:alternate_fiveP,
        alternate_three_prime:alternate_threeP
      });
    }
    return ce;
  }
  get unique_exons () {
    return this._unique_exons.map(x=>x.exon);
  }
  get retained_introns () {
    // Find retained introns
    let retained_introns = [];
    let not_retained_introns = [];
    let ue = this._unique_exons;
    for (let e of this.unique_exons) {
      // Check all other exon pairs
      let evidence = 0;
      for (let e1 of this.unique_exons) {
        if (e.equals(e1)) continue;
        for (let e2 of this.unique_exons) {
          if (e1.overlaps(e2)) continue;
          if (e1 >= e2) continue; 
          if (e.equals(e2)) continue;
          // we are on all different exons
          if (! (e.overlaps(e1) && e.overlaps(e2))) continue;
          // we are overlapping
          // they are not separate exons
          evidence+=1;
        }
      }
      // Save it if we have evidence
      if (evidence > 0) retained_introns.push(e);
      else not_retained_introns.push(e);
    }
    return (new BedArray(retained_introns)).unique().entries;
  }
  get connected_exons () {
    let exons = [];
    for (let e of this._unique_exons.map(x=>x.exon)) {
      let value = e;
      let connected = this._unique_exons.map(x=>x.exon).filter(x=>
        x.overlaps(e)
      ).filter(x=>
        ! (x.equals(e))
      );
      exons.push({exon:e,children:connected});
    }
    return exons;
  }
}

exports.SpliceAnalysis = SpliceAnalysis;
