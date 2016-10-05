var UpdateMsgBoxObserver = function(topicStr){
	
	if(topicStr === undefined || topicStr.length === 0){
		throw new Error('topic must be defined');
	}
	this.topic = topicStr;
	this.update = function(topic, message){
		if(topic.match(/device\/VHandScan001\/status/)){
			TokenReaderController.updateMsgBox(topic, message,'sub');
		}
		
	}
}


var UpdateSmoothieObserver = function(topicStr){
	
	if(topicStr === undefined || topicStr.length === 0){
		throw new Error('topic must be defined');
	}
	this.topic = topicStr;
	this.update = function(topic, message){
		if(topic.match(/device\/VHandScan001\/status/)){
			TokenReaderController.updateSmoothie(smoothieObj)
		}
		
	}
}
/**
 * Wrapper for Paho MQTT client class.
 * Allows host, port and client id to be set.
 * Observable object in observer pattern that notifies observers when a new MQTT message is received.
 */
VirtualTokenReaderClient = (function(Paho){
	
	var _host; //string
	var _port; //number
	var _id; //string
	var _observers = []; //array of Observer objects
	var _client; //Paho.MQTT.Client Object
	var _topics = []; //array of MQTT topic strings
	var _smoothieObj;
	var _showSmoothie;//boolean for showing topic messages in Smoothie graph
	
	var setClient = function(host,port,id){
		
		if(typeof host !=='string' ){
			throw new Error('host must be a string');
		}
		
		if(typeof port !=='number' ){
			throw new Error('port must be a number');
		}
		
		if(typeof id !=='string' ){
			throw new Error('id must be a string');
		}
		_host = host;
		_port = port;
		_id = id;
		
		_client = new Paho.MQTT.Client(host, port, id);
	}
	
	var connect = function(){
		_client.onConnectionLost = onConnectionLost;
		_client.onMessageArrived = onMessageArrived;

		if(_showSmoothie){
			if(_client.onMessageDelivered == undefined){
				_client.onMessageDelivered = onMessageDelivered;
			}
			
		}
		
		_client.connect({onSuccess:onConnect});
	}
	
	var onMessageDelivered = function(message){
		if(_smoothieObj !== undefined ){
			_smoothieObj.addPubMessageLog();
		}
		
		var topic = message.destinationName;
		var payload = JSON.parse(message.payloadString);
		
		TokenReaderController.updateMsgBox(topic, payload, 'pub')
	}
	
	//Set the MQTT client to subscribe to every topic in the _topics array
	function onConnect(){
		
		for(var i=0; i< _topics.length; i++){
			_client.subscribe(_topics[i]);
		}
		console.log('connected to broker');
		
	}
	
	//Parse JSON payload string into JSON object.
	//Start process of updating the DOM by calling notify()
	function onMessageArrived(message) {
	   console.log("onMessageArrived:"+message.payloadString);
	   messageJSON = JSON.parse(message.payloadString);
	   notify(message.destinationName, messageJSON );
 
	}
	
	
	function onConnectionLost(responseObject) {
		  if (responseObject.errorCode !== 0) {
		    console.log("onConnectionLost:"+responseObject.errorMessage);
		    TokenReaderController.showDisconnectMessageBox(responseObject.errorMessage);
		  }
	}
	
	var add = function(observer){
		_observers.push(observer);
		_topics.push(observer.topic);
	}
	
	var publish = function(topic, payload){
		
		if(topic === undefined || topic.length === 0){
			throw new Error('topic must be defined');
		}
		
		//var message = new Paho.MQTT.Message(payload);
		//message.destinationName = topic;
		_client.send(topic, payload, 1 , false)
	}

	var remove = function(observerObj){
		
		for(var i =0;i<_observers.length;i++){
			if(_observers[i].constructor.name === observerObj.constructor.name){
				var index = _topics.indexOf(_observers[i].topic);
				_topics.splice(i,1)
				_observers.splice(i,1);
				
				break;
			}
		}

	}
	
	//Iterate over observers with received message and topic. 
	//Every observer checks the topic is appropriate for their action
	//and if a match is found, calls appropriate functions to update the DOM.
	var notify = function(topic, message){
		 _observers.forEach(function(observer){
			 observer.update(topic,message);
		 });

	}
	
	var setSmoothie = function(smoothieObj){
		_smoothieObj = smoothieObj;
		_showSmoothie = true;
	}
	
	var removeSmoothie = function(){
		_showSmoothie = false;
	}
	
	//Module pattern to encapsulate functions
	return {
		setClient:setClient,
		connect:connect,
		add:add,
		remove:remove,
		notify:notify,
		publish:publish,
		setSmoothie:setSmoothie,
		removeSmoothie:removeSmoothie
	}
	
})(Paho);



(function($, VirtualTokenReaderClient,trSmoothie, readerID){
	
	$(document).ready(function(){
		
		var clientID  = "virtualTokenReader"+ Math.random().toString(36).slice(-5);
		VirtualTokenReaderClient.setClient('10.254.249.24', 9001, clientID);
		/*var smoothieObserver = new UpdateSmoothieObserver("device/VHandScan001/status" );
		var msgBoxObserver = new UpdateMsgBoxObserver("device/VHandScan001/status" );
		VirtualTokenReaderClient.add(smoothieObserver);
		VirtualTokenReaderClient.add(msgBoxObserver);*/
		
		VirtualTokenReaderClient.setSmoothie(trSmoothie);
		VirtualTokenReaderClient.connect();
		addSliderToggle();
		setFocusOnTokenInput();
		
		
			
		
		
		assignEventHandlers();
		
		console.log('event handlers loaded');
		
		
	});
	
	

	
	
	var setFocusOnTokenInput = function(e){
		$('#token-manual-input').focus();
	}
	
	var assignBatteryEventHandlers = function(){
		$('#reader-battery-plugged').off('change').on('change',function(e){
			e.preventDefault();
			MQTTtopicPublisher.sendNewBatteryInfo(readerID);
		});
		
		$('#reader-battery-status').off('change').on('change',function(e){
			e.preventDefault();
			MQTTtopicPublisher.sendNewBatteryInfo(readerID);
		});
		
		$( "#slider" ).on( "slidestop", function( e, ui ) {
			MQTTtopicPublisher.sendNewBatteryInfo(readerID);
		} );
	}
	
	var assignNetworkEventHandlers = function(){
		$('#send-network-mqtt').off('click').on('click',function(e){
			e.preventDefault();
			MQTTtopicPublisher.sendNewNetworkInfo(readerID);
		});
		
	}
	
	var assignGeneralEventHandlers = function(){
		$('#send-general-mqtt').off('click').on('click',function(e){
			e.preventDefault();
			MQTTtopicPublisher.sendNewGeneralInfo(readerID);
		});
		
	}
	
	var assignEventHandlers = function(){
		
		new BarcodeScanerEvents();
		
		assignBatteryEventHandlers();
		assignNetworkEventHandlers();
		assignGeneralEventHandlers();

		
		$('#toggle-publish').off('click').on('click',function(e){
			e.preventDefault();
			
			if($(this).text() === 'Start'){
				$(this).text('Stop');
				MQTTtopicPublisher.startBatteryPublishing(readerID);
			} else {
				$(this).text('Start');
				MQTTtopicPublisher.stopBatteryPublishing();
			}
		});
		
		$('.toggle-reader-panel').off('click').on('click',function(e){
			e.preventDefault();
			//$('.toggle-reader-panel').hide();
			$('.right-triangle').css('visibility','hidden');
			$(e.target).siblings('.right-triangle').css('visibility','visible');
			$('.mqtt-input-ul').hide();
			
			var linkTitle = $(e.target).text();
			var ulSelector = '.'+linkTitle.toLowerCase()+'-input';
			$(ulSelector).show();
		});
		
		$('.toggle-in-out-btn').off('click').on('click', function(e){
			e.preventDefault();
			if($(this).hasClass('out-btn')){
				$(this).removeClass('out-btn').addClass('in-btn').text('IN');
				$('.reader-state[value="0"]').trigger('click');
			}else {
				$(this).removeClass('in-btn').addClass('out-btn').text('OUT');
				$('.reader-state[value="1"]').trigger('click');
			}
			
			//MQTTtopicPublisher.sendTestData();
		});
		
		$('.reader-state').off('click').on('click', function(e){
			//e.preventDefault();
			if(this.value==='0'){
				$('.toggle-in-out-btn').removeClass('out-btn').addClass('in-btn').text('IN');
			} else {
				$('.toggle-in-out-btn').removeClass('in-btn').addClass('out-btn').text('OUT');
			}
		});
		
		$('.power').off('click').on('click',function(e){
			if(this.value === 'online'){
				$('.mqtt-input').removeAttr('disabled');
				$('#slider').slider("enable");
			}else {
				$('.mqtt-input').attr('disabled','disabled');
				$('#slider').slider("disable");
			}
		});
		
		$('#scan-trigger-btn').off('click').on('click', function(e){
			e.preventDefault();
			
			var tokenID = $('#token-manual-input').val();
			if(tokenID.length === 0){
				alert('Token ID must be entered!');
				return;
			}
			
			var eventID = $('#reader-general-event option:selected').val();
			var entranceID = $('#reader-general-entrance option:selected').val();
			
			eventID = parseInt(eventID);
			entranceID = parseInt(entranceID);
			
			sendAuthTicketXMLRPCcall(tokenID, eventID, entranceID);
		});
		
		$('.override-btn').off('click').on('click', function(e){
			e.preventDefault();
			
			/*var tokenID = $('#token-manual-input').val();
			if(tokenID.length === 0){
				alert('Token ID must be entered!');
				return;
			}*/
			
			var eventID = $('#reader-general-event option:selected').val();
			var entranceID = $('#reader-general-entrance option:selected').val();
			
			eventID = parseInt(eventID);
			entranceID = parseInt(entranceID);
			
			sendOverrideTicketXMLRPCcall(eventID, entranceID);
		});
		
		$(document).on('onbarcodescaned', function(e){
			$('#scan-trigger-btn').trigger('click');
		});
		
		$('.cancel-btn').off('click').on('click', function(e){
			e.preventDefault();
			TokenReaderController.showMainReaderScreen();
		});
	}
	
	
	
	var addSliderToggle = function(){
		var handle = $( "#custom-handle" );
	    $( "#slider" ).slider({
	    	value: 100,
	    	create: function() {
	    		handle.text( $( this ).slider( "value" ) );
	        //$(this).slider('value',100);
	    	},
	      slide: function( event, ui ) {
	        handle.text( ui.value );
	      }
	    });
	}
	
	var sendAuthTicketXMLRPCcall = function(tokenID, eventID, entranceID){
		
		
		
		if(typeof tokenID === 'undefined' ){
			throw new Error('tokenID must be defined');
			return;
		}
		
		if(typeof eventID !== 'number' ){
			throw new Error('eventID must be a number');
			return;
		}
		
		if(typeof entranceID !== 'number' ){
			throw new Error('entranceID must be a number');
			return;
		}
		
		$.xmlrpc({
		    url: 'http://10.254.249.73/tcsa2/club/club/accesscontrol/tc_bted_server.php',
		    methodName: 'api.trHsTicketAuthenticate',
		    params: ['tcaccess', 'st4d1um', readerID, tokenID, eventID, entranceID],
		    success: function(response, status, jqXHR) { 
		    	console.log(response);
		    	var responseObj = response[0];
		    	switch(responseObj.entry_status){
		    		case 1:
		    			var displayStr = responseObj.display_string;
		    			var delay = responseObj.display_delay;
		    			TokenReaderController.showNoEntryScreen(displayStr,delay);
		    			break;
		    		case 0:
		    			var displayStr = responseObj.display_string;
		    			var delay = responseObj.display_delay;
		    			var concession = responseObj.concession_string;
		    			
		    			var displayArray = displayStr.split(' ');
		    			displayArray.splice(1, 0, concession.toUpperCase());
		    			displayStr = displayArray.join(' ');
		    			TokenReaderController.showEntryScreen(displayStr,delay);
		    			break;
		    	}
		    	//showMsgInResponseScreen();
		    },
		    error: function(jqXHR, status, error) { console.log(jqXHR); }
		});
	}
	
	var sendOverrideTicketXMLRPCcall = function(eventID, entranceID){
		
		if(typeof eventID !== 'number' ){
			throw new Error('eventID must be a number');
			return;
		}
		
		if(typeof entranceID !== 'number' ){
			throw new Error('entranceID must be a number');
			return;
		}
		
		$.xmlrpc({
		    url: 'http://10.254.249.73/tcsa2/club/club/accesscontrol/tc_bted_server.php',
		    methodName: 'api.trHsTicketAuthenticate',
		    params: ['tcaccess', 'st4d1um', readerID, 'TCSAOVD001', eventID, entranceID],
		    success: function(response, status, jqXHR) { 
		    	console.log(response);
		    	var responseObj = response[0];
		    	switch(responseObj.entry_status){
		    		case 1:
		    			var displayStr = responseObj.display_string;
		    			var delay = responseObj.display_delay;
		    			TokenReaderController.showNoEntryScreen(displayStr,delay);
		    			break;
		    		case 0:
		    			var displayStr = responseObj.display_string;
		    			var delay = responseObj.display_delay;
		    			var concession = responseObj.concession_string;
		    			
		    			var displayArray = displayStr.split(' ');
		    			displayArray.splice(1, 0, concession.toUpperCase());
		    			displayStr = displayArray.join(' ');
		    			TokenReaderController.showEntryScreen(displayStr,delay);
		    			break;
		    	}
		    	//showMsgInResponseScreen();
		    },
		    error: function(jqXHR, status, error) { console.log(jqXHR); }
		});
	}
	
})(jQuery, VirtualTokenReaderClient,smoothieObj, readerID);

MQTTtopicPublisher = {
		
		
		/*sendTestData:function(){
			VirtualTokenReaderClient.publish('test/david', '{"test":"test"}');
		},*/
		batteryFunction:'',
		sendNewBatteryInfo: function(readerID){
			
			var level = $('#slider').slider("option", "value");
			var plugged = $('#reader-battery-plugged option:selected').val();
			var status = $('#reader-battery-status option:selected').val(); 
			
			plugged = parseInt(plugged);
			status = parseInt(status);
			
			var topic = 'device/'+readerID+'/status';
			
			var payload = {
				"tr_id":readerID,
				"status":1, //status
				"battery":{
					"level":level, //batteryLevel
					"plugged":plugged,
					"status":status
				}
			}
			
			VirtualTokenReaderClient.publish(topic, JSON.stringify(payload));
		},
		
		sendNewNetworkInfo: function(readerID){
			
			var ip = $('#ip-address').val();
			var mac = $('#reader-network-mac').val();
			var type = $('#reader-network-type').val();
			var name = $('#reader-network-name').val();
			var signal = $('#reader-network-signal').val();
			
			var topic = 'device/'+readerID+'/status';
			
			var payload = {
				"tr_id":readerID,
				"status":1, //status
				"network":{
					"ip":ip,
					"mac":mac,
					"type":type,
					"name":name,
					"signal":signal
				}
			}
			
			VirtualTokenReaderClient.publish(topic, JSON.stringify(payload));
		},
		
		sendNewGeneralInfo: function(readerID){
			
			var topic = 'device/'+readerID+'/status';
			var scanCount = $('#reader-general-scancount').val();
			var lastError = $('#reader-general-lasterror').val();
			var inOut = $('#reader-general-inout').val();
			var event = $('#reader-general-event option:selected').text();
			var entrance = $('#reader-general-entrance option:selected').text();
			
			
			var payload = {
				"tr_id":readerID,
				"status":1, //status
				"general":{
					"scancount":scanCount,
					"lasterror":lastError,
					"inout":inOut,
					"event":event,
					"entrance":entrance
				}
			}
			
			VirtualTokenReaderClient.publish(topic, JSON.stringify(payload));
		},
		startBatteryPublishing: function(readerID){
			
			
			var interval = Math.floor(Math.random() * 30) + 30 ;
			MQTTtopicPublisher.batteryFunction= setInterval(function(){
				
				var level = $('#slider').slider("option", "value");
				var plugged = $('#reader-battery-plugged option:selected').val();
				var status = $('#reader-battery-status option:selected').val(); 
				
				plugged = parseInt(plugged);
				status = parseInt(status);
				
				var topic = 'device/'+readerID+'/status';
				
				var payload = {
					"tr_id":readerID,
					"status":1, //status
					"battery":{
						"level":level, //batteryLevel
						"plugged":plugged,
						"status":status
					}
				}
				
				VirtualTokenReaderClient.publish(topic, JSON.stringify(payload));
			}, interval*1000);
			
		},
		stopBatteryPublishing:function(){
			clearInterval(MQTTtopicPublisher.batteryFunction);
		}
}

TokenReaderController = {
		
		showNoEntryScreen: function(displayStr, delay){
			
			$('.image-container').hide();
			//$('.reader-msg').text('');
			//$('.reader-error-message-xl').text(displayStr);
			$('#error-attd-msg').text(displayStr)
			$('#reader-error-screen').show();
			
			var delay = delay* 1000;
			/*
			setTimeout(function(){
				TokenReaderController.showMainReaderScreen();
			},delay);*/
		},
		
		showEntryScreen: function(displayStr,delay){
			
			$('.image-container').hide();
			//$('.reader-msg').text('');
			//$('.reader-error-message-xl').text(displayStr);
			$('#success-attd-msg').text(displayStr)
			$('#reader-success-screen').show();
			
			var delay = delay* 1000;
			
			setTimeout(function(){
				TokenReaderController.showMainReaderScreen();
			},delay);
		},
		
		showMainReaderScreen:function(){
			
			$('#token-manual-input').val('')
			
			$('.image-container').hide();
			$('#main-reader-interface').show();
			$('#token-manual-input').focus();
		},
		
		updateReaders: function(messageJSON){
			
			if(parseInt(messageJSON.status) === -1){
				$('#reader-battery-level').val('disconnected');
			} else if(Object.prototype.hasOwnProperty.call(messageJSON, 'battery')) {
				$('#reader-battery-level').val(messageJSON.battery.level);
				$('#reader-battery-plugged').val(messageJSON.battery.plugged);
				$('#reader-battery-status').val(messageJSON.battery.status);
			}  else if(Object.prototype.hasOwnProperty.call(messageJSON, 'network')) {
				$('#reader-network-ip').val(messageJSON.network.ip);
				$('#reader-network-mac').val(messageJSON.network.mac);
				$('#reader-network-type').val(messageJSON.network.type);
				$('#reader-network-name').val(messageJSON.network.name);
				$('#reader-network-signal').val(messageJSON.network.signal);
			}  else if(Object.prototype.hasOwnProperty.call(messageJSON, 'general')) {
				$('#reader-general-scancount').val(messageJSON.general.scancount);
				$('#reader-general-lasterror').val(messageJSON.general.lasterror);
				$('#reader-general-inout').val(messageJSON.general.inout);
				$('#reader-general-event').val(messageJSON.general.event);
				$('#reader-general-entrance').val(messageJSON.general.entrance);
			}
			
		},
		
		showDisconnectMessageBox: function(errorMsg){
			var screenHeight= $(document).height();
		    var screenWidth = $(document).width();
		    var msgBoxMargin = (screenHeight / 2)-100;
		    var msgBox = $('<div></div>').css({
		    	'min-height':'150px',
		    	'min-width':'300px',
		    	'padding':'10px',
		    	'margin-top': msgBoxMargin+'px',
		    	'display':'inline-block',
		    	'background-color':'white',
		    	'border':'2px solid black'
		    }).html('<h4 class=\'broker-disconnect\'>Broker Disconnected</h4><p class=\'italics\' style=\'text-align:left\'>'+errorMsg+'</p><p><button class=\'refresh-page-btn\' >Refresh Page</button></p>');
			
		    $('<div></div>').css({
				'height':screenHeight,
				'width':screenWidth,
				'text-align':'center',
				'background-color':'rgba(255, 255, 255, 0.6)',
				'position':'absolute',
				'top':0,
				'left':0
			}).append(msgBox).appendTo('body');
		    
		   $('.refresh-page-btn').off('click').on('click',function(e){
			   window.location.href=window.location.href;
		   });
		
		},
		
		
		updateSmoothie: function(smoothieObj){
			smoothieObj.addSubMessageLog();
		},
		updateMsgBox:function(topic,message, type){
			
			var currentdate = new Date(); 
			var datetime =  twoDigits(currentdate.getDate()) + "/"
			                + twoDigits(currentdate.getMonth()+1)  + "/" 
			                + currentdate.getFullYear() + "  "  
			                + twoDigits(currentdate.getHours()) + ":"  
			                + twoDigits(currentdate.getMinutes()) + ":" 
			                + twoDigits(currentdate.getSeconds());
			
			var messageDisplay = $('.message-display-template').clone();
			messageDisplay.find('.topic').text(topic+':');
			messageDisplay.find('.message').text(JSON.stringify(message));
			messageDisplay.find('.time').text(datetime);
			messageDisplay.removeClass('message-display-template');
			
			/*if($('#mqtt-msg-container').find('.message-display').length > 10){
				$('#mqtt-msg-container').find('.message-display').not('.message-display-template').eq(0).remove();
			}*/
			if(type === undefined){
				throw new Error('must specify an MQTT message type');
				return;
			}
			
			switch(type){
				case 'pub':
					messageDisplay.find('.message-type').text('Publish').addClass('publish');
					break;
				case 'sub':
					messageDisplay.find('.message-type').text('Subscribe').addClass('subscribe');
					break;
				default:
					throw new Error('type must be pub or sub');
					break;
			}
			
			var container = $('#mqtt-msg-container')
			messageDisplay.appendTo(container);
			$(container).scrollTop(container.prop("scrollHeight"));
		}
}

function twoDigits(d) {
    if(0 <= d && d < 10) return "0" + d.toString();
    if(-10 < d && d < 0) return "-0" + (-1*d).toString();
    return d.toString();
}

//**********************Custom OnBarcodeScanned Event **************************************//

/*
 * Taken from: http://stackoverflow.com/questions/11290898/detect-when-input-box-filled-by-keyboard-and-when-by-barcode-scanner/15354814
 */
var BarcodeScanerEvents = function() {
    this.initialize.apply(this, arguments);
};

BarcodeScanerEvents.prototype = {
	    initialize: function() {
	       $(document).on({
	          keyup: $.proxy(this._keyup, this)
	       });
	    },
	    _timeuotHandler: 0,
	    _inputString: '',
	    _keyup: function (e) {
		    if (this._timeuotHandler) {
		        clearTimeout(this._timeuotHandler);
		        this._inputString += String.fromCharCode(e.which);
		    } 
	
		    this._timeuotHandler = setTimeout($.proxy(function () {
		        if (this._inputString.length <= 3) {
		            this._inputString = '';
		            return;
		        }
	
		        $(document).trigger('onbarcodescaned', this._inputString);
	
		        this._inputString = '';
	
		    }, this), 20);
		}
	}

