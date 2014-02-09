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
 *     	OpenWorm - http://openworm.org/people.html
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
package org.geppetto.frontend;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UnsupportedEncodingException;
import java.net.MalformedURLException;
import java.net.URL;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Properties;
import java.util.concurrent.ConcurrentHashMap;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.geppetto.core.common.GeppettoExecutionException;
import org.geppetto.core.common.GeppettoInitializationException;
import org.geppetto.core.common.LZ4Compress;
import org.geppetto.core.data.model.VariableList;
import org.geppetto.core.data.model.WatchList;
import org.geppetto.core.simulation.ISimulationCallbackListener;
import org.geppetto.frontend.GeppettoMessageInbound.VisitorRunMode;
import org.geppetto.frontend.SimulationServerConfig.ServerBehaviorModes;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.context.support.SpringBeanAutowiringSupport;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/**
 * Class that handles the Web Socket connections the servlet is receiving.
 * 
 * 
 * @author Jesus R. Martinez (jesus@metacell.us)
 * 
 */
public class GeppettoServletController
{

	private static Log _logger = LogFactory.getLog(GeppettoServletController.class);

	@Autowired
	private SimulationServerConfig _simulationServerConfig;

	private static GeppettoServletController _instance = null;

	private ISimulationCallbackListener _simulationCallbackListener;

	private final ConcurrentHashMap<String, GeppettoMessageInbound> _connections = new ConcurrentHashMap<String, GeppettoMessageInbound>();

	private List<GeppettoMessageInbound> _queueUsers = new ArrayList<GeppettoMessageInbound>();

	private List<GeppettoMessageInbound> _observers = new ArrayList<GeppettoMessageInbound>();

	private boolean _simulationInUse = false;

	protected GeppettoServletController()
	{
		SpringBeanAutowiringSupport.processInjectionBasedOnCurrentContext(this);

	}

	public static GeppettoServletController getInstance()
	{
		if(_instance == null)
		{
			_instance = new GeppettoServletController();
		}
		return _instance;
	}

	/**
	 * Add new connection to list of current ones
	 * 
	 * @param newVisitor
	 *            - New connection to be added to current ones
	 * @throws GeppettoExecutionException 
	 */
	public void addConnection(GeppettoMessageInbound newVisitor) throws GeppettoExecutionException
	{
		_connections.put(newVisitor.getConnectionID(), newVisitor);

		performStartUpCheck(newVisitor);
	}

	/**
	 * Remove connection from list of current ones.
	 * 
	 * @param exitingVisitor
	 *            - Connection to be removed
	 * @throws GeppettoExecutionException 
	 */
	public void removeConnection(GeppettoMessageInbound exitingVisitor) throws GeppettoExecutionException
	{
		if(_connections.contains(exitingVisitor))
		{
			_connections.remove(exitingVisitor.getConnectionID());
			// Handle operations after user closes connection
			postClosingConnectionCheck(exitingVisitor);
		}
	}

	/**
	 * Performs start up check when new connection is established.
	 * 
	 * @param newVisitor
	 *            - New visitor
	 * @throws GeppettoExecutionException 
	 */
	private void performStartUpCheck(GeppettoMessageInbound newVisitor) throws GeppettoExecutionException
	{

		if(this._simulationServerConfig.getServerBehaviorMode() == ServerBehaviorModes.OBSERVE)
		{
			// Simulation is being used, notify new user controls are unavailable
			if(isSimulationInUse())
			{
				simulationControlsUnavailable(newVisitor);
			}
			else
			{
				messageClient(null, newVisitor, OUTBOUND_MESSAGE_TYPES.READ_URL_PARAMETERS);
			}
		}
		else if(this._simulationServerConfig.getServerBehaviorMode() == ServerBehaviorModes.MULTIUSER)
		{
			int simulatorCapacity = newVisitor.getSimulationService().getSimulatorCapacity();

			if((this.getConnections().size() > simulatorCapacity) && (simulatorCapacity > 1))
			{

				int position = (this.getConnections().size() - newVisitor.getSimulationService().getSimulatorCapacity());
				String update = "{ \"simulatorName\":" + '"' + newVisitor.getSimulationService().getSimulatorName() + '"' + ", \"queuePosition\": " + position + "}";

				_queueUsers.add(newVisitor);
				messageClient(null, newVisitor, OUTBOUND_MESSAGE_TYPES.SIMULATOR_FULL, update);
			}
			else
			{
				messageClient(null, newVisitor, OUTBOUND_MESSAGE_TYPES.READ_URL_PARAMETERS);
			}
		}
	}

	/**
	 * Return all the current web socket connections
	 * 
	 * @return
	 */
	public Collection<GeppettoMessageInbound> getConnections()
	{
		return Collections.unmodifiableCollection(_connections.values());
	}

	/**
	 * Attempt to load simulation
	 * 
	 * @param simulation
	 *            - Simulation to load
	 * @param visitor
	 *            - Visitor doing the loading
	 * @throws GeppettoExecutionException 
	 */
	public void load(String requestID, String simulation, GeppettoMessageInbound visitor) throws GeppettoExecutionException
	{

		// Determine current mode of Geppetto
		switch(_simulationServerConfig.getServerBehaviorMode())
		{
		// Handle multi user mode
			case MULTIUSER:
				_simulationCallbackListener = new MultiuserSimulationCallback(visitor);
				loadInMultiUserMode(requestID, simulation, visitor);
				break;

			// Handle observe mode
			case OBSERVE:
				_simulationCallbackListener = ObservermodeSimulationCallback.getInstance();
				loadInObserverMode(requestID, simulation, visitor);
				break;
			default:
				break;
		}
	}

	/**
	 * Handle multiuser mode
	 * 
	 * @param simulation
	 *            - Simulation to be loaded
	 * @param visitor
	 *            - Visitor doing the loading of simulation
	 * @throws GeppettoExecutionException 
	 */
	private void loadInMultiUserMode(String requestID, String simulation, GeppettoMessageInbound visitor) throws GeppettoExecutionException
	{
		visitor.setIsSimulationLoaded(false);
		loadSimulation(requestID, simulation, visitor);
	}

	/**
	 * Handle observer mode
	 * 
	 * @param simulation
	 *            - Simulation to be loaded
	 * @param visitor
	 *            - Visitor doing the loading of simulation
	 * @throws GeppettoExecutionException 
	 */
	private void loadInObserverMode(String requestID, String simulation, GeppettoMessageInbound visitor) throws GeppettoExecutionException
	{
		// Simulation already in use
		if(isSimulationInUse())
		{
			switch(visitor.getCurrentRunMode())
			{
			// user attempting load is already in control of simulation servlet
				case CONTROLLING:
					_simulationServerConfig.setIsSimulationLoaded(false);
					// Clear canvas of users connected for new model to be loaded
					for(GeppettoMessageInbound observer : _observers)
					{
						messageClient(null, observer, OUTBOUND_MESSAGE_TYPES.RELOAD_CANVAS);
					}
					loadSimulation(requestID, simulation, visitor);
					break;
				case WAITING:
					// Do Nothing
					break;
				// user attempting to load can't do so since it's not user in control
				case OBSERVING:
					simulationControlsUnavailable(visitor);
					break;
			}
		}
		// simulation not in use
		else
		{
			_simulationServerConfig.setIsSimulationLoaded(false);

			// load simulation
			_simulationInUse = loadSimulation(requestID, simulation, visitor);

			// Simulation just got someone to control it, notify everyone else
			// connected that simulation controls are unavailable.
			for(GeppettoMessageInbound connection : getConnections())
			{
				if(connection != visitor)
				{
					simulationControlsUnavailable(connection);
				}
			}
		}
	}

	/**
	 * Load simulation
	 * 
	 * @param simulation
	 *            - Simulation to load
	 * @param visitor
	 *            - Visitor doing the loading of simulation
	 * 
	 * @return {boolean} - Success or failure
	 * @throws GeppettoExecutionException 
	 */
	private boolean loadSimulation(String requestID, String simulation, GeppettoMessageInbound visitor) throws GeppettoExecutionException
	{

		boolean loaded = false;

		URL url = null;

		// attempt to convert simulation to URL
		try
		{
			url = new URL(simulation);
			// simulation is URL, initialize simulation services
			visitor.getSimulationService().init(url, _simulationCallbackListener);
			postLoadSimulation(requestID, visitor);
			loaded = true;
		}
		/*
		 * Unable to make url from simulation, must be simulation content. URL validity checked in GeppettoMessageInbound prior to call here
		 */
		catch(MalformedURLException e)
		{
			try
			{
				visitor.getSimulationService().init(simulation, _simulationCallbackListener);
				postLoadSimulation(requestID, visitor);
				loaded = true;
			}
			catch(GeppettoInitializationException e1)
			{
				messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.ERROR_LOADING_SIMULATION);
				loaded = false;
			}
		}
		catch(GeppettoInitializationException e)
		{
			messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.ERROR_LOADING_SIMULATION);
			loaded = false;
		}

		// set user as controlling
		visitor.setVisitorRunMode(VisitorRunMode.CONTROLLING);

		return loaded;
	}

	public SimulationServerConfig getSimulationServerConfig()
	{
		return _simulationServerConfig;
	}

	/**
	 * Runs scripts that are specified in the simulation
	 * 
	 * @param requestID
	 *            - requestID received from client
	 * @param visitor
	 *            - Visitor loading the simulation
	 * @throws GeppettoExecutionException 
	 */
	private void postLoadSimulation(String requestID, GeppettoMessageInbound visitor) throws GeppettoExecutionException
	{

		messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.SIMULATION_LOADED);

		JsonObject scriptsJSON = new JsonObject();

		JsonArray scriptsArray = new JsonArray();
		for(URL scriptURL : visitor.getSimulationService().getScripts())
		{
			JsonObject script = new JsonObject();
			script.addProperty("script", scriptURL.toString());

			scriptsArray.add(script);
		}
		scriptsJSON.add("scripts", scriptsArray);

		// notify client if there are scripts
		if(visitor.getSimulationService().getScripts().size() > 0)
		{
			messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.FIRE_SIM_SCRIPTS, scriptsJSON.toString());
		}
	}

	/**
	 * Start the simulation
	 */
	public void startSimulation(String requestID, GeppettoMessageInbound controllingUser)
	{
		try
		{
			controllingUser.getSimulationService().start();
			// notify user simulation has started
			messageClient(requestID, controllingUser, OUTBOUND_MESSAGE_TYPES.SIMULATION_STARTED);
		}
		catch(GeppettoExecutionException e)
		{
			throw new RuntimeException(e);
		}
	}

	/**
	 * Pause the simulation
	 */
	public void pauseSimulation(String requestID, GeppettoMessageInbound controllingUser)
	{
		try
		{
			controllingUser.getSimulationService().pause();
			// notify user simulation has been paused
			messageClient(requestID, controllingUser, OUTBOUND_MESSAGE_TYPES.SIMULATION_PAUSED);
		}
		catch(GeppettoExecutionException e)
		{
			throw new RuntimeException(e);
		}
	}

	/**
	 * Stop the running simulation
	 */
	public void stopSimulation(String requestID, GeppettoMessageInbound controllingUser)
	{
		try
		{
			controllingUser.getSimulationService().stop();
			// notify user simulation has been stopped
			messageClient(requestID, controllingUser, OUTBOUND_MESSAGE_TYPES.SIMULATION_STOPPED);
		}
		catch(GeppettoExecutionException e)
		{
			throw new RuntimeException(e);
		}
	}

	/**
	 * Add visitor to list users Observing simulation
	 * 
	 * @param observingVisitor
	 *            - Geppetto visitor joining list of simulation observers
	 * @throws GeppettoExecutionException 
	 */
	public void observeSimulation(String requestID, GeppettoMessageInbound observingVisitor) throws GeppettoExecutionException
	{
		_observers.add(observingVisitor);

		observingVisitor.setVisitorRunMode(VisitorRunMode.OBSERVING);

		if(!observingVisitor.getSimulationService().isRunning())
		{
			messageClient(requestID, observingVisitor, OUTBOUND_MESSAGE_TYPES.LOAD_MODEL, getSimulationServerConfig().getLoadedScene());
		}
		// Notify visitor they are now in Observe Mode
		messageClient(requestID, observingVisitor, OUTBOUND_MESSAGE_TYPES.OBSERVER_MODE);
	}

	/**
	 * Request list of watchable variables for the simulation
	 * 
	 * @throws JsonProcessingException
	 * @throws GeppettoExecutionException 
	 */
	public void listWatchableVariables(String requestID, GeppettoMessageInbound visitor) throws JsonProcessingException, GeppettoExecutionException
	{
		// get watchable variables for the entire simulation
		VariableList vars = visitor.getSimulationService().listWatchableVariables();

		// serialize
		ObjectMapper mapper = new ObjectMapper();
		String serializedVars = mapper.writer().writeValueAsString(vars);

		// message the client with results
		this.messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.LIST_WATCH_VARS, serializedVars);
	}

	/**
	 * Request list of forceable variables for the simulation
	 * 
	 * @throws JsonProcessingException
	 * @throws GeppettoExecutionException 
	 */
	public void listForceableVariables(String requestID, GeppettoMessageInbound visitor) throws JsonProcessingException, GeppettoExecutionException
	{
		// get forceable variables for the entire simulation
		VariableList vars = visitor.getSimulationService().listForceableVariables();

		// serialize
		ObjectMapper mapper = new ObjectMapper();
		String serializedVars = mapper.writer().writeValueAsString(vars);

		// message the client with results
		this.messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.LIST_FORCE_VARS, serializedVars);
	}

	/**
	 * Adds watch lists with variables to be watched
	 * 
	 * @throws GeppettoExecutionException
	 */
	public void addWatchLists(String requestID, String jsonLists, GeppettoMessageInbound visitor) throws GeppettoExecutionException
	{
		List<WatchList> lists = null;

		try
		{
			lists = fromJSON(new TypeReference<List<WatchList>>()
			{
			}, jsonLists);
		}
		catch(GeppettoExecutionException e)
		{
			throw new RuntimeException(e);
		}

		// TODO: do a check that variables with those names actually exists for the current simulation
		// TODO: throw exception if not

		visitor.getSimulationService().addWatchLists(lists);

		// message the client the watch lists were added
		messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.SET_WATCH_LISTS);
	}

	/**
	 * instructs simulation to start sending watched variables value to the client
	 * 
	 * @param requestID
	 * @throws JsonProcessingException
	 * @throws GeppettoExecutionException 
	 */
	public void startWatch(String requestID, GeppettoMessageInbound visitor) throws JsonProcessingException, GeppettoExecutionException
	{
		visitor.getSimulationService().startWatch();

		List<WatchList> watchLists = visitor.getSimulationService().getWatchLists();

		// serialize watch-lists
		ObjectMapper mapper = new ObjectMapper();
		String serializedLists = mapper.writer().writeValueAsString(watchLists);

		// message the client the watch lists were started
		messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.START_WATCH, serializedLists);
	}

	/**
	 * instructs simulation to stop sending watched variables value to the client
	 * @throws GeppettoExecutionException 
	 */
	public void stopWatch(String requestID, GeppettoMessageInbound visitor) throws GeppettoExecutionException
	{
		visitor.getSimulationService().stopWatch();

		// message the client the watch lists were stopped
		messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.STOP_WATCH);
	}

	/**
	 * instructs simulation to clear watch lists
	 * @throws GeppettoExecutionException 
	 */
	public void clearWatchLists(String requestID, GeppettoMessageInbound visitor) throws GeppettoExecutionException
	{
		visitor.getSimulationService().clearWatchLists();

		// message the client the watch lists were cleared
		messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.CLEAR_WATCH);
	}

	/**
	 * Get simulation watch lists
	 * 
	 * @throws JsonProcessingException
	 * @throws GeppettoExecutionException 
	 */
	public void getWatchLists(String requestID, GeppettoMessageInbound visitor) throws JsonProcessingException, GeppettoExecutionException
	{
		List<WatchList> watchLists = visitor.getSimulationService().getWatchLists();

		// serialize watch-lists
		ObjectMapper mapper = new ObjectMapper();
		String serializedLists = mapper.writer().writeValueAsString(watchLists);

		// message the client with results
		this.messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.GET_WATCH_LISTS, serializedLists);
	}

	/**
	 * Simulation is being controlled by another user, new visitor that just loaded Geppetto Simulation in browser is notified with an alert message of status of simulation.
	 * 
	 * @param id
	 *            - ID of new Websocket connection.
	 * @throws GeppettoExecutionException 
	 */
	public void simulationControlsUnavailable(GeppettoMessageInbound visitor) throws GeppettoExecutionException
	{
		messageClient(null, visitor, OUTBOUND_MESSAGE_TYPES.SERVER_UNAVAILABLE);
	}

	/**
	 * On closing a client connection (WebSocket Connection), perform check to see if user leaving was the one in control of simulation if it was running.
	 * 
	 * @param id
	 *            - WebSocket ID of user closing connection
	 * @throws GeppettoExecutionException 
	 */
	public void postClosingConnectionCheck(GeppettoMessageInbound exitingVisitor) throws GeppettoExecutionException
	{

		if(this._simulationServerConfig.getServerBehaviorMode() == ServerBehaviorModes.MULTIUSER)
		{
			int simulatorCapacity = exitingVisitor.getSimulationService().getSimulatorCapacity();

			if(this.getConnections().size() == simulatorCapacity)
			{
				GeppettoMessageInbound nextVisitorInLine = this._queueUsers.get(0);
				messageClient(null, nextVisitorInLine, OUTBOUND_MESSAGE_TYPES.SERVER_AVAILABLE);
			}
		}

		/*
		 * If the exiting visitor was running the simulation, notify all the observing visitors that the controls for the simulation became available
		 */
		if(exitingVisitor.getCurrentRunMode() == GeppettoMessageInbound.VisitorRunMode.CONTROLLING)
		{

			// Controlling user is leaving, but simulation might still be running.
			try
			{
				if(exitingVisitor.getSimulationService().isRunning())
				{
					// Pause running simulation upon controlling user's exit
					exitingVisitor.getSimulationService().stop();
				}
			}
			catch(GeppettoExecutionException e)
			{
				e.printStackTrace();
			}

			// Notify all observers
			for(GeppettoMessageInbound visitor : _observers)
			{
				// visitor.setVisitorRunMode(VisitorRunMode.DEFAULT);
				// send message to alert client of server availability
				messageClient(null, visitor, OUTBOUND_MESSAGE_TYPES.SERVER_AVAILABLE);
			}

			_simulationInUse = false;

		}

		/*
		 * Closing connection is that of a visitor in OBSERVE mode, remove the visitor from the list of observers.
		 */
		else if(exitingVisitor.getCurrentRunMode() == GeppettoMessageInbound.VisitorRunMode.OBSERVING)
		{
			// User observing simulation is closing the connection
			if(_observers.contains(exitingVisitor))
			{
				// Remove user from observers list
				_observers.remove(exitingVisitor);
			}
			// User observing simulation is closing the connection
			if(_queueUsers.contains(exitingVisitor))
			{
				// Remove user from observers list
				_queueUsers.remove(exitingVisitor);
			}
		}
	}

	/**
	 * Requests JSONUtility class for a json object with a message to send to the client
	 * 
	 * @param requestID
	 * 
	 * @param connection
	 *            - client to receive the message
	 * @param type
	 *            - type of message to be send
	 * @param string
	 * @throws GeppettoExecutionException 
	 */
	public void messageClient(String requestID, GeppettoMessageInbound connection, OUTBOUND_MESSAGE_TYPES type) throws GeppettoExecutionException
	{
		// get transport message to be sent to the client
		GeppettoTransportMessage transportMsg = TransportMessageFactory.getTransportMessage(requestID, type, null);
		String msg = new Gson().toJson(transportMsg);

		// Send the message to the client
		try
		{
			sendMessage(connection, LZ4Compress.compressString(msg));
		}
		catch(UnsupportedEncodingException e)
		{
			throw new GeppettoExecutionException(e);
		}
	}

	/**
	 * Requests JSONUtility class for a json object with simulation update to be send to the client
	 * 
	 * @param connection
	 *            - client to receive the simulation update
	 * @param connection
	 *            - Type of udpate to be send
	 * @param reloadCanvas
	 *            - update to be sent
	 * @throws GeppettoExecutionException
	 */
	public void messageClient(String requestID, GeppettoMessageInbound connection, OUTBOUND_MESSAGE_TYPES type, String update) throws GeppettoExecutionException
	{
		// get transport message to be sent to the client
		GeppettoTransportMessage transportMsg = TransportMessageFactory.getTransportMessage(requestID, type, update);
		String msg = new Gson().toJson(transportMsg);

		try
		{
			sendMessage(connection, LZ4Compress.compressString(msg));
		}
		catch(UnsupportedEncodingException e)
		{
			throw new GeppettoExecutionException(e);
		}

	}

	/**
	 * Sends a message to a specific user. The id of the WebSocket connection is used to contact the desired user.
	 * 
	 * @param id
	 *            - ID of WebSocket connection that will be sent a message
	 * @param msg
	 *            - The message the user will be receiving
	 */
	public void sendMessage(GeppettoMessageInbound visitor, byte[] msg)
	{
		try
		{
			long startTime = System.currentTimeMillis();
			ByteBuffer buffer = ByteBuffer.wrap(msg);
			visitor.getWsOutbound().writeBinaryMessage(buffer);
			visitor.getWsOutbound().flush();
			String debug = ((long) System.currentTimeMillis() - startTime) + "ms were spent sending a message of " + msg.length / 1024 + "KB to the client";
			_logger.info(debug);
		}
		catch(IOException ignore)
		{
			_logger.error("Unable to communicate with client " + ignore.getMessage());
		}
	}

	/**
	 * Returns status of server simulation used
	 * 
	 * @return
	 */
	public boolean isSimulationInUse()
	{
		return _simulationInUse;
	}

	public void getSimulationConfiguration(String requestID, String url, GeppettoMessageInbound visitor) throws GeppettoExecutionException
	{
		String simulationConfiguration;

		try
		{
			simulationConfiguration = visitor.getSimulationService().getSimulationConfig(new URL(url));
			messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.SIMULATION_CONFIGURATION, simulationConfiguration);
		}
		catch(MalformedURLException e)
		{
			messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.ERROR_LOADING_SIMULATION_CONFIG);
		}
		catch(GeppettoInitializationException e)
		{
			messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.ERROR_LOADING_SIMULATION_CONFIG);
		}
	}

	public void getVersionNumber(String requestID, GeppettoMessageInbound visitor) throws GeppettoExecutionException
	{

		Properties prop = new Properties();

		try
		{
			prop.load(GeppettoServletController.class.getResourceAsStream("/Geppetto.properties"));
			messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.GEPPETTO_VERSION, prop.getProperty("Geppetto.version"));
		}
		catch(IOException e)
		{
			e.printStackTrace();
		}
	}

	/**
	 * Sends parsed data from script to visitor client
	 * 
	 * @param requestID
	 *            - Requested ID for process
	 * @param url
	 *            - URL of script location
	 * @param visitor
	 *            - Client doing the operation
	 * @throws GeppettoExecutionException 
	 */
	public void sendScriptData(String requestID, URL url, GeppettoMessageInbound visitor) throws GeppettoExecutionException
	{
		try
		{
			String line = null;
			StringBuilder sb = new StringBuilder();

			BufferedReader br = new BufferedReader(new InputStreamReader(url.openStream()));

			while((line = br.readLine()) != null)
			{
				sb.append(line + "\n");
			}
			String script = sb.toString();

			messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.RUN_SCRIPT, script);
		}
		catch(IOException e)
		{
			messageClient(requestID, visitor, OUTBOUND_MESSAGE_TYPES.ERROR_READING_SCRIPT);
		}
	}

	public static <T> T fromJSON(final TypeReference<T> type, String jsonPacket) throws GeppettoExecutionException
	{
		T data = null;

		try
		{
			data = new ObjectMapper().readValue(jsonPacket, type);
		}
		catch(Exception e)
		{
			throw new GeppettoExecutionException("could not de-serialize json");
		}
		return data;
	}

	public void disableUser(String requestID, GeppettoMessageInbound visitor) throws GeppettoExecutionException
	{
		_connections.remove(visitor.getConnectionID());
		postClosingConnectionCheck(visitor);
	}
}
