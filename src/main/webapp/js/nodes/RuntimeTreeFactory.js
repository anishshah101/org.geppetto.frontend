/*******************************************************************************
 * The MIT License (MIT)
 *
 * Copyright (c) 2011, 2013 OpenWorm.
 * http://openworm.org
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the MIT License
 * which accompanies this distribution, and is available at
 * http://opensource.org/licenses/MIT
 *
 * Contributors:
 *      OpenWorm - http://openworm.org/people.html
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
 * USE OR OTHER DEALINGS IN THE SOFTWARE.
 *******************************************************************************/
/**
 * Factory class that figures out what kind of nodes to create with the updates
 * received from the server. Creates the client nodes for entities, aspects, etc
 * and updates them.
 * 
 * @author Jesus R. Martinez (jesus@metacell.us)
 */
define(function(require) {
	return function(GEPPETTO) {
		var AspectNode = require('nodes/AspectNode');
		var EntityNode = require('nodes/EntityNode');
		var AspectSubTreeNode = require('nodes/AspectSubTreeNode');
		var CompositeNode = require('nodes/CompositeNode');
		var ParameterNode = require('nodes/ParameterNode');
		var ParameterSpecificationNode = require('nodes/ParameterSpecificationNode');
		var TextMetadataNode = require('nodes/TextMetadataNode');
		var DynamicsSpecificationNode = require('nodes/DynamicsSpecificationNode');
		var FunctionNode = require('nodes/FunctionNode');
		var VariableNode = require('nodes/VariableNode');
		var ConnectionNode = require('nodes/ConnectionNode');
		var simulationTreeCreated=false;
		
		/**
		 * @class GEPPETTO.RuntimeTreeFactory
		 */
		GEPPETTO.RuntimeTreeFactory = {
				/**Creates the backbone nodes for the first time depending.
				 */
				createRuntimeTree : function(jsonRuntimeTree){
					this.simulationTreeCreated=false;
					for (var id in jsonRuntimeTree) {
						var node = jsonRuntimeTree[id];
						if(node._metaType == GEPPETTO.Resources.ENTITY_NODE){
							var entityNode = 
								GEPPETTO.RuntimeTreeFactory.createEntityNode(node);
						GEPPETTO.Console.updateCommands(
								"js/nodes/EntityNode.js", entityNode, id);

						// keep track of client entity nodes created
						GEPPETTO.Simulation.runTimeTree[id] = entityNode;

						this.traverseEntities(node, entityNode,
								GEPPETTO.Simulation.runTimeTree[id]);
					}
				}
			},

			/**
			 * Traverse through entities to create children
			 * 
			 * * @name RuntimeTreeFactory#traverseEntities
			 */
			traverseEntities : function(entities, parentNode, runTimeRef) {
				for ( var id in entities) {
					var node = entities[id];
					if (node._metaType == GEPPETTO.Resources.ENTITY_NODE) {
						var entityNode = GEPPETTO.RuntimeTreeFactory
								.createEntityNode(node);

						GEPPETTO.Console.updateTags(entityNode.instancePath,
								entityNode);

						runTimeRef[id] = entityNode;
						parentNode.get("entities").add(entityNode);

						this.traverseEntities(node);
					}
				}
			},
				/**Traverse the tree, when an aspect is found */
				updateNode :function(node)
				{
					for(var c in node)
					{
						var child=node[c];
						if(child._metaType==GEPPETTO.Resources.ASPECT_NODE)
						{
							var aspectNode=eval(child.instancePath);
							if(child.SimulationTree != undefined)
							{
								if(jQuery.isEmptyObject(aspectNode.SimulationTree) || aspectNode.Simulation==undefined)
								{
									this.createAspectSimulationTree(aspectNode.instancePath,child.SimulationTree);	
								}
							}
						}
						else if(child._metaType==GEPPETTO.Resources.ENTITY_NODE)
						{
							this.updateNode(child);
						}
					}
				},
				
				/**Update all visual trees for a given entity*/
				updateEntityVisualTrees : function(entity, jsonRuntimeTree){
					for (var aspectId in entity.aspects) 
					{
						var aspect = entity.aspects[aspectId];
						
						var receivedAspect=eval("jsonRuntimeTree."+aspect.getInstancePath());
						if(receivedAspect != undefined){
							if(receivedAspect.VisualizationTree != undefined)
							{
								aspect.VisualizationTree.content = receivedAspect.VisualizationTree;
							}
						}
					}
					for (var entityid in node.entities)
					{
						this.updateEntityVisualTrees(node.entities[entityid],jsonRuntimeTree);
					}
				},
				
				/**Update entities of scene with new server updates*/
				updateVisualTrees : function(jsonRuntimeTree){
					for(var c in GEPPETTO.Simulation.runTimeTree)
					{
						var node=GEPPETTO.Simulation.runTimeTree[c];
						if(node._metaType==GEPPETTO.Resources.ENTITY_NODE)
						{
							this.updateEntityVisualTrees(node,jsonRuntimeTree);
						}
					}
				},
				
				/**Update entities of scene with new server updates*/
				updateRuntimeTree : function(jsonRuntimeTree){
					if(!this.simulationTreeCreated)
					{
						this.updateNode(jsonRuntimeTree);
						this.simulationTreeCreated=true;
					}
					this.updateVisualTrees(jsonRuntimeTree);
					for(var index in GEPPETTO.Simulation.simulationStates)
					{
						var state = GEPPETTO.Simulation.simulationStates[index];
						var received=eval("jsonRuntimeTree."+state);
						var clientNode=eval(state);
						clientNode.value = received.value;
					}
				
					this.updateWidgets();
				},
				
				/**Update and create simulation Tree for aspect
				 * 
				 * @param aspectInstancePath - Path of aspect to update
				 * @param simulationTree - Server JSON update
				 */
				createAspectSimulationTree : function(aspectInstancePath,simulationTreeUpdate){
					var aspect= eval(aspectInstancePath);	
					//the client aspect has no simulation tree, let's create it
					var path =aspectInstancePath + ".SimulationTree";
					
					//create SubTreeNode to store simulation tree
					var subTree = new AspectSubTreeNode({name : "SimulationTree",
						instancePath : path ,
						type : "SimulationTree",
						_metaType : GEPPETTO.Resources.ASPECT_SUBTREE_NODE, modified : true});
					this.createSimulationTree(subTree, simulationTreeUpdate);
					aspect.SimulationTree = subTree;
					
					aspect.get("children").add(subTree);
					
					GEPPETTO.Console.updateTags(subTree.instancePath, subTree);
				},
				
				updateWidgets : function(){
					//send command to widgets that newd data is available
					GEPPETTO.WidgetsListener.update(GEPPETTO.WidgetsListener.WIDGET_EVENT_TYPE.UPDATE);
					
					//update scene brightness
					for(var key in GEPPETTO.Simulation.listeners) {
						//retrieve the simulate state from watch tree
						var simState = GEPPETTO.Utility.deepFind(GEPPETTO.Simulation.runTimeTree, key);

						//update simulation state
						GEPPETTO.Simulation.listeners[key](simState);
					}
				},

				/**Create Model Tree for aspect
				 * 
				 * @param aspectInstancePath - Path of aspect to populate
				 * @param modelTree - Server JSON update
				 */
				createAspectModelTree : function(aspectInstancePath, modelTree){
					var aspect= GEPPETTO.Utility.deepFind(GEPPETTO.Simulation.runTimeTree, aspectInstancePath);
					
					//populate model tree with server nodes
					this.modelJSONToNodes(aspect.ModelTree, modelTree);
					aspect.ModelTree.modified = true;
					
					//notify user received tree was empty
					if(aspect.ModelTree.getChildren().length==0){
						var indent = "    ";
						GEPPETTO.Console.log(indent + GEPPETTO.Resources.EMPTY_MODEL_TREE);
					}else{
						GEPPETTO.Console.executeCommand(aspect.ModelTree.instancePath + ".print()");
						aspect.ModelTree.print();
					}
				},

				/**Create Model Tree using JSON server update
				 * 
				 * @param parent - Used to store the created client nodes
				 * @param node - JSON server update nodes
				 */
				modelJSONToNodes : function(parent, node){				    
					//traverse through nodes to create model tree
					for(var i in node) {
						if(typeof node[i] === "object") {
							var metatype = node[i]._metaType;

							//if object is array, do recursion to find more objects
							if(node[i] instanceof Array){
								var array = node[i];
								parent[i] = [];
								var arrayNode = new CompositeNode(
										{id: i, name : i,_metaType : GEPPETTO.Resources.COMPOSITE_NODE});
								parent.get("children").add(arrayNode);
								for(var index in array){
									parent[i][index] = {};
									var arrayObject = this.modelJSONNodes(arrayNode, array[index]);
									parent[i][index] = arrayObject;
								}
							}
							
							/*Match type of node and created*/
							if(metatype == GEPPETTO.Resources.COMPOSITE_NODE){
								var compositeNode =this.createCompositeNode(node[i]);
								if(parent._metaType == GEPPETTO.Resources.COMPOSITE_NODE || parent._metaType == GEPPETTO.Resources.ASPECT_SUBTREE_NODE){
									parent.get("children").add(compositeNode);
								}
								parent[i] = compositeNode;
								//traverse through children of composite node
								this.modelJSONToNodes(parent[i], node[i]);
							}
							else if(metatype == GEPPETTO.Resources.FUNCTION_NODE){
								var functionNode =  this.createFunctionNode(node[i]);
								if(parent._metaType == GEPPETTO.Resources.COMPOSITE_NODE || parent._metaType == GEPPETTO.Resources.ASPECT_SUBTREE_NODE){
									parent.get("children").add(functionNode);
								}
								parent[i] = functionNode;
							}
							else if(metatype == GEPPETTO.Resources.DYNAMICS_NODE){
								var dynamicsSpecificationNode =  this.createDynamicsSpecificationNode(node[i]);
								if(parent._metaType == GEPPETTO.Resources.COMPOSITE_NODE || parent._metaType == GEPPETTO.Resources.ASPECT_SUBTREE_NODE){
									parent.get("children").add(dynamicsSpecificationNode);
								}
								parent[i] = dynamicsSpecificationNode;
							}
							else if(metatype == GEPPETTO.Resources.PARAMETER_SPEC_NODE){
								var parameterSpecificationNode =  this.createParameterSpecificationNode(node[i]);
								if(parent._metaType == GEPPETTO.Resources.COMPOSITE_NODE || parent._metaType == GEPPETTO.Resources.ASPECT_SUBTREE_NODE){
									parent.get("children").add(parameterSpecificationNode);
								}
								parent[i] = parameterSpecificationNode;
							}
							else if(metatype == GEPPETTO.Resources.TEXT_METADATA_NODE){
								var textMetadataNode =  this.createTextMetadataNode(node[i]);
								if(parent._metaType == GEPPETTO.Resources.COMPOSITE_NODE || parent._metaType == GEPPETTO.Resources.ASPECT_SUBTREE_NODE){
									parent.get("children").add(textMetadataNode);
								}
								parent[i] = textMetadataNode;
							}
							
							
							
						}
					}

					return parent;
				},

			/**
			 * Create Simulation Tree
			 * 
			 * @param parent -
			 *            Used to store the created client nodes
			 * @param node -
			 *            JSON server update nodes
			 */
			createSimulationTree : function(parent, node) {
				// traverse throuh node to find objects
				for ( var i in node) {
					if (typeof node[i] === "object") {
						var metatype = node[i]._metaType;

						// if object is array, do recursion to find more objects
						if (node[i] instanceof Array) {
							var array = node[i];
							parent[i] = [];
							// create parent composite node for array nodes
							var arrayNode = new CompositeNode({
								id : i,
								name : i,
								instancePath : node.instancePath + "." + i,
								_metaType : GEPPETTO.Resources.COMPOSITE_NODE
							});
							parent.get("children").add(arrayNode);
							
							GEPPETTO.Console.updateTags(arrayNode.instancePath, arrayNode);
														
							// create nodes for each array index
							for ( var index = 0; index < array.length; index++) {
								parent[i][index] = {};
								// create nodes for each array index node
								var arrayObject = this.createSimulationTree(
										arrayNode, array[index]);
								// set instance path of created array node and
								// set as property
								if (arrayObject.getChildren().length > 0) {
									arrayObject.instancePath = arrayNode.instancePath
											+ "[" + index + "]";
									parent[i][index] = arrayObject;
								}
								GEPPETTO.Console.updateTags(arrayObject.instancePath, arrayObject);
							}
						}
						// if object is CompositeNode, do recursion to find
						// children
						else if (metatype == GEPPETTO.Resources.COMPOSITE_NODE) {
							var newNode = this.createCompositeNode(node[i]);
							this.createSimulationTree(newNode, node[i]);
							// add to parent if applicable
							if (parent._metaType == GEPPETTO.Resources.COMPOSITE_NODE
									|| parent._metaType == GEPPETTO.Resources.ASPECT_SUBTREE_NODE) {
								parent.get("children").add(newNode);
							}
							parent[i] = newNode;
						} else if (metatype == GEPPETTO.Resources.VARIABLE_NODE) {
							var newNode = this.createVariableNode(node[i]);
							// add to parent if applicable
							if (parent._metaType == GEPPETTO.Resources.COMPOSITE_NODE
									|| parent._metaType == GEPPETTO.Resources.ASPECT_SUBTREE_NODE) {
								parent.get("children").add(newNode);
							}
							parent[i] = newNode;
						} else if (metatype == GEPPETTO.Resources.PARAMETER_NODE) {
							var newNode = this.createParameterNode(node[i]);
							// add to parent if applicable
							if (parent._metaType == GEPPETTO.Resources.COMPOSITE_NODE
									|| parent._metaType == GEPPETTO.Resources.ASPECT_SUBTREE_NODE) {
								parent.get("children").add(newNode);
							}
							parent[i] = newNode;
						}
					}
				}

				return parent;
			},

			/** Create and populate client entity nodes for the first time */
			createEntityNode : function(entity) {
				var e = window[entity.id] = new EntityNode({
					id : entity.id,
					name : entity.id,
					instancePath : entity.instancePath,
					position : entity.position
				});
				// add commands to console autocomplete and help option
				GEPPETTO.Console.addTag(entity.instancePath);

				for ( var id in entity) {
					var node = entity[id];
					// create aspect nodes
					if (node._metaType == GEPPETTO.Resources.ASPECT_NODE) {
						var aspectNode = GEPPETTO.RuntimeTreeFactory
								.createAspectNode(node);

						// set aspectnode as property of entity
						e[id] = aspectNode;
						// add aspect node to entity
						e.get("aspects").add(aspectNode);
						aspectNode.setParentEntity(e);
					}
					if (node._metaType == GEPPETTO.Resources.CONNECTION_NODE) {
						var connectionNode = GEPPETTO.RuntimeTreeFactory
								.createConnectionNode(node);

						// set connection as property of entity
						e[id] = connectionNode;
						// add aspect node to entity
						e.get("connections").add(connectionNode);
					}
				}

				return e;
			},

			/** Creates and populates client aspect nodes for first time */
			createAspectNode : function(aspect) {
				var a = window[aspect.id] = new AspectNode({
					id : aspect.id,
					modelInterpreter : aspect.modelInterpreter,
					name : aspect.id,
					simulator : aspect.simulator,
					model : aspect.model,
					instancePath : aspect.instancePath
				});
				GEPPETTO.Console.updateTags(aspect.instancePath, a);

				// create visualization subtree only at first
				for ( var aspectKey in aspect) {
					var node = aspect[aspectKey];
					if (node._metaType == GEPPETTO.Resources.ASPECT_SUBTREE_NODE) {
						if (node.type == "VisualizationTree") {
							var subTree = this.createAspectSubTreeNode(node);

							a.VisualizationTree = subTree;

							a.get("children").add(subTree);

							a.VisualizationTree["content"] = node;
						} else if (node.type == "SimulationTree") {
							a.SimulationTree = {};
						} else if (node.type == "ModelTree") {
							var subTree = this.createAspectSubTreeNode(node);

							a.ModelTree = subTree;

							a.get("children").add(subTree);

						}
					}
				}

				return a;
			},

			/** Creates and populates client aspect nodes for first time */
			createAspectSubTreeNode : function(node) {
				var a = new AspectSubTreeNode({
					name : node.type,
					type : node.type,
					id : node.id,
					instancePath : node.instancePath,
					_metaType : GEPPETTO.Resources.ASPECT_SUBTREE_NODE,
					modified : node.modified
				});

				GEPPETTO.Console.updateTags(node.instancePath, a);

				return a;
			},

			/** Creates and populates client aspect nodes for first time */
			createCompositeNode : function(node) {
				var a = new CompositeNode({
					id : node.id,
					name : node.name,
					instancePath : node.instancePath,
					_metaType : GEPPETTO.Resources.COMPOSITE_NODE
				});

				GEPPETTO.Console.updateTags(node.instancePath, a);

				return a;
			},

			/** Creates and populates client aspect nodes for first time */
			createFunctionNode : function(node) {
				var a = new FunctionNode({
					id : node.id,
					name : node.name,
					expression : node.expression,
					arguments : node.arguments,
					instancePath : node.instancePath,
					_metaType : GEPPETTO.Resources.FUNCTION_NODE
				});

				GEPPETTO.Console.updateTags(node.instancePath, a);

				return a;
			},
			/** Creates and populates client aspect nodes for first time */
			createDynamicsSpecificationNode : function(node) {
				var a = new DynamicsSpecificationNode({
					id : node.id,
					name : node.name,
					value : node.value,
					unit : node.unit,
					scalingFactor : node.scalingFactor,
					instancePath : node.instancePath,
					_metaType : GEPPETTO.Resources.DYNAMICS_NODE
				});
				var f = new FunctionNode({
					expression : node._function.expression,
					instancePath : node.instancePath,
					arguments : node._function.arguments
				});

				a.set("dynamics", f);
				GEPPETTO.Console.updateTags(node.instancePath, a);

				return a;
			},
			/** Creates and populates client aspect nodes for first time */
			createParameterSpecificationNode : function(node) {
				var a = new ParameterSpecificationNode({
					id : node.id,
					name : node.name,
					value : node.value,
					unit : node.unit,
					scalingFactor : node.scalingFactor,
					instancePath : node.instancePath,
					_metaType : GEPPETTO.Resources.PARAMETER_SPEC_NODE
				});

				GEPPETTO.Console.updateTags(node.instancePath, a);
				return a;
			},
			createTextMetadataNode : function(node) {
				var a = new TextMetadataNode({
					id : node.id,
					name : node.name,
					value : node.value,
					instancePath : node.instancePath,
					_metaType : GEPPETTO.Resources.TEXT_METADATA_NODE
				});

				GEPPETTO.Console.updateTags(node.instancePath, a);
				GEPPETTO.Console.addTag(node.instancePath);
				return a;
			},
			/** Creates and populates client aspect nodes for first time */
			createParameterNode : function(node) {
				var a = new ParameterNode({
					id : node.id,
					name : node.name,
					instancePath : node.instancePath,
					properties : node.properties,
					_metaType : GEPPETTO.Resources.PARAMETER_NODE
				});

				GEPPETTO.Console.updateTags(node.instancePath, a);

				return a;
			},
			/** Creates and populates client connection nodes for first time */
			createConnectionNode : function(node) {
				var a = new ConnectionNode({
					id : node.id,
					type : node.type,
					entityInstancePath : node.entityInstancePath,
					instancePath : node.instancePath,
					_metaType : GEPPETTO.Resources.CONNECTION_NODE
				});

				GEPPETTO.Console.updateTags(node.instancePath, a);

				return a;
			},
			/** Creates and populates client aspect nodes for first time */
			createVariableNode : function(node) {
				var a = new VariableNode({
					id : node.id,
					name : node.name,
					value : node.value,
					unit : node.unit,
					scalingFactor : node.scalingFactor,
					instancePath : node.instancePath,
					_metaType : GEPPETTO.Resources.VARIABLE_NODE
				});
				GEPPETTO.Console.updateTags(node.instancePath, a);
				return a;
			},
		};
	};
});
