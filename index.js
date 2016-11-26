// This is the entrypoint where we export our various modules
// lets try and set these up by our directoy structure here
const SEQTOOLS = {
  alignment:require('./lib/sequence.js'),
  sequence:require('./lib/sequence.js'),
  random:require('./lib/random.js'),
  simulate: {  
    emit:require('./lib/simulate/emit.js')
            },
  formats: {  
    compression: {
    bgzf:require('./lib/formats/compression/bgzf.js'),
    gzip:require('./lib/formats/compression/gzip.js')
                  }
            }
}

module.exports = SEQTOOLS;
