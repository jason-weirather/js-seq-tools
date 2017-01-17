"use strict";
const Bed = require('./range.js').Bed;
const BedArray = require('./range.js').BedArray;
const map_to_gpd_line = require('./formats/mapping/GPD.js').map_to_gpd_line;
const map_to_GFF2 = require('./formats/mapping/GFFBasic.js').map_to_GFF2;
const gene_to_GFF3 = require('./formats/mapping/GFFBasic.js').gene_to_GFF3;

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
  constructor (gene,options) {
    if (! options) options = {};
    this._gene = gene;
    // make a catalog of exons
    this._unique_exons = this._gene.unique_exons.entries.map(function(x) {
      return {exon:x.copy(),transcripts:[]};
    });
    // Find which transcripts each exon is a member of
    for (let e of this._unique_exons) {
      let txs = this._gene.transcripts.filter(x=>
        x.exons.filter(y=>y.equals(e.exon)).length>0
      );
      e.transcripts = txs;
    }
    // Find retained introns
    let retained_introns = [];
    let not_retained_introns = [];
    let ue = this._unique_exons;
    for (let e of this._unique_exons.map(x=>x.exon)) {
      // Check all other exon pairs
      let evidence = 0;
      for (let e1 of this._unique_exons.map(x=>x.exon)) {
        if (e.equals(e1)) continue;
        for (let e2 of this._unique_exons.map(x=>x.exon)) {
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
    retained_introns = (new BedArray(retained_introns)).unique().entries;
    not_retained_introns = (new BedArray(not_retained_introns)).unique().entries;
    // retained_introns now has all the exons with retained introns
    // not_retained_introns
    console.log('normal: '+not_retained_introns.length);
    console.log('retained: '+retained_introns.length);
    for (let x of retained_introns) {
      console.log(x.valueOf());
    }
  }
}

exports.SpliceAnalysis = SpliceAnalysis;
