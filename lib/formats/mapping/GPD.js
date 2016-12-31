"use strict";

var map_to_gpd_line = function (inmap,options) {
  // Convert to various genePred formats
  // By Default use format option 'GenePredictionsAndRefSeqGenesWithGeneNames'
  // This has 11 fields
  // 1. gene_name This can be set as an optional parameter. Default to query name
  // 2. name  The query name
  // 3. chrom The reference name
  // 4. strand + or -
  // 5  tx start
  // 6. tx end
  // 7. cds start - option cds_start, default use tx start
  // 8. cds end - optional cds_end, default use tx end
  // 9. exonCount
  // 10.exon starts
  // 11.exon ends
  //
  // More basic format option is 'GenePredictions' with 10 fields
  // 1. name  The query name
  // 2. chrom The reference name
  // 3. strand + or -
  // 4  tx start
  // 5. tx end
  // 6. cds start - option cds_start, default use tx start
  // 7. cds end - optional cds_end, default use tx end
  // 8. exonCount
  // 9.exon starts
  // 10.exon ends
  //
  // Final format option is 'GenePredictionsExtended' with 15 fields
  // 1. name  The query name
  // 2. chrom The reference name
  // 3. strand + or -
  // 4  tx start
  // 5. tx end
  // 6. cds start - option cds_start, default use tx start
  // 7. cds end - optional cds_end, default use tx end
  // 8. exonCount
  // 9.exon starts
  // 10.exon ends
  // 11.score 0 by default
  // 12.name2 - option name2, use name by default
  // 13.cdsStartStat - none by default
  // 14.cdsEndStat - none by default
  // 15.exonframes - array of zeros length exoncount csv by default
  if (! options) options = {};
  var format = 'GenePredictionsAndRefSeqGenesWithGeneNames';
  switch (options.format) {
    case 'GenePredictions':
      format = 'GenePredictions';
      break;
    case 'GenePredictionsExtended':
      format = 'GenePredictionsExtended';
      break;
  }
  var ostr = '';
  if (format === 'GenePredictionsAndRefSeqGenesWithGeneNames') {
    if (options.gene_name) ostr += options.gene_name + "\t";
    else ostr += inmap.name+"\t"; // no gene name
  }
  ostr += inmap.name+"\t";
  ostr += inmap.refName+"\t";
  ostr += inmap.direction+"\t";
  ostr += inmap.range.start+"\t";
  ostr += inmap.range.end+"\t";
  if (options.cds_start) ostr += options.cds_start+"\t";
  else ostr += inmap.range.start+"\t";
  if (options.cds_end) ostr += options.cds_end+"\t";
  else ostr += inmap.range.end+"\t";
  ostr += inmap.exonCount+"\t";
  ostr += inmap._map.map(x=>x.start).join(',')+"\t";
  ostr += inmap._map.map(x=>x.end).join(',')+"\t";
  if (format === 'GenePredictionsExtended') {
    if (options.score) ostr += options.score+"\t";
    else ostr += 0+"\t"; // score
    if (options.name2) ostr += options.name2 + "\t"; // use name2 if set in options
    else ostr += inmap.name + "\t"; // otherwise just use name again
    if (options.cdsStartStat) ostr += options.cdsStartStat+"\t";
    else ostr += 'none'+"\t";
    if (options.cdsEndStat) ostr += options.cdsEndStat+"\t";
    else ostr += 'none'+"\t";
    if (options.exonFrames) ostr += options.exonFrames+"\t";
    else ostr += inmap._map.map(x=>0).join(',')+"\t";
  }
  return ostr.replace(/\t$/,'');
  // create various GPD formats
}

exports.map_to_gpd_line = map_to_gpd_line;
