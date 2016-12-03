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
  console.log(args);
  //var zip = bgzf.createBGZFCompress({level:args.level});
  //inf.pipe(zip).pipe(of);

}

var do_inputs = function () {
  var parser = new ArgumentParser({
    version:'0.0.1',
    addHelp:true,
    description:'BGZF compress a file.'
  });

  //Add arguments
  parser.addArgument(['input'],{help:"File to compress or - for STDIN"});
  parser.addArgument(['-o','--output'],{help:"Specify a file, otherwise output to STDOUT"});
  parser.addArgument(['-l','--level'],{help:"Set compression level",type:'int',default:9});
  var args =  parser.parseArgs();
  return args;
}

// Do the things
var args = do_inputs();
main(args);
