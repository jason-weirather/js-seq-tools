"use strict";
const uuid4 = require('./random.js').uuid4;

/**
* classes for describing graphs
* @namespace graph
*/

/**
* classes for describing graphs
* @namespace private
* @memberof graph
*/

/**
* Generic graph should be overridden
* @class
* @memberof graph.private
*/
class GenericGraph {
  constructor (options) {
    if (! options) options = {};
    this.payload = options.payload;
    this._nodes = {};
    this._edges = {};
    this._node_connections = {}; // directed nodeid1 nodeid2 and then edgeid then the edge
    this._nodes_to_edges = {};
    this._id = new uuid4();
  }
  get node_count () {
    let keys = Object.getOwnPropertyNames(this._nodes);
    return keys.length;
  }
  get edge_count () {
    let keys = Object.getOwnPropertyNames(this._edges);
    return keys.length;
  }
  add_node (input_node) {
    // place node into a graph
    this._nodes[input_node.id.toString()] = input_node;
  }
  get id () {
    return this._id;
  }
  get nodes () {
    let keys = Object.getOwnPropertyNames(this._nodes);
    let output = [];
    for (let id of keys) {
      output.push(this._nodes[id]);
    }
    return output;
  }
  split_unconnected () {
    //return an array of graphs that are not connected
    let gs = [];
    let all_nodes = new Set(this.nodes);
    while (all_nodes.size > 0) {
      let node = undefined;
      for (let x of all_nodes) {
        node = x;
        break;
      }
      let cnodes = new Set(this.get_connected_nodes(node));
      for (let x of cnodes) all_nodes.delete(x);
      let g = Object.create(this);
      for (let x of cnodes) {
        g.add_node(x);
        let edges =this.get_edges_by_node(x);
        for (let id of edges) {
          g.add_edge(this._edges[id]);
        }
      }
      gs.push(g);
    }
    return gs;
  }
  get_edges_by_node(innode) {
    if (! (innode.id.toString() in this._nodes_to_edges)) return [];
    return Array.from(this._nodes_to_edges[innode.id.toString()]);
  }
  get_connected_nodes(innode,traversed) {
    if (! traversed) traversed = new Set();
    if (traversed.has(innode.id.toString())) return [];
    let output = [innode];
    traversed.add(innode.id.toString());
    if (! (innode.id.toString() in this._node_connections)) {
      return output;
    }
    let keys = Object.getOwnPropertyNames(this._node_connections[innode.id.toString()]);
    for (let id of keys) {
      if (! (traversed.has(this._nodes[id].id.toString()))) {
        let vals = this.get_connected_nodes(this._nodes[id],traversed);
        for (let val of vals) output.push(val);
      }
    }
    // we are done
    return output;
  }
}

/**
* Class for a directed graph
* @class
* @memberof graph
*/
exports.DirectedGraph = class DirectedGraph extends GenericGraph {
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
  add_edge (input_edge) {
    if (input_edge.id.toString() in this._edges) return; // we already added this edge
    this._edges[input_edge.id.toString()] = input_edge;
    // add the nodes if they are not part of the graph yet
    if (! (input_edge.node1.id.toString() in this._nodes)) this.add_node(input_edge.node1);
    if (! (input_edge.node2.id.toString() in this._nodes)) this.add_node(input_edge.node2);
    // specify these nodes relationship with the edge
    if (! (input_edge.node1.id.toString() in this._nodes_to_edges)) this._nodes_to_edges[input_edge.node1.id.toString()] = new Set();
    this._nodes_to_edges[input_edge.node1.id.toString()].add(input_edge.id.toString());
    if (! (input_edge.node2.id.toString() in this._nodes_to_edges)) this._nodes_to_edges[input_edge.node2.id.toString()] = new Set();
    this._nodes_to_edges[input_edge.node2.id.toString()].add(input_edge.id.toString());
    _make_connection(this._node_connections,input_edge.node1,input_edge.node2,input_edge);
  }
}

/**
* Class for an undirected graph
* @class
* @memberof graph
*/
exports.UndirectedGraph = class UndirectedGraph extends GenericGraph {
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
  add_edge (input_edge) {
    if (input_edge.id.toString() in this._edges) return; // we already added this edge
    this._edges[input_edge.id.toString()] = input_edge;
    // add the nodes if they are not part of the graph yet
    if (! (input_edge.node1.id.toString() in this._nodes)) this.add_node(input_edge.node1);
    if (! (input_edge.node2.id.toString() in this._nodes)) this.add_node(input_edge.node2);
    // specify these nodes relationship with the edge
    if (! (input_edge.node1.id.toString() in this._nodes_to_edges)) this._nodes_to_edges[input_edge.node1.id.toString()] = new Set();
    this._nodes_to_edges[input_edge.node1.id.toString()].add(input_edge.id.toString());
    if (! (input_edge.node2.id.toString() in this._nodes_to_edges)) this._nodes_to_edges[input_edge.node2.id.toString()] = new Set();
    this._nodes_to_edges[input_edge.node2.id.toString()].add(input_edge.id.toString());
    _make_connection(this._node_connections,input_edge.node1,input_edge.node2,input_edge);
    _make_connection(this._node_connections,input_edge.node2,input_edge.node1,input_edge);
  }
}

var _make_connection = function (connect,node1,node2,edge) {
  let id = edge.id.toString();
  let n1id = node1.id.toString();
  let n2id = node2.id.toString();
  if (! (n1id in connect)) {
    connect[n1id] = {};
  }
  if (! (n2id in connect[n1id])) {
    connect[n1id][n2id] = new Set();
  }
  if (! (id in connect[n1id][n2id])) {
     connect[n1id][n2id].add(id);
  }
  return;
}

/**
* Class for a node on a graph
* @class
* @memberof graph
*/
exports.Node = class Node {
  // These are not altered after creation
  constructor (options) {
    if (! options) options = {};
    this._payload = options.payload;
    this._name = options.name;
    this._id = new uuid4();
  }
  get id () {
    return this._id;
  }
  get name () {
    return this._name;
  }
  get payload () {
    return this._payload;
  }
}

/**
* Class for an edge on a graph
* @class
* @memberof graph
*/
exports.Edge = class Edge {
  // These are not altered after creation
  constructor (node1,node2,options) {
    if (! options) options = {};
    this._payload = options.payload;
    this._node1 = node1;
    this._node2 = node2;
    this._id = new uuid4();
  }
  get payload () {
    return this._payload;
  }
  get node1 () {
    return this._node1;
  }
  get node2 () {
    return this._node2;
  }
  get id () {
    return this._id;
  }
  get nodes () {
    let n = {};
    n[this._node1.id.toString()] = this._node1;
    n[this._node2.id.toString()] = this._node2;
  }
}
