"use strict";
const uuid4 = require('./random.js').uuid4;

/**
* module with classes for describing graphs
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
* @param {Object} options
* @param {Object} options.payload - add on a payload to a graph
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

  /**
  * getter for node_count
  * @readonly
  * @instance
  * @returns {Number} number of nodes
  * @memberof graph.private.GenericGraph
  */
  get node_count () {
    let keys = Object.getOwnPropertyNames(this._nodes);
    return keys.length;
  }

  /**
  * getter for edge_count
  * @readonly
  * @instance
  * @returns {Number} number of edges
  * @memberof graph.private.GenericGraph
  */
  get edge_count () {
    let keys = Object.getOwnPropertyNames(this._edges);
    return keys.length;
  }

  /**
  * add a node to the graph. cannot be one thats already been added
  * @instance
  * @param {Object} input_node
  * @memberof graph.private.GenericGraph
  */
  add_node (input_node) {
    // place node into a graph
    this._nodes[input_node.id.toString()] = input_node;
  }

  /**
  * getter for the unique id for this graph
  * @readonly
  * @instance
  * @returns {Object} id -  the uuid4 that was set for this object
  * @memberof graph.private.GenericGraph
  */
  get id () {
    return this._id;
  }

  /**
  * getter for a list of the nodes in this graph
  * @readonly
  * @instance
  * @returns {Object[]} nodes - list of nodes
  * @memberof graph.private.GenericGraph
  */
  get nodes () {
    let keys = Object.getOwnPropertyNames(this._nodes);
    let output = [];
    for (let id of keys) {
      output.push(this._nodes[id]);
    }
    return output;
  }

  /**
  * get a list of graphs that are not connected that are subsets of the original
  * @instance
  * @returns {Object[]} graphs - list of unconnected graphs
  * @memberof graph.private.GenericGraph
  */
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

  /**
  * get a list of edges that are associated with a node
  * @instance
  * @param {Object} innode - input a node
  * @returns {Object[]} edges - list of edges
  * @memberof graph.private.GenericGraph
  */
  get_edges_by_node(innode) {
    if (! (innode.id.toString() in this._nodes_to_edges)) return [];
    return Array.from(this._nodes_to_edges[innode.id.toString()]);
  }

  /**
  * get a list of nodes that are connected to a node. this can be called recursively
  * @instance
  * @param {Object} innode - input a node
  * @param {Object} [traversed=] - set of nodes that have been traversd
  * @returns {Object[]} edges - list of nodes
  * @memberof graph.private.GenericGraph
  */
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
* @param {Object} options - is also passed to GenericGraph constructor
* @memberof graph
* @extends GenericGraph
*/
exports.DirectedGraph = class DirectedGraph extends GenericGraph {
  constructor (options) {
    if (! options) options = {};
    super(options);
  }
  /**
  * Add an edge to the graph
  * @instance
  * @param {Object} input_edge
  * @extends graph.DirectedGraph
  * @meberof graph.GenericGraph
  */
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
* @param {Object} options - is also passed to GenericGraph constructor
* @memberof graph
* @extends GenericGraph
*/
exports.UndirectedGraph = class UndirectedGraph extends GenericGraph {
  constructor (options) {
    if (! options) options = {};
    super(options);
  }

  /**
  * Add an edge to the graph
  * @instance
  * @param {Object} input_edge
  * @memberof graph.UndirectedGraph
  */
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
* @param {Object} options
* @param {Object} options.payload - set a payload if you like
* @param {Object} options.name - set a name if you want
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

  /**
  * getter for the unique id for this node
  * @readonly
  * @instance
  * @returns {Object} id -  the uuid4 that was set for this object
  * @memberof graph.private.GenericGraph
  */
  get id () {
    return this._id;
  }

  /**
  * getter for the name
  * @readonly
  * @instance
  * @returns {String} name
  * @memberof graph.private.GenericGraph
  */
  get name () {
    return this._name;
  }

  /**
  * getter for the payload
  * @readonly
  * @instance
  * @returns {Object} payload
  * @memberof graph.private.GenericGraph
  */
  get payload () {
    return this._payload;
  }
}

/**
* Class for an edge on a graph
* @class
* @param {Object} node1
* @param {Object} node2
* @param {Object} options
* @param {Object} options.payload - set a payload if you like
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

  /**
  * getter for the payload
  * @readonly
  * @instance
  * @returns {Object} payload
  * @memberof graph.private.GenericGraph
  */
  get payload () {
    return this._payload;
  }

  /**
  * getter for node1
  * @readonly
  * @instance
  * @returns {Object} node1
  * @memberof graph.private.GenericGraph
  */
  get node1 () {
    return this._node1;
  }

  /**
  * getter for node1
  * @readonly
  * @instance
  * @returns {Object} node2
  * @memberof graph.private.GenericGraph
  */
  get node2 () {
    return this._node2;
  }

  /**
  * getter for id
  * @readonly
  * @instance
  * @returns {Object} uuid
  * @memberof graph.private.GenericGraph
  */
  get id () {
    return this._id;
  }

  /**
  * getter for dictionary of nodes
  * @readonly
  * @instance
  * @returns {Object} node_id_dictionary
  * @memberof graph.private.GenericGraph
  */
  get nodes () {
    let n = {};
    n[this._node1.id.toString()] = this._node1;
    n[this._node2.id.toString()] = this._node2;
  }
}
