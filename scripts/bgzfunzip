#!/usr/bin/env node
const ArgumentParser = require('argparse').ArgumentParser;
const bgzf = require('../index.js').formats.compression.bgzf;
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
  var zip = bgzf.createBGZFDecompress();
  inf.pipe(zip).pipe(of);
}

var do_inputs = function () {
  var parser = new ArgumentParser({
    version:'0.0.1',
    addHelp:true,
    description:'BGZF decompress a file.',
    formatterClass:ArgumentParser.ArgumentsDefaultsHelpFormatter
  });

  //Add arguments
  parser.addArgument(['input'],{help:"File to compress or - for STDIN"});
  parser.addArgument(['-o','--output'],{help:"Specify a file, otherwise output to STDOUT"});
  var args =  parser.parseArgs();
  return args;
}

// Do the things
var args = do_inputs();
main(args);
