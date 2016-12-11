#!/usr/bin/env node
"use strict";
const ArgumentParser = require('argparse').ArgumentParser;
const bgzf = require('../index.js').formats.compression.bgzf;
const bam = require('../index.js').formats.alignment.bam;
const sam = require('../index.js').formats.alignment.sam;
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
  var of;
  var outfile = process.stdout;
  if (args.output) outfile = fs.createWriteStream(args.output);
  let bgzfz;
  if (args.bam_output) {
    // bamoutput
    bgzfz = new bgzf.BGZFCompress();
    of = bgzfz.pipe(outfile);
  } else {
    // basic non-bam output
    of = outfile;
  }

  let p;
  var samconv;
  var bgzfun;
  var bamconv;
  if (args.sam_input) { 
    samconv = new sam.DataToSAMObj();
    p = inf.pipe(samconv);
  } else { 
    bgzfun = new bgzf.BGZFDecompress();
    bamconv = new bam.DecompressedToBAMObj(); 
    p = inf.pipe(bgzfun).pipe(bamconv);
  }
  p.on('data',function (indata) {
    // do our header if we are on our header
    if (args.bam_output && indata.header) {  
      // if its a bam output we always need header
      bgzfz.write(indata.header.bam_data);
    } else if (indata.header && (args.header || args.header_only)) { 
      of.write(''+indata.header); 
      if (args.header_only) {
        this.push(null);
        return;
      }
    }
    // Do our data for sam or bam if we have it
    if (indata.bam || indata.sam) { 
      let data = indata.bam || indata.sam;

      // see if we need to filter it based on flags
      let use_this = true;
      if (args.flag_remove || args.flag_retain) {
        let check;
        if (args.flag_retain) { 
          check = data.flag & args.flag_retain;
          use_this = false; 
        } else if (args.flag_remove) {
          check = data.flag & args.flag_remove;
          use_this = true;
        }
        if (check !== 0 && args.flag_remove) {
          use_this = false;
        }
        if (check !== 0 && args.flag_retain) {
          use_this = true;
        }
      }

      // check for filter condition and output
      if (use_this) {
        if (! args.bam_output) of.write(''+data+"\n"); 
        else bgzfz.write(data.bam_data);
      } 
    }
  });
  // in the a case of bam listen for when to close out or writing pipes.
  if (args.bam_output) {
    let conv = bgzfun || samconv;
    conv.on('finish',function () {
      bgzfz.end();
    });
  }
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
  parser.addArgument(['-b','--bam_output'],{help:"Output in bam format",action:'storeTrue'});
  parser.addArgument(['-t','--header'],{help:"Include the header",action:'storeTrue'});
  parser.addArgument(['-T','--header_only'],{help:"Only output the header",action:'storeTrue'});
  parser.addArgument(['-f','--flag_retain'],{help:"remove entries with this flag set",type:'int'});
  parser.addArgument(['-F','--flag_remove'],{help:"retain entries with this flag set",type:'int'});
  parser.addArgument(['-S','--sam_input'],{help:"input is a SAM format",action:'storeTrue'});
  var args =  parser.parseArgs();
  return args;
}

// Do the things
var args = do_inputs();
main(args);
