#!/usr/bin/env node
const ArgumentParser = require('argparse').ArgumentParser;
const bam = require('../index.js').formats.alignments.bam;
const fs = require('fs');

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
  var bamconv = bam.createBAMInputStream();
  inf.pipe(bamconv).on('data',function (indata) {
    if (indata.header) { of.write(''+indata.header+"\n"); }
    if (indata.bam) { of.write(''+indata.bam+"\n"); }
  });
}

var do_inputs = function () {
  var parser = new ArgumentParser({
    version:'0.0.1',
    addHelp:true,
    description:'Convert a BAM to a SAM file.',
    formatterClass:ArgumentParser.ArgumentsDefaultsHelpFormatter
  });

  //Add arguments
  parser.addArgument(['input'],{help:"BAM to extract or - for STDIN"});
  parser.addArgument(['-o','--output'],{help:"Specify a file, otherwise output to STDOUT"});
  var args =  parser.parseArgs();
  return args;
}

// Do the things
var args = do_inputs();
main(args);
