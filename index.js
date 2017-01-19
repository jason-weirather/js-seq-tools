// This is the entrypoint where we export our various modules
// lets try and set these up by our directoy structure here

const SEQTOOLS = {
  streams:require('./lib/streams'),
  alignment:require('./lib/alignment.js'),
  aligner:require('./lib/aligner.js'),
  graph:require('./lib/graph.js'),
  mapping:require('./lib/mapping.js'),
  random:require('./lib/random.js'),
  range:require('./lib/range.js'),
  sequence:require('./lib/sequence.js'),
  simulate: {  
    emit:require('./lib/simulate/emit.js'),
    permute:require('./lib/simulate/permute.js'),
    transcriptome:require('./lib/simulate/transcriptome.js')
            },
  formats: {  
    compression: {
    bgzf:require('./lib/formats/compression/bgzf.js'),
                 },
    alignment: {
    bam:require('./lib/formats/alignment/bam.js'),
    sam:require('./lib/formats/alignment/sam.js')
                },
    mapping: {
    GPD:require('./lib/formats/mapping/GPD.js'),
    GFF:require('./lib/formats/mapping/GFF.js')
             },
    sequence: {
      fasta:require('./lib/formats/sequence/fasta.js')
              }
            }
}

module.exports = SEQTOOLS;
