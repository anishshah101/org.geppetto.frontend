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
 * Front end, user interface, methods for handling updates to the UI
 *
 */
define(function(require) {

    return function(GEPPETTO) {

        var React = require('react'),
                $ = require('jquery'),
                InfoModal = require('jsx!components/popups/InfoModal'),
                ErrorModal = require('jsx!components/popups/ErrorModal');
        /**
         * Create the container for holding the canvas
         * @class GEPPETTO.FE
         */
        GEPPETTO.FE = {
            /*
             * Handles events that are executed as soon as page is finished loading
             */
            initialEvents: function() {

                GEPPETTO.Console.createConsole();

                GEPPETTO.Vanilla.enableKeyboard(false);

                /*
                 * Dude to bootstrap bug, multiple modals can't be open at same time. This line allows
                 * multiple modals to be open simultaneously without going in an infinite loop.
                 */
                $.fn.modal.Constructor.prototype.enforceFocus = function() {
                };

                var share = $("#share");

                share.click(function() {

                    //toggle button class
                    share.toggleClass('clicked');

                    //user has clicked the console button
                    var command = (share.hasClass('clicked')) ? "true" : "false";
                    GEPPETTO.Console.executeCommand("G.showShareBar(" + command + ")");
                    return false;
                });

            },
            /**
             * Enables controls after connection is established
             */
            postSocketConnection: function() {
                GEPPETTO.Vanilla.enableKeyboard(true);
            },
            createContainer: function() {
                $("#sim canvas").remove();
                return $("#sim").get(0);
            },
            /**
             * Handles updating the front end after re-loading the simulation
             */
            SimulationReloaded: function() {
                //delete all existing widgets
                GEPPETTO.WidgetsListener.update(GEPPETTO.WidgetsListener.WIDGET_EVENT_TYPE.DELETE);
            },
            /**
             * Show error message if webgl failed to start
             */
            update: function(webGLStarted) {
                //
                if (!webGLStarted) {
                    GEPPETTO.Console.debugLog(GEPPETTO.Resources.WEBGL_FAILED);
                    GEPPETTO.FE.disableSimulationControls();
                    GEPPETTO.FE.infoDialog(GEPPETTO.Resources.WEBGL_FAILED, GEPPETTO.Resources.WEBGL_MESSAGE);
                }
            },
            /**
             * Show dialog informing users of server being used and
             * gives them the option to Observer ongoing simulation.
             *
             * @param msg
             */
            observersDialog: function(title, msg) {
                React.renderComponent(
                        InfoModal({
                            show: true,
                            keyboard: false,
                            title: title,
                            txt: msg,
                            onClick: GEPPETTO.Main.observe,
                            buttonLabel: '<i class="icon-eye-open "></i> Observe'
                        }),
                        document.getElementById('modal-region'));

                //black out welcome message
                $('#welcomeMessageModal').css('opacity', '0.0');
            },
            /**
             * Basic Dialog box with message to display.
             *
             * @method
             *
             * @param title - Title of message
             * @param msg - Message to display
             */
            infoDialog: function(title, msg) {
                React.renderComponent(InfoModal({
                    show: true,
                    keyboard: false,
                    title: title,
                    text: msg,
                }), document.getElementById('modal-region'));
            },
            /**
             * Dialog box to display error messages.
             *
             * @method
             *
             * @param title - Notifying error
             * @param msg - Message to display for error
             * @param code - Error code of message
             * @param source - Source error to display
             * @param exception - Exception to display
             */
            errorDialog: function(title, msg, code, source, exception) {
                React.renderComponent(ErrorModal({
                    show: true,
                    keyboard: false,
                    title: title,
                    text: msg,
                    code: code,
                    source: source,
                    exception: exception
                }), document.getElementById('modal-region'));
            },
            /**
             * Create bootstrap alert to notify users they are in observer mode
             *
             * @param title
             * @param alertMsg
             * @param popoverMsg
             */
            observersAlert: function(title, alertMsg, popoverMsg) {
                //if welcome message is open, return normal opacity after user clicked observed
                if (($('#welcomeMessageModal').hasClass('in'))) {
                    $('#welcomeMessageModal').css('opacity', '1.0');
                }
                $('#alertbox-text').html(alertMsg);
                $('#alertbox').show();
                $("#infopopover").popover({title: title,
                    content: popoverMsg});
            },
            /**
             * If simulation is being controlled by another user, hide the
             * control and load buttons. Show "Observe" button only.
             */
            disableSimulationControls: function() {
                GEPPETTO.trigger('simulation:disable_all');
                
                //disable console buttons
                $('#consoleButton').attr('disabled', 'disabled');
                $('#commandInputArea').attr('disabled', 'disabled');

                //disable keyboard
                document.removeEventListener("keydown", GEPPETTO.Vanilla.checkKeyboard);
            },
            /**
             * Show Notification letting user now of full simulator
             */
            fullSimulatorNotification: function(simulatorName, queuePosition) {

                $('#capacityNotificationTitle').html(simulatorName + GEPPETTO.Resources.SIMULATOR_UNAVAILABLE);

                $('#queuePosition').html(queuePosition);

                $('#multiUserNotification').modal();
            }
        };

    };
});
