"use strict";
const GenericEmitter = require('./emit.js').GenericEmitter;
const NucleotideSequence2Bit = require('../sequence.js').NucleotideSequence2Bit;
const RandomSeeded = require('../random.js').RandomSeeded;
const Bed = require('../range.js').Bed;
const Range = require('../range.js').Range;
const BedArray = require('../range.js').BedArray;
const GenericMapping = require('../mapping.js').GenericMapping;
const graph = require('../graph.js');
const GFF2 = require('../formats/mapping/GFF').GFF2;
const _MAXSEED = 100000000;
const _MAXITER = 1000;

class SimulatedGene {
  constructor (mapping,options) {
    // very likely options should define its own seed
    if (! options) options = {};
    this.params = this._default_parameters();
    if (options.params) fill_in_parameters(this.params,options.params);
    if (options.seed) this.seed = options.seed; // use the seed every time we generate one
    //this.params = this._default_parameters();
    this.name = mapping.name;
    this.direction = mapping.direction;
    // get our random numbers 
    let rs = undefined;
    if (this.seed) rs =new RandomSeeded({seed:this.seed});
    else rs = new RandomSeeded();
    // Get a maxmimum number of transcripts
    // The gene will not havea any more than this number of transcripts
    let num_transcripts = rs.randInt(
          this.params.transcript_count_range[0],
          this.params.transcript_count_range[1]
    );
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
  get exons () {
    // return the unique exons
    let bedarray = [];
    //console.log('getting exons');
    for (let t of this.transcripts) {
      for (let e of t.exons) {
        bedarray.push(e);
      }
    }
    return (new BedArray(bedarray)).sort().unique();
  }
  get exonic () {
    // return the covered sequence
    return this.exons.merged;
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
          continue; // easy we just don't include it
        }
        exons.push(gene_exons[j].copy());
      }
      if (exons.length === 0) continue;
      // done doing any skipping now see if we should extend
      let leftmost = true;
      let rightmost = false;
      for (let j =0; j < exons.length; j++) {
        if (j === exons.length-1) rightmost = true;
        let is5p = false;
        if (this.direction === '+' && leftmost) is5p = true;
        if (this.direction === '-' && rightmost) is5p = true;
        if (is5p && rs.random() < this.params.alternate_transcript_5prime_probability) {
          // do alternative 5prime transcript start
          let start = this.params.alternate_transcript_5prime_range[0];
          let end = this.params.alternate_transcript_5prime_range[1];
          let em =this.params.extension_multiple;
          let alt = get_alternate(start,end,em,rs);
          if (this.direction === '+') exons[j].start -= alt;
          else exons[j].end += alt;
        }
        if ((! is5p) && rs.random() < this.params.alternate_exon_5prime_probability) {
          // do alternative 5prime exon start
          let start = this.params.alternate_exon_5prime_range[0];
          let end = this.params.alternate_exon_5prime_range[1];
          let em =this.params.extension_multiple;
          let alt = get_alternate(start,end,em,rs);
          if (this.direction === '+') exons[j].start -= alt;
          else exons[j].end += alt;
        }
        let is3p = false;
        if (this.direction === '+' && rightmost) is5p = true;
        if (this.direction === '-' && leftmost) is5p = true;
        if (is3p && rs.random() < this.params.alternate_transcript_3prime_probability) {
          // do alternative 3prime transcript end
          let start = this.params.alternate_transcript_3prime_range[0];
          let end = this.params.alternate_transcript_3prime_range[1];
          let em =this.params.extension_multiple;
          let alt = get_alternate(start,end,em,rs);
          if (this.direction === '-') exons[j].start -= alt;
          else exons[j].end += alt;
        }
        if ((! is3p) && rs.random() < this.params.alternate_exon_3prime_probability) {
          // do alternative 3prime exon end
          let start = this.params.alternate_exon_3prime_range[0];
          let end = this.params.alternate_exon_3prime_range[1];
          let em =this.params.extension_multiple;
          let alt = get_alternate(start,end,em,rs);
          if (this.direction === '-') exons[j].start -= alt;
          else exons[j].end += alt;
        }
        leftmost = false;
      }
      //console.log(exons.length);
      let exons2 = [exons[0]];
      // Now deal with intron retention
      for (let j = 1; j < exons.length; j++) {
        if (rs.random() < this.params.intron_retention_probability) {
          let k = exons2.length-1; // last index
          exons2[k].end = exons[j].end;
          //console.log('retain');
        }
        else exons2.push(exons[j]);
      }
      let tx = new SimulatedTranscriptMapping({inmap:exons2,
                                               direction:mapping.direction,
                                               gene_name:mapping.name,
                                               name:tname});
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
      transcript_count_range: [5,5], // we may have less than max but wont have more
      exon_skipping_probability: 0.5,
      alternate_exon_5prime_probability: 0.5,
      alternate_exon_5prime_range: [8,20],
      alternate_exon_3prime_probability: 0.5,
      alternate_exon_3prime_range: [10,20],
      alternate_transcript_5prime_probability: 0.5,
      alternate_transcript_5prime_range: [10,20],
      alternate_transcript_3prime_probability: 0.5,
      alternate_transcript_3prime_range: [10,20],
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
var get_alternate = function (truestart,end,itersize,rand) {
  let start = truestart-(truestart % itersize);
  let opts = (Array.from(new Range(
                                start,
                                end+1,
                                itersize))).filter(x=>x>=truestart);
  return rand.choice(opts);
}

var fill_in_parameters = function (current_parameters, input_parameters) {
  if (Object.getOwnPropertyNames(input_parameters).length === 0) return; // Nothing in the input parameters case
  if (input_parameters && current_parameters) {  // if any parameters were set we will over-ride the
                           // defaults.  otherwise go with defaults
    //console.log(current_parameters);
    let ks = Object.getOwnPropertyNames(input_parameters);// input_parameterskeys();
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
    this.params = this._default_parameters(options);
    if (options.params) fill_in_parameters(this.params,options.params);
    this.signal_emitter = new SpliceSignalEmitter({random:this.random,signal_rates:options.signal_rates}); // Our super set will have this set up already
    // check to make sure our multiple is legal value
    if (this.params.extension_multiple < this.signal_emitter.maximum_signal_length) {
      throw new Error('signal length is longer than extension multiple');
    }
  }
  chromosome () { // Emit a chromsoome
    let schrom = new SimulatedChromosome({params:this.params,seed:this.random.randInt(0,_MAXSEED)});
    return schrom;
  }
  _default_parameters () {
    let params = {}
    params.extension_multiple = 5; // values by which multiples will extend exons and tss. 
    return params;
  }
}

class SimulatedChromosome {
  constructor (options) {
    if (! options) options = {};
    this.params = this._default_parameters();
    if (options.params) fill_in_parameters(this.params,options.params);
    this.seed = options.seed; // use the seed every time we generate one
    // set up our name, mappings and length now
    let rn = undefined;
    if (options.seed) rn = new RandomSeeded({seed:this.seed});
    else rn = new RandomSeeded(); //incase seed wasn't set
    this.name = rn.uuid4().toString();
    this.length = rn.randInt(
                    this.params.chromosome_length_range[0],
                    this.params.chromosome_length_range[1]);
    // ESTABLISH GENES AND TRANSCRIPTS
    this._gene_mappings = this._get_mappings(this.name,this.length,rn,this.params);
  }
  get GFF2 () {
    let gff2 = new GFF2({source:'simulation'});
    for (let g1 of this.genes) {
       for (let t1 of g1.transcripts) {
         gff2.add_transcript(t1);
       }
    }
    return gff2;
  }
  get exons () {
    // return the unique exons
    let bedarray = [];
    //console.log('getting exons');
    for (let g of this.genes) {
      for (let t of g.transcripts) {
        for (let e of t.exons) {
          bedarray.push(e);
        }
      }
    }
    return (new BedArray(bedarray)).sort().unique();
  }
  get exonic () {
    // return the covered sequence
    return this.exons.merged;
  }
  _default_parameters () {
    // minimum intron length needs to be greater than the sum of your longest intron signals
    let params = {
      // chromosome parameters
      exon_length_range: [100,100],
      intron_length_range: [1000,1000],
      exon_count_range: [10,10],
      intergenic_length_range: [10000,10000],
      chromosome_length_range: [10000000,10000000],
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
      let gene = new SimulatedGene(map,{params:params,seed:rn.randInt(1,_MAXSEED)});
      output.push(gene);
    }
    return output;
  }
  get genes () {
    return this._gene_mappings;
  }
  get transcript_count () {
    return this._gene_mappings.reduce(function(x,y) {
      return x+y.transcripts.length;
    },0);
  }
}

class SimulatedTranscriptMapping extends GenericMapping {
  constructor (options) {
    if (! options) options = {};
    super(options);
    if (options.gene_name) this._gene_name = options.gene_name;
    //if (options.name) this._name = options.name;
  }
  get gene_name () {
    return this._gene_name;
  }
  get name () {
    return this._name;
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
  maximum_signal_length () {
    // return the longest signal from among all the signals
    let longest = 0;
    for (let x of this.signal_rates.fiveprime.map(y=>y[0].length)) {
      if (x > longest) longest = x;
    }
    return longest;
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
