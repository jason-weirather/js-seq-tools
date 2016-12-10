#!/usr/bin/env node
"use strict";
const ArgumentParser = require('argparse').ArgumentParser;
const bgzf = require('../index.js').formats.compression.bgzf;
const bam = require('../index.js').formats.alignment.bam;
const fs = require('fs');

// SIMILAR TO SAMTOOLS VIEW IN FUNCTION
// INPUT: EITHER SAM OR BAM (default BAM)
// OUTPUT: EITHER SAM OR BAM (default SAM)


var main = function (args) {
  // Setup Inputs
  var inf = process.stdin;
  if (args.input !== '-') {
    inf = fs.createReadStream(args.input);
  }
  // Setup Outputs
  var of = process.stdout;
  if (args.output) {
    of = fs.createWriteStream(args.output);
  }
  //var bamconv = new bam.BAMInputStream();
  var bgzfun = new bgzf.BGZFDecompress();
  var bamconv = new bam.DecompressedToBAMObj();
  inf.pipe(bgzfun).pipe(bamconv).on('data',function (indata) {
    if (indata.header && (args.header || args.header_only)) { 
      of.write(''+indata.header+"\n"); 
      if (args.header_only) {
        this.push(null);
        return;
      }
    }
    if (indata.bam) { 
      let use_this = true;
      if (args.flag_remove || args.flag_retain) {
        let check;
        if (args.flag_retain) { 
          check = indata.bam.flag & args.flag_retain;
          use_this = false; 
        } else if (args.flag_remove) {
          check = indata.bam.flag & args.flag_remove;
          use_this = true;
        }
        //console.log(indata.bam.flag);
        //console.log(args.flag_remove);
        if (check !== 0 && args.flag_remove) {
          use_this = false;
        }
        if (check !== 0 && args.flag_retain) {
          use_this = true;
        }
      }
      if (use_this) of.write(''+indata.bam+"\n"); 
    }
  });
}

var do_inputs = function () {
  var parser = new ArgumentParser({
    version:'0.0.1',
    addHelp:true,
    description:'Read/Write a BAM or SAM file.',
    formatterClass:ArgumentParser.ArgumentsDefaultsHelpFormatter
  });

  //Add arguments
  parser.addArgument(['input'],{help:"BAM to extract or - for STDIN"});
  parser.addArgument(['-o','--output'],{help:"Specify a file, otherwise output to STDOUT"});
  parser.addArgument(['-b','--bam_output'],{help:"Output in bam format"});
  parser.addArgument(['-t','--header'],{help:"Include the header",action:'storeTrue'});
  parser.addArgument(['-T','--header_only'],{help:"Only output the header",action:'storeTrue'});
  parser.addArgument(['-f','--flag_retain'],{help:"remove entries with this flag set",type:'int'});
  parser.addArgument(['-F','--flag_remove'],{help:"retain entries with this flag set",type:'int'});
  parser.addArgument(['-S','--sam_input'],{help:"input is a SAM format"});
  var args =  parser.parseArgs();
  return args;
}

// Do the things
var args = do_inputs();
main(args);
