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
 * Tree Visualiser Widget
 * 
 * @module Widgets/TreeVisualizerDAT
 * @author Adrian Quintana (adrian.perez@ucl.ac.uk)
 */

define(function(require) {

	var TreeVisualiser = require('widgets/treevisualiser/TreeVisualiser');
	var $ = require('jquery');

	return TreeVisualiser.TreeVisualiser.extend({

		defaultTreeVisualiserOptions : {
			width : "auto",
			autoPlace : false,
			expandNodes: false
		},
		
		/**
		 * Initializes the TreeVisualiserDAT given a set of options
		 * 
		 * @param {Object} options - Object with options for the TreeVisualiserDAT widget
		 */
		initialize : function(options) {
			TreeVisualiser.TreeVisualiser.prototype.initialize.call(this, options);

			this.options = this.defaultTreeVisualiserOptions;

			this.gui = new dat.GUI({
				width : this.options.width,
				autoPlace : this.options.autoPlace
			});

			this.dialog.append(this.gui.domElement);
		},
		
		/**
		 * Action events associated with this widget
		 */
		events : {
			'contextmenu .title' : 'manageRightClickEvent',
			'contextmenu .cr.string' : 'manageRightClickEvent'
		},

		/**
		 * Register right click event with widget
		 * 
		 * @param {WIDGET_EVENT_TYPE} event - Handles right click event on widget
		 */
		manageRightClickEvent : function(event) {
			var nodeInstancePath = $(event.target).data("instancepath");
			if (nodeInstancePath == undefined){
				nodeInstancePath = $(event.target).parents('.cr.string').data("instancepath");
			}
			//Read node from instancepath data property attached to dom element
			this.showContextMenu(event, eval(nodeInstancePath));
		},
		
		/**
		 * Sets the data used inside the TreeVisualiserDAT for rendering. 
		 * 
		 * @param {Array} state - Array of variables used to display inside TreeVisualiserDAT
		 * @param {Object} options - Set of options passed to widget to customize it
		 */
		setData : function(state, options) {
			dataset = TreeVisualiser.TreeVisualiser.prototype.setData.call(this, state, options);
			dataset.valueDict = {};
			
			this.prepareTree(this.gui, dataset.data);

			dataset.isDisplayed = true;
			this.datasets.push(dataset);

			return "Metadata or variables to display added to tree visualiser";
		},

		/**
		 * Prepares the tree for painting it on the widget
		 * 
		 * @param {Object} parent - Parent tree to paint
		 * @param {Array} data - Data to paint
		 */
		prepareTree : function(parent, data) {
			if (data._metaType != null){
				//TODO: Remove once all getName are implemented in all nodes
				if (data.getName() === undefined && data.getName() != ""){label = data.getId();}
				else{label = data.getName();}
				
				if (data._metaType == "VariableNode"  | data._metaType == "DynamicsSpecificationNode" | data._metaType == "ParameterSpecificationNode" |
						data._metaType == "TextMetadataNode" | data._metaType == "FunctionNode" |
						data._metaType == "VisualObjectReferenceNode" | data._metaType == "VisualGroupElementNode") {
					if (!dataset.isDisplayed) {
						dataset.valueDict[data.instancePath] = new function(){};
						
						dataset.valueDict[data.instancePath][label] = this.getValueFromData(data);
						
						dataset.valueDict[data.instancePath]["controller"] = parent.add(dataset.valueDict[data.instancePath], label).listen();
						//Add class to dom element depending on node metatype
						$(dataset.valueDict[data.instancePath]["controller"].__li).addClass(data._metaType.toLowerCase() + "tv");
						//$(dataset.valueDict[data.instancePath]["controller"].__li).addClass(label);
						//Add instancepath as data attribute. This attribute will be used in the event framework
						$(dataset.valueDict[data.instancePath]["controller"].__li).data("instancepath", data.getInstancePath());
						
						//if no values are presentn for a group element,display theh color
						if (data._metaType == "VisualGroupElementNode" 
							&& dataset.valueDict[data.instancePath][label] == "null ") {
							//set label to empty
							dataset.valueDict[data.instancePath][label] = "";
							
							$(dataset.valueDict[data.instancePath]["controller"].__li).addClass(label);

							//apply color to label by getting unique class and using jquery
							var color = data.getColor();
							color = color.replace("0X","#");
							$("."+label + " .c").css("background-color",color);
							$("."+label + " .c").css("width","60%");
							$("."+label + " .c").css("height","95%");
						}	
					}
					else{
						var set = dataset.valueDict[data.instancePath]["controller"].__gui;
						if(!set.__ul.closed){
							dataset.valueDict[data.instancePath][label] = this.getValueFromData(data);
						}
					}
				}
				else{
					if (!dataset.isDisplayed) {
						parentFolder = parent.addFolder(label);
						//Add class to dom element depending on node metatype
						$(parentFolder.domElement).find("li").addClass(data._metaType.toLowerCase() + "tv");
						//Add instancepath as data attribute. This attribute will be used in the event framework
						$(parentFolder.domElement).find("li").data("instancepath", data.getInstancePath());
						
						//if no values are presentn for a group element,display theh color
						if (data._metaType == "VisualGroupNode") {
							
							$(parentFolder.domElement).find("li").addClass(label);
							
							$("."+label).append( $('<a>').attr('class',label+"-mean"));
							$("."+label+"-mean").css("float", "right");
							$("."+label).css("width", "100%");
							$("."+label+"-mean").css("width", "60%");
							$("."+label+"-mean").css("height", "90%");
							$("."+label+"-mean").css("color", "black");

							if(data.getMinDensity() != data.getMaxDensity()){
								$("."+label+"-mean").append(
										$('<span>').attr('class', label+"-low").append(data.getMinDensity()));
								$("."+label+"-mean").append(
										$('<span>').attr('class', label+"-high").append(data.getMaxDensity()));

								$("."+label+"-low").css("width", "50%");
								$("."+label+"-high").css("width", "50%");
								$("."+label+"-low").css("height", "90%");
								$("."+label+"-high").css("height", "90%");
								$("."+label+"-low").css("text-align", "center");
								$("."+label+"-high").css("text-align", "center");
								$("."+label+"-low").css("float", "left");
								$("."+label+"-high").css("float", "right");


								var lowHexColor = rgbToHex(255, Math.floor(255), 0);
								var highHexColor = rgbToHex(255, Math.floor(255 - (255)), 0);
								
								var lowcolor = lowHexColor.replace("0X","#");
								var highcolor = highHexColor.replace("0X","#");
								
								$("."+label+"-low").css("background-color", lowcolor);
								$("."+label+"-high").css("background-color", highcolor);
							}else{
								$("."+label+"-mean").append(
										$('<span>').attr('class', label+"-text").append(data.getMinDensity()));

								$("."+label+"-text").css("width", "60%");

								var hex = rgbToHex(255, Math.floor(255 - (255)), 0);
								
								var color = hex.replace("0X","#");

								$("."+label+"-mean").css("text-align", "center");
								$("."+label+"-mean").css("background-color", color);
								$("."+label+"-text").css("background-color", color);
							}
						}
					}
					var children = data.getChildren().models;
					if (children.length > 0){
						var parentFolderTmp = parentFolder;
							for (var childIndex in children){
								if (!dataset.isDisplayed || (dataset.isDisplayed && children[childIndex].name != "ModelTree")){
									this.prepareTree(parentFolderTmp, children[childIndex]);
								}
							}
						if (this.options.expandNodes){
							parentFolderTmp.open();
						}
					}
				}
			}	
		},
		
		/**
		 * Updates the data that the TreeVisualiserDAT is rendering
		 */
		updateData : function() {
			for ( var key in this.datasets) {
				dataset = this.datasets[key];
				if (dataset.variableToDisplay != null) {
					this.prepareTree(this.gui, dataset.data);
				}
			}
		}

	});
});