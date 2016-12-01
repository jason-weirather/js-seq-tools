#!/usr/bin/env nodejs
"use strict";

const ST = require('../index.js');
var ostr;

ostr =  "Welcome to the seq-tools package test.\n";
ostr += "by Jason L Weirather, Ph.D.\n";
ostr += "The purpose of this package is to provide JavaScript solutions for bioinformatics tasks.\n\n";
ostr += "seq-tools is free to use and modify under the Apache 2.0 license\n";
console.log(ostr);

var nse = new ST.simulate.emit.NucleotideSequenceEmitter;
var tlen = 10;
var seq1 = nse.sequence(tlen);
var seq2 = ST.sequence.NucleotideSequence.concat(seq1, seq1.rc());

console.log("\nTesting nucleotides:");
console.log('Random '+tlen+' bp sequence '+seq1);
console.log('Random '+tlen+' bp sequence concatonated with and its RC '+seq2);
var seq3 = seq2.slice(tlen,tlen*2).rc();
if (seq3.equals(seq1)) {
  console.log('Equality check, RC and slice pass.');
} else {
  throw "ERROR: test failed on slice and RC\n";
}
if (seq3.length !== tlen) {
  throw "ERROR: length fail\n";
} else { console.log('Length pass '+seq3.length); }

console.log('Testing formats');

var bgzf = ST.formats.compression.bgzf.bgzf_test();
console.log(bgzf);
