"use strict";
const GenericEmitter = require('./emit.js').GenericEmitter;
const NucleotideSequence2Bit = require('../sequence.js').NucleotideSequence2Bit;
const RandomSeeded = require('../random.js').RandomSeeded;
const Bed = require('../range.js').Bed;
const GenericMapping = require('../mapping.js').GenericMapping;
const graph = require('../graph.js');
const _MAXSEED = 100000000;

class SimulatedGene {
  constructor (mapping,params,seed) {
    this.params = this._default_parameters();
    this.name = mapping.name;
    this.direction = mapping.direction;
    fill_in_parameters(this.params,params);
    this.seed = seed; // use the seed every time we generate one
    console.log('simulate gene');
    let rs = new RandomSeeded({seed:this.seed});
    // Get a maxmimum number of transcripts
    // The gene will not havea any more than this number of transcripts
    let num_transcripts = rs.randInt(
          this.params.transcript_count_range[0],
          this.params.transcript_count_range[1]
    );
    console.log(num_transcripts);
    // We want to try to reach the "max transcripts"
    // based on the rules we have layed out
    let max_iterations = 10;
    let candidate_txs = [];
    for (let i = 0; i < max_iterations; i++) {
      candidate_txs = this._create_transcripts(mapping,rs,num_transcripts);
      if (candidate_txs.length === num_transcripts) break; // we did it!
    }

    this._mappings = candidate_txs;
  }
  // Using the parameters that have been set up for this generation
  // Create a set of transcripts  try to reach the number layed out in
  // num_transcripts
  _create_transcripts (mapping, rs, num_transcripts) {
    let unique_transcripts = {};
    for (let i = 0; i < num_transcripts; i++) {
      // try to make some transcripts
      let tname = rs.uuid4().toString();
      let exons = [];
      let gene_exons = mapping.exons;
      for (let j = 0; j < gene_exons.length; j++) {
        // CASE 1: EXON SKIPPING
        if (rs.random() < this.params.exon_skipping_probability) {
          // skipping exon
          //console.log('skipping exon');
          continue; // easy we just don't include it
        }
        exons.push(gene_exons[j]);
        //console.log(gene_exons[j]);
      }
      if (exons.length === 0) continue;
      let tx = new SimulatedTranscriptMapping({inmap:exons,direction:mapping.direction,gene_name:mapping.name,name:tname});
      let gpdarr = tx.gpd_line().split("\t")
      let location = gpdarr.slice(2,gpdarr.lastIndexOf()).join("\t");
      unique_transcripts[location] = tx;
    }
    let ulocs = Object.getOwnPropertyNames(unique_transcripts);
    let txs = [];
    for (let i = 0; i < ulocs.length; i++) {
      let tx = unique_transcripts[ulocs[i]];
      txs.push(tx);
    }
    let g = new graph.UndirectedGraph();
    // See which ones overlap
    let nodes = {};
    for (let i = 0; i < txs.length; i++) {
      nodes[i] = new graph.Node({name:i,payload:txs[i]});
      g.add_node(nodes[i]);
    }
    for (let i = 0; i < txs.length; i++) {
      for (let j = i+1; j < txs.length; j++) {
        if(txs[i].overlaps(txs[j])) {
          g.add_edge(new graph.Edge(nodes[i],nodes[j]));
        }
      }
    }
    let gs = g.split_unconnected();
    console.log('unconnected '+gs.length);
    let largest_count = 0;
    let largest = undefined;
    for (let x of gs) {
      if (x.node_count > largest_count) {
        largest = x;
        largest_count = x.node_count;
      }
    }
    if (! largest) return [];
    return largest.nodes.map(x=>x.payload);
  }
  _default_parameters () {
    // minimum intron length needs to be greater than the sum of your longest intron signals
    let params = {
      // gene parameters
      transcript_count_range: [1,5], // we may have less than max but wont have more
      exon_skipping_probability: 0.5,
      alternate_splice_probability: 0.5,
      alternate_end_probability: 0.5,
      intron_retention_probability: 0.5
    };
    return params;
  }
  get transcript_count () {
    return this._mappings.length;
  }
  get transcripts () {
    return this._mappings;
  }
}

var fill_in_parameters = function (current_parameters, input_parameters) {
  if (Object.getOwnPropertyNames(input_parameters).length === 0) return; // Nothing in the input parameters case
  if (input_parameters && current_parameters) {  // if any parameters were set we will over-ride the
                           // defaults.  otherwise go with defaults
    let ks = input_parameters.keys();
    for (let i = 0; i < ks.length; i++) {
      current_parameters[ks[i]] = input_parameters[ks[i]];
    }
  }
}

class TranscriptomeEmitter extends GenericEmitter {
  // Generate the transcriptome definitions for a single chromosome
  constructor (options) {
    if (! options) options = {};
    super(options);
    if (! options.signal_emitter) this.signal_emitter = new SpliceSignalEmitter({random:this.random,signal_rates:options.signal_rates}); // Our super set will have this set up already
    this.params = {}
    if (options.params) this.params = options.params;
  }
  chromosome () { // Emit a chromsoome
    let schrom = new SimulatedChromosome(this.params,this.random.randInt(0,_MAXSEED));
    return schrom;
  }
}

class SimulatedChromosome {
  constructor (params,seed) {
    this.params = this._default_parameters();
    fill_in_parameters(this.params,params);
    this.seed = seed; // use the seed every time we generate one
    // set up our name, mappings and length now
    let rn = new RandomSeeded({seed:this.seed});
    this.name = rn.uuid4().toString();
    this.length = rn.randInt(
                    this.params.chromosome_length_range[0],
                    this.params.chromosome_length_range[1]);

    // Now length is set.  Lets establish the transcripts
    this._gene_mappings = this._get_mappings(this.name,this.length,rn,params);
  }
  _default_parameters () {
    // minimum intron length needs to be greater than the sum of your longest intron signals
    let params = {
      // chromosome parameters
      exon_length_range: [100,100],
      intron_length_range: [1000,1000],
      exon_count_range: [10,10],
      intergenic_length_range: [10000,10000],
      chromosome_length_range: [100000,100000],
    };
    return params;
  }
  get gene_count () {
    return this._gene_mappings.length;
  }
  _get_mappings (chrname, length, rn, params) {
    // All the locations of the genes
    let output = [];
    let pos = 0;
    while (true) {
      let gname = rn.uuid4().toString(); // Our transcript name
      pos += rn.randInt(
                    this.params.intergenic_length_range[0],
                    this.params.intergenic_length_range[1]
             );
      if (pos > length) break;
      // get our exon count
      let exon_count = rn.randInt(
                    this.params.exon_count_range[0],
                    this.params.exon_count_range[1]
      );
      let exons = [];
      for (let i = 0; i < exon_count; i++) {
        //  get our exon length
        let exon_start = pos;
        let exon_length = rn.randInt(
                    this.params.exon_length_range[0],
                    this.params.exon_length_range[1]
        );
        pos += exon_length;
        let exon_end = pos;
        let exon = new Bed(chrname,exon_start,exon_end);
        exons.push(exon);
        if (i < exon_count-1) { // We need an intron
          let intron_length = rn.randInt(
                    this.params.intron_length_range[0],
                    this.params.intron_length_range[1]
          );
          pos += intron_length;
        }
      }  // done making a transcript
      if (pos+this.params.intergenic_length_range[1] >= length) break; // get out if we have overstretched
      let direction = rn.choice(['+','-']);
      let map = new SimulatedGeneMapping({inmap:exons,direction:direction,name:gname});
      let gene = new SimulatedGene(map,params,rn.randInt(1,_MAXSEED));
      output.push(gene);
    }
    return output;
  }
  get genes () {
    return this._gene_mappings;
  }
}

class SimulatedTranscriptMapping extends GenericMapping {
  constructor (options) {
    if (! options) options = {};
    super(options);
    if (options.gene_name) this._gene_name = options.gene_name;
  }
  get gene_name () {
    return this._gene_name;
  }
  get transcript_name () {
    return this.name;
  }
}
class SimulatedGeneMapping extends GenericMapping {
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
  get gene_name () {
    return this.name;
  }
}

class SpliceSignalEmitter extends GenericEmitter {
  // This object holds the splice signals and will emit them
  // To set your own splice signals pass it a signal_rates object in the format
  // { fiveprime:
  //     [ [signal1, rate1], [signal2, rate2], ... [signalN, rateN]],
  //   threeprime:
  //     [ [signal1, rate1], [signal2, rate2], ... [signalN, rateN]]
  // }
  // Where all the rates add up to 1
  // The default emitter will only emit the cannonical splice signals
  constructor (options) {
    if (! options) options = {};
    super(options);
    if (options.signal_rates) {
      this.signal_rates = options.signal_rates;
    } else {
      // we need to set up the rates
      this.signal_rates = {
        fiveprime:[['GT',1]],
        threeprime:[['AG',1]]
      }
    }
  }
  fiveprime () { // Emit a 5' signal
    let rn = this.random.random();
    let sigs = this.signal_rates.fiveprime.map(x => x[0]);
    let weights = this.signal_rates.fiveprime.map(x => x[1]);
    let rc = this.random.weighted_choice(sigs,weights);
    return new NucleotideSequence2Bit({seq:rc});
  }
  threeprime () { // Emit a 3' signal
    let rn = this.random.random();
    let sigs = this.signal_rates.threeprime.map(x => x[0]);
    let weights = this.signal_rates.threeprime.map(x => x[1]);
    let rc = this.random.weighted_choice(sigs,weights);
    return new NucleotideSequence2Bit({seq:rc});
  }
}

exports.TranscriptomeEmitter = TranscriptomeEmitter;
