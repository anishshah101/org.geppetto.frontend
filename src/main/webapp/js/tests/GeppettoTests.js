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
 * Loads all scripts needed for Geppetto
 *
 * @author Jesus Martinez (jesus@metacell.us)
 */
"use strict";

define(function(require) {

	var run = function() {
		module("Global Scope Test");
		test("Global scope Test", function() {
			var help = GEPPETTO.Console.help();
			var commandCount = help.match(/--/g);  
			notEqual(help, null, "Global help() command test.");
			equal(59, commandCount.length, "Global help() - Looking for 48 commands in help() command.");
			
			equal(G.showHelpWindow(true), GEPPETTO.Resources.SHOW_HELP_WINDOW, "Help Window Visible");

			G.showHelpWindow(false);
			
			var modalVisible = $('#help-modal').hasClass('in');
			
			equal(modalVisible, false, "Help Window Hidden");
		});

		module("G Object Test");
		test("Test Get Current Simulation", function() {
			equal(G.getCurrentSimulation(), GEPPETTO.Resources.NO_SIMULATION_TO_GET, "Testing no simulation scenario.");
		});

		test("Test Debug Mode", function() {
			G.debug(true);

			equal(G.isDebugOn(), true, "Testing debug mode on scenario");

			G.debug(false);

			equal(G.isDebugOn(), false, "Testing debug mode off scenario");
		});

		test("Test G Object help method", function() {
			notEqual(G.help(), null, "Help command for object G is available, passed.");
		});

		test("Test Clear Console", function() {
			equal(G.clear(), GEPPETTO.Resources.CLEAR_HISTORY, "Console cleared");
		});

		test("Test Plot Widget", function() {
			G.addWidget(Widgets.PLOT);

			equal(GEPPETTO.PlotsController.getWidgets().length, 1, "Plot widget created");

			var plot = GEPPETTO.PlotsController.getWidgets()[0];

			equal(plot.isVisible(), true, "Test Default Widget Visibility");

			plot.hide();

			equal(plot.isVisible(), false, "Test hide()");

			plot.show();

			equal(plot.isVisible(), true, "Test show()");

			plot.destroy();

			equal($("#" + plot.getId()).html(), null, "Test destroy()");
		});
		
		test("Test Popup Widget", function() {
			G.addWidget(Widgets.POPUP);

			equal(GEPPETTO.PopupsController.getWidgets().length, 1, "Popup widget.");

			var pop = GEPPETTO.PopupsController.getWidgets()[0];

			equal(pop.isVisible(), true, "Test Default Visibility");

			pop.hide();

			equal(pop.isVisible(), false, "Test hide()");

			pop.show();

			equal(pop.isVisible(), true, "Test show()");

			pop.destroy();

			equal($("#" + pop.getId()).html(), null, "Test destroy()");
		});
		
		test("Test Scattered-3D Widget", function() {
			G.addWidget(Widgets.SCATTER3D);

			equal(GEPPETTO.Scatter3dController.getWidgets().length, 1, "Scatter widget created");

			var scatter = GEPPETTO.Scatter3dController.getWidgets()[0];

			equal(scatter.isVisible(), true, "Test Default Visibility");

			scatter.hide();

			equal(scatter.isVisible(), false, "Test hide()");

			scatter.show();

			equal(scatter.isVisible(), true, "Test show()");

			scatter.destroy();

			equal($("#" + scatter.getId()).html(), null, "Test destroy()");
		});
		
		test("Test Commands", function() {
			G.showConsole(true);
			
			equal(GEPPETTO.Console.isConsoleVisible(), true, "Console Visible");
			
			G.showConsole(false);
			
			equal(GEPPETTO.Console.isConsoleVisible(), false, "Console hidden");
			
			G.showShareBar(true);
			
			equal(GEPPETTO.Share.isVisible(), true, "ShareBar Visible");
			
			G.showShareBar(false);
			
			equal(GEPPETTO.Share.isVisible(), false, "ShareBar hidden");
			
			equal(G.shareOnTwitter(), GEPPETTO.Resources.SHARE_ON_TWITTER, "Share On Twitter");
						
			equal(G.shareOnFacebook(), GEPPETTO.Resources.SHARE_ON_FACEBOOK, "Share On Facebook");
		});
		
		
		test("Test Copy History To Clipboard", function() {

			equal(G.copyHistoryToClipboard(), GEPPETTO.Resources.EMPTY_CONSOLE_HISTORY, "No commands to copy, test passed");

			//add some commands to history
			GEPPETTO.Console.executeCommand("G.help();");
			GEPPETTO.Console.executeCommand("help();");
			GEPPETTO.Console.executeCommand("Simulation.start()");

			equal(G.copyHistoryToClipboard(), GEPPETTO.Resources.COPY_CONSOLE_HISTORY, "Commands copied, test passed");		
		});
	};
	return {run: run};

});

