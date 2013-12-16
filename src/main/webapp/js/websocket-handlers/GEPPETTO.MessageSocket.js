/*******************************************************************************
 * The MIT License (MIT)
 * 
 * Copyright (c) 2011, 2013 OpenWorm. http://openworm.org
 * 
 * All rights reserved. This program and the accompanying materials are made
 * available under the terms of the MIT License which accompanies this
 * distribution, and is available at http://opensource.org/licenses/MIT
 * 
 * Contributors: OpenWorm - http://openworm.org/people.html
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
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 ******************************************************************************/

GEPPETTO.MessageSocket = GEPPETTO.MessageSocket || {
	REVISION : '1'
};

/**
 * 
 * WebSocket class use for communication between client and server
 * 
 * @author Jesus R. Martinez (jesus@metacell.us)
 */
(function() {

	var waitingForServletResponse = false;

	var messageHandlers = [];

	var clientID = null;

	var nextID = 0;

	/**
	 * Web socket creation and communication
	 */
	GEPPETTO.MessageSocket.connect = (function(host) {
		if ('WebSocket' in window) {
			GEPPETTO.MessageSocket.socket = new WebSocket(host);
		} else if ('MozWebSocket' in window) {
			GEPPETTO.MessageSocket.socket = new MozWebSocket(host);
		} else {
			GEPPETTO.Console.debugLog(WEBSOCKET_NOT_SUPPORTED);
			return;
		}

		GEPPETTO.MessageSocket.socket.onopen = function() {
			GEPPETTO.Console.debugLog(WEBSOCKET_OPENED);

			// attach the handlers once socket is opened
			messageHandlers.push(GEPPETTO.SimulationHandler);
			messageHandlers.push(GEPPETTO.GlobalHandler);

		};

		GEPPETTO.MessageSocket.socket.onclose = function() {
			GEPPETTO.Console.debugLog(WEBSOCKET_CLOSED);
		};

		GEPPETTO.MessageSocket.bufferFromUTFString =function (str) {
			  var bytes = []
			    , tmp
			    , ch;

			  for(var i = 0, len = str.length; i < len; ++i) {
			    ch = str.charCodeAt(i);
			    if(ch & 0x80) {
			      tmp = encodeURIComponent(str.charAt(i)).substr(1).split('%');
			      for(var j = 0, jlen = tmp.length; j < jlen; ++j) {
			        bytes[bytes.length] = parseInt(tmp[j], 16);
			      }
			    } else {
			      bytes[bytes.length] = ch ;
			    }
			  }

			  return new Uint8Array(bytes);
			};

		function uintToString(uintArray) {
		    var encodedString = String.fromCharCode.apply(null, uintArray),
		        decodedString = decodeURIComponent(escape(encodedString));
		    return decodedString;
		}
		
		GEPPETTO.MessageSocket.socket.onmessage = function(msg) {

			waitingForServletResponse = false;
			var uint8buf=GEPPETTO.MessageSocket.bufferFromUTFString(msg.data);
			var inputBuffer = new Buffer(uint8buf,"UTF8");

			var decompressedData = lz4.LZ4_uncompress(inputBuffer);
			var parsedServerMessage = JSON.parse(decompressedData);

			// notify all handlers
			for ( var i = 0, len = messageHandlers.length; i < len; i++) {
				messageHandlers[i].onMessage(parsedServerMessage);
			}
		};

		// Detects problems when connecting to Geppetto server
		GEPPETTO.MessageSocket.socket.onerror = function(evt) {
			var message = "Error communicating with Geppetto servlet \n"
					+ "Reload page if problems persits";

			GEPPETTO.FE.infoDialog(WEBSOCKET_CONNECTION_ERROR, message);
		};
	});

	GEPPETTO.MessageSocket.send = function(command, parameter) {
		GEPPETTO.MessageSocket.socket.send(messageTemplate(command, parameter));
		if (command.indexOf("init") > -1) {
			waitingForServletResponse = true;
		}
	};

	GEPPETTO.MessageSocket.isReady = function() {
		return GEPPETTO.MessageSocket.socket.readyState;
	};

	GEPPETTO.MessageSocket.close = function() {
		GEPPETTO.MessageSocket.socket.close();
		messageHandlers = [];
	};

	GEPPETTO.MessageSocket.addHandler = function(handler) {
		messageHandlers.push(handler);
	};

	GEPPETTO.MessageSocket.isServletBusy = function() {
		return waitingForServletResponse;
	};

	GEPPETTO.MessageSocket.setClientID = function(id) {
		clientID = id;
	};

	GEPPETTO.MessageSocket.getRequestID = function() {
		return clientID + "-" + (nextID++);
	};
})();

/**
 * Template for Geppetto message
 * 
 * @param msgtype -
 *            message type
 * @param payload -
 *            message payload, can be anything
 * @returns JSON stringified object
 */
function messageTemplate(msgtype, payload) {

	if (!(typeof payload == 'string' || payload instanceof String)) {
		payload = JSON.stringify(payload);
	}

	var object = {
		requestID : GEPPETTO.MessageSocket.getRequestID(),
		type : msgtype,
		data : payload
	};
	return JSON.stringify(object);
};
