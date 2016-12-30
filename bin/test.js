#!/usr/bin/env nodejs
"use strict";

const ST = require('../index.js');
var ostr;

ostr =  "=== Welcome to the seq-tools package test.\n";
ostr += "=== by Jason L Weirather, Ph.D.\n";
ostr += "=== The purpose of this package is to provide JavaScript\n" 
ostr += "=== solutions for bioinformatics tasks.\n";
ostr += "===\n";
ostr += "=== seq-tools is free to use and modify under the Apache 2.0 license\n";
console.log(ostr);

// BEGIN TEST Simulate Sequences
console.log("1. NUCLEOTIDE SEQUENCE GENERATION");
var ran = new ST.random.RandomSeeded({seed:1});
var nse = new ST.simulate.emit.NucleotideSequenceEmitter({random:ran});
var tlen = 100;
var seq1 = nse.sequence(tlen);
var exp1 = 'ATTTCTTTCTCGCCCGAAGGGTGTAGTTGTTAATATTGTCATCGGGTCTATTTGCCGTCGTAACTATGCAGCGCGACGCTACCGGACACTTCTTGACGTT';
if (seq1.toString() !== exp1) throw new Error("-- FAIL -- seeding random is not producing expected deterministic output");
else console.log("-- PASS -- Nucleotide sequence simulation");
var exp2 = 'AACGTCAAGAAGTGTCCGGTAGCGTCGCGCTGCATAGTTACGACGGCAAATAGACCCGATGACAATATTAACAACTACACCCTTCGGGCGAGAAAGAAAT';
var seq2 = seq1.rc();
if (seq2.toString() !== exp2) throw new Error("-- FAIL -- reverse complement failure");
else console.log("-- PASS -- Reverse complement pass");
var seq3 = seq2.permute({rate:0.1,random:ran});
var exp3 = 'AACGTCAAAAAGTGTCCGGTACCGTCGCGCTGCATAGTTACGACGTGCTAATAGAGCCGATGAGAATATTGACAACTCCCCTCGGACGAGAAAGAAAT';
if (seq3.toString() !== exp3) throw new Error ("-- FAIL -- problem with purmting sequence\n");
else console.log("-- PASS -- Nucleotide permutation");
// Test alignment
var aligner = new ST.aligner.SmithWatermanAligner();
seq1.name = 'Rseq';
seq3.name = 'Qseq';
var aln = aligner.align({reference:seq1,query:seq3}).get_entry(0);
var alnstr = aln.pretty_print().split("\n");
//console.log(alnstr[1]);
console.log("\n2. NUCLEOTIDE ALIGNMENT");
var exp4 = 'Q - 1: ATTTCTTTCTCGTCCGAGGGG--A-GTTGTCAATATTCTCATCGGCTCTA';
if (alnstr[1] !== exp4) throw new Error ("-- FAIL -- problem with alignment");
else console.log("-- PASS -- Alignment is okay");
//console.log(aln.sam_line);
var exp4 ='Qseq	16	Rseq	1	255	21M2D1M1D31M1I42M2S	*	0	100	ATTTCTTTCTCGTCCGAGGGGAGTTGTCAATATTCTCATCGGCTCTATTAGCACGTCGTAACTATGCAGCGCGACGGTACCGGACACTTTTTGACGTT	*';
if (exp4 !== aln.sam_line) throw new Error ("-- FAIL-- problem making expected sam line");
else console.log("-- PASS -- Made sam line succesfully");
// try to load sam into an object
var sam = new ST.formats.alignment.sam.SAM({sam_line:aln.sam_line});
if (sam.sam_line !== aln.sam_line) throw new Error("-- FAIL -- problem reading sam line into sam object"); 
else console.log("-- PASS -- Loaded sam line into sam object");
console.log(sam.to_query_map());
