#!/usr/bin/env node
"use strict";
// READ A SAM FILE OUTPUT A BAM FILE
// PRE: A file, or STDIN
// POST: Write either a bam file or stream bam to STDOUT

const ArgumentParser = require('argparse').ArgumentParser;
const bgzf = require('../index.js').formats.compression.bgzf;
const sam = require('../index.js').formats.alignment.sam;
const fs = require('fs');
const Writable = require('stream').Writable;

var main = function (args) {
  // Setup Inputs
  var inf = process.stdin;
  if (args.input !== '-') {
    inf = fs.createReadStream(args.input);
  }
  // Setup Outputs
  var bgzfz = new bgzf.BGZFCompress();
  var of;
  if (args.output!=='-') {
    of = bgzfz.pipe(fs.createWriteStream(args.output));
  } else {
    of = bgzfz.pipe(process.stdout);
  }
  //var bamconv = new bam.BAMInputStream();
  var samconv = new sam.DataToSAMObj();
  inf.pipe(samconv).on('data',function (indata) {
    //console.log(samconv._z+' '+samconv._c+' hi');
    //console.log(indata);
    if (indata.header) { 
      bgzfz.write(indata.header.bam_data); 
    }
    else if (indata.sam) { 
      //indata.sam.toString();
      //console.log(indata.sam._sam_line);
      bgzfz.write(indata.sam.bam_data); 
    }
    //let b = new Buffer(5);
    //b.write('tapir');
    //bgzfz.write(b);
  });
  samconv.on('end',function() {
     //console.log('end');
     bgzfz.end();
     if (args.output!=='-') { of.end(); }
  });
}


var do_inputs = function () {
  var parser = new ArgumentParser({
    version:'0.0.1',
    addHelp:true,
    description:'Convert a SAM to a BAM file.',
    formatterClass:ArgumentParser.ArgumentsDefaultsHelpFormatter
  });

  //Add arguments
  parser.addArgument(['input'],{help:"BAM to extract or - for STDIN"});
  parser.addArgument(['-o','--output'],{help:"REQUIRED Specify a file, otherwise use - to STDOUT",required:true});
  var args =  parser.parseArgs();
  return args;
}

// Do the things
var args = do_inputs();
main(args);
