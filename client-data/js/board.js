/**
 *						  WHITEBOPHIR
 *********************************************************
 * @licstart  The following is the entire license notice for the 
 *	JavaScript code in this page.
 *
 * Copyright (C) 2013  Ophir LOJKINE
 *
 *
 * The JavaScript code in this page is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License (GNU GPL) as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.  The code is distributed WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE.  See the GNU GPL for more details.
 *
 * As additional permission under GNU GPL version 3 section 7, you
 * may distribute non-source (e.g., minimized or compacted) forms of
 * that code without the copy of the GNU GPL normally required by
 * section 4, provided you include this license notice and a URL
 * through which recipients can access the Corresponding Source.
 *
 * @licend
 */
var Tools = {};

Tools.i18n = (function i18n() {
	var translations = JSON.parse(document.getElementById("translations").text);
	return {
		"t": function translate(s) {
			var key = s.toLowerCase().replace(/ /g, '_');
			return translations[key] || s;
		}
	};
})();

Tools.server_config = JSON.parse(document.getElementById("configuration").text);

Tools.board = document.getElementById("board");
Tools.svg = document.getElementById("canvas");
Tools.drawingArea = Tools.svg.getElementById("drawingArea");

//Initialization
Tools.curTool = null;
Tools.drawingEvent = true;
Tools.showMarker = true;
Tools.showOtherCursors = true;
Tools.showMyCursor = true;

Tools.isIE = /MSIE|Trident/.test(window.navigator.userAgent);

Tools.socket = null;
Tools.connect = function () {
	var self = this;

	// Destroy socket if one already exists
	if (self.socket) {
		self.socket.destroy();
		delete self.socket;
		self.socket = null;
	}

	this.socket = io.connect('', {
		"path": window.location.pathname.split("/boards/")[0] + "/socket.io",
		"reconnection": true,
		"reconnectionDelay": 100, //Make the xhr connections as fast as possible
		"timeout": 1000 * 60 * 20 // Timeout after 20 minutes
	});

	//Receive draw instructions from the server
	this.socket.on("broadcast", function (msg) {

		handleMessage(msg).finally(function afterload() {
			var loadingEl = document.getElementById("loadingMessage");
			loadingEl.classList.add("hidden");
			// console.log("receive broadcast",msg);
		});
	});

	this.socket.on("addActionToHistory", function (msg) {
		console.log("addActionToHistory", msg)
		Tools.addActionToHistory(msg, true);
		// Tools.enableToolsEl('undo');
	});

	this.socket.on("addActionToHistoryRedo", function (msg) {
		console.log("addActionToHistoryRedo", msg);
		Tools.addActionToHistoryRedo(msg, true);
		// Tools.historyRedo.push(msg);
		// Tools.enableToolsEl('redo');
	});

	this.socket.on("pushActionToHistory", function (msg) {
		var dontClear = msg.dontClear;
		Tools.addActionToHistory(msg, dontClear);
	})

	this.socket.on("popActionToHistory", function (msg) {
		Tools.history.pop();
		if (Tools.history.length == 0)
			Tools.disableToolsEl('undo');
	})

	this.socket.on("pushActionToHistoryRedo", function (msg) {
		var dontClear = msg.dontClear;
		Tools.addActionToHistoryRedo(msg, dontClear)
	})

	this.socket.on("popActionToHistoryRedo", function (msg) {
		Tools.historyRedo.pop();
		if (Tools.historyRedo.length == 0)
			Tools.disableToolsEl('redo')
	})

	this.socket.on("reconnect", function onReconnection() {
		Tools.socket.emit('joinboard', Tools.boardName);
	});
};

Tools.connect();

Tools.boardName = (function () {
	var path = window.location.pathname.split("/");
	return decodeURIComponent(path[path.length - 1]);
})();

//Get the board as soon as the page is loaded
Tools.socket.emit("getboard", Tools.boardName);

function saveBoardNametoLocalStorage() {
	var boardName = Tools.boardName;
	if (boardName.toLowerCase() === 'anonymous') return;
	var recentBoards, key = "recent-boards";
	try {
		recentBoards = JSON.parse(localStorage.getItem(key));
		if (!Array.isArray(recentBoards)) throw new Error("Invalid type");
	} catch (e) {
		// On localstorage or json error, reset board list
		recentBoards = [];
		console.log("Board history loading error", e);
	}
	recentBoards = recentBoards.filter(function (name) {
		return name !== boardName;
	});
	recentBoards.unshift(boardName);
	recentBoards = recentBoards.slice(0, 20);
	localStorage.setItem(key, JSON.stringify(recentBoards));
}
// Refresh recent boards list on each page show
window.addEventListener("pageshow", saveBoardNametoLocalStorage);

Tools.HTML = {
	template: new Minitpl("#tools > .tool"),
	addShortcut: function addShortcut(key, callback) {
		window.addEventListener("keydown", function (e) {
			if (e.key === key && !e.target.matches("input[type=text], textarea")) {
				callback();
			}
		});
	},
	addTool: function (toolName, toolIcon, toolIconHTML, toolShortcut, oneTouch) {
		var callback = function () {
			Tools.change(toolName);
		};
		this.addShortcut(toolShortcut, function () {
			Tools.change(toolName);
			document.activeElement.blur && document.activeElement.blur();
		});
		return this.template.add(function (elem) {
			elem.addEventListener("click", callback);
			elem.id = "toolID-" + toolName;
			elem.getElementsByClassName("tool-name")[0].textContent = Tools.i18n.t(toolName);
			var toolIconElem = elem.getElementsByClassName("tool-icon")[0];
			toolIconElem.src = toolIcon;
			toolIconElem.alt = toolIcon;
			if (oneTouch) elem.classList.add("oneTouch");
			elem.title =
				Tools.i18n.t(toolName) + " (" +
				Tools.i18n.t("keyboard shortcut") + ": " +
				toolShortcut + ")" +
				(Tools.list[toolName].secondary ? " [" + Tools.i18n.t("click_to_toggle") + "]" : "");
		});
	},
	changeTool: function (oldToolName, newToolName) {
		var oldTool = document.getElementById("toolID-" + oldToolName);
		var newTool = document.getElementById("toolID-" + newToolName);
		if (oldTool) oldTool.classList.remove("curTool");
		if (newTool) newTool.classList.add("curTool");
	},
	toggle: function (toolName, name, icon) {
		var elem = document.getElementById("toolID-" + toolName);
		elem.getElementsByClassName("tool-icon")[0].src = icon;
		elem.getElementsByClassName("tool-name")[0].textContent = Tools.i18n.t(name);
	},
	addStylesheet: function (href) {
		//Adds a css stylesheet to the html or svg document
		var link = document.createElement("link");
		link.href = href;
		link.rel = "stylesheet";
		link.type = "text/css";
		document.head.appendChild(link);
	},
	colorPresetTemplate: new Minitpl("#colorPresetSel .colorPresetButton"),
	addColorButton: function (button) {
		var setColor = Tools.setColor.bind(Tools, button.color);
		if (button.key) this.addShortcut(button.key, setColor);
		return this.colorPresetTemplate.add(function (elem) {
			elem.addEventListener("click", setColor);
			elem.id = "color_" + button.color.replace(/^#/, '');
			elem.style.backgroundColor = button.color;
			// new
			if (button.color === Tools.currentColor) {
				const tickImage = document.createElement('img')
				tickImage.id = "tick-icon-clr"
				tickImage.setAttribute('src', '/SvgIcons/tick.svg')
				elem?.appendChild(tickImage);
			}
			// new
			if (button.key) {
				elem.title = Tools.i18n.t("keyboard shortcut") + ": " + button.key;
			}
		});
	}
};

Tools.list = {}; // An array of all known tools. {"toolName" : {toolObject}}

Tools.isBlocked = function toolIsBanned(tool) {
	if (tool.name.includes(",")) throw new Error("Tool Names must not contain a comma");
	return Tools.server_config.BLOCKED_TOOLS.includes(tool.name);
};

/**
 * Register a new tool, without touching the User Interface
 */
Tools.register = function registerTool(newTool) {
	if (Tools.isBlocked(newTool)) return;

	if (newTool.name in Tools.list) {
		console.log("Tools.add: The tool '" + newTool.name + "' is already" +
			"in the list. Updating it...");
	}

	//Format the new tool correctly
	Tools.applyHooks(Tools.toolHooks, newTool);

	//Add the tool to the list
	Tools.list[newTool.name] = newTool;

	// Register the change handlers
	if (newTool.onSizeChange) Tools.sizeChangeHandlers.push(newTool.onSizeChange);

	//There may be pending messages for the tool
	var pending = Tools.pendingMessages[newTool.name];
	if (pending) {
		console.log("Drawing pending messages for '%s'.", newTool.name);
		var msg;
		while (msg = pending.shift()) {
			//Transmit the message to the tool (precising that it comes from the network)
			newTool.draw(msg, false);
		}
	}
};

/**
 * Add a new tool to the user interface
 */
Tools.add = function (newTool) {
	if (Tools.isBlocked(newTool)) return;

	Tools.register(newTool);

	if (newTool.stylesheet) {
		Tools.HTML.addStylesheet(newTool.stylesheet);
	}

	//Add the tool to the GUI
	Tools.HTML.addTool(newTool.name, newTool.icon, newTool.iconHTML, newTool.shortcut, newTool.oneTouch);
};

Tools.change = function (toolName) {
	var newTool = Tools.list[toolName];
	var oldTool = Tools.curTool;
	if (!newTool) throw new Error("Trying to select a tool that has never been added!");
	if (newTool === oldTool) {
		if (newTool.secondary) {
			newTool.secondary.active = !newTool.secondary.active;
			var props = newTool.secondary.active ? newTool.secondary : newTool;
			Tools.HTML.toggle(newTool.name, props.name, props.icon);
			if (newTool.secondary.switch) newTool.secondary.switch();
		}
		return;
	}
	if (!newTool.oneTouch) {
		//Update the GUI
		var curToolName = (Tools.curTool) ? Tools.curTool.name : "";
		try {
			Tools.HTML.changeTool(curToolName, toolName);
		} catch (e) {
			console.error("Unable to update the GUI with the new tool. " + e);
		}
		Tools.svg.style.cursor = newTool.mouseCursor || "auto";
		Tools.board.title = Tools.i18n.t(newTool.helpText || "");

		//There is not necessarily already a curTool
		if (Tools.curTool !== null) {
			//It's useless to do anything if the new tool is already selected
			if (newTool === Tools.curTool) return;

			//Remove the old event listeners
			Tools.removeToolListeners(Tools.curTool);

			//Call the callbacks of the old tool
			Tools.curTool.onquit(newTool);
		}

		//Add the new event listeners
		Tools.addToolListeners(newTool);
		Tools.curTool = newTool;
	}

	//Call the start callback of the new tool
	newTool.onstart(oldTool);
};

Tools.addToolListeners = function addToolListeners(tool) {
	for (var event in tool.compiledListeners) {
		var listener = tool.compiledListeners[event];
		var target = listener.target || Tools.board;
		target.addEventListener(event, listener, { 'passive': false });
	}
};

Tools.removeToolListeners = function removeToolListeners(tool) {
	for (var event in tool.compiledListeners) {
		var listener = tool.compiledListeners[event];
		var target = listener.target || Tools.board;
		target.removeEventListener(event, listener);
		// also attempt to remove with capture = true in IE
		if (Tools.isIE) target.removeEventListener(event, listener, true);
	}
};

(function () {
	// Handle secondary tool switch with shift (key code 16)
	function handleShift(active, evt) {
		// list tools for ignore handle shift
		const toolsIgnore = ["Straight line", "Pencil"];
		if (!toolsIgnore.includes(Tools.curTool.name) && evt.keyCode === 16 && Tools.curTool.secondary && Tools.curTool.secondary.active !== active) {
			Tools.change(Tools.curTool.name);
		}
	}
	window.addEventListener("keydown", handleShift.bind(null, true));
	window.addEventListener("keyup", handleShift.bind(null, false));
})();

Tools.send = function (data, toolName) {
	toolName = toolName || Tools.curTool.name;
	var d = data;
	d.tool = toolName;
	Tools.applyHooks(Tools.messageHooks, d);
	var message = {
		"board": Tools.boardName,
		"data": d
	};
	Tools.socket.emit('broadcast', message);
	// console.log("broadcast")
};

Tools.drawAndSend = function (data, tool) {
	if (tool == null) tool = Tools.curTool;
	tool.draw(data, true);
	Tools.send(data, tool.name);
};

//Object containing the messages that have been received before the corresponding tool
//is loaded. keys : the name of the tool, values : array of messages for this tool
Tools.pendingMessages = {};

// Send a message to the corresponding tool
function messageForTool(message) {
	var name = message.tool,
		tool = Tools.list[name];

	if (tool) {
		Tools.applyHooks(Tools.messageHooks, message);
		tool.draw(message, false);
		// console.log(message,tool);
	} else {
		///We received a message destinated to a tool that we don't have
		//So we add it to the pending messages
		if (!Tools.pendingMessages[name]) Tools.pendingMessages[name] = [message];
		else Tools.pendingMessages[name].push(message);
	}

	if (message.tool !== 'Hand' && message.transform != null) {
		//this message has special info for the mover
		messageForTool({ tool: 'Hand', type: 'update', transform: message.transform, id: message.id });
	}
}

// Apply the function to all arguments by batches
function batchCall(fn, args) {
	var BATCH_SIZE = 1024;
	if (args.length === 0) {
		return Promise.resolve();
	} else {
		var batch = args.slice(0, BATCH_SIZE);
		var rest = args.slice(BATCH_SIZE);
		return Promise.all(batch.map(fn))
			.then(function () {
				return new Promise(requestAnimationFrame);
			}).then(batchCall.bind(null, fn, rest));
	}
}

// Call messageForTool recursively on the message and its children
function handleMessage(message) {
	//Check if the message is in the expected format
	if (!message.tool && !message._children) {
		console.error("Received a badly formatted message (no tool). ", message);
	}
	if (message.userCount) updateUserCount(message.userCount);
	if (message.tool) messageForTool(message);
	if (message._children) {
		return batchCall(handleMessage, message._children);
	}
	else {
		// console.log("HANDLE MESSAGW",message)
		return Promise.resolve();
	}
}

Tools.unreadMessagesCount = 0;
Tools.newUnreadMessage = function () {
	Tools.unreadMessagesCount++;
	updateDocumentTitle();
};

function updateUserCount(userCount) {
	document.getElementById("usercount").textContent = userCount;
};

window.addEventListener("focus", function () {
	Tools.unreadMessagesCount = 0;
	updateDocumentTitle();
});

function updateDocumentTitle() {
	document.title =
		(Tools.unreadMessagesCount ? '(' + Tools.unreadMessagesCount + ') ' : '') +
		Tools.boardName +
		" | WBO";
}

(function () {
	// Scroll and hash handling
	var scrollTimeout, lastStateUpdate = Date.now();

	window.addEventListener("scroll", function onScroll() {
		var scale = Tools.getScale();
		var x = document.documentElement.scrollLeft / scale,
			y = document.documentElement.scrollTop / scale;

		clearTimeout(scrollTimeout);
		scrollTimeout = setTimeout(function updateHistory() {
			var hash = '#' + (x | 0) + ',' + (y | 0) + ',' + Tools.getScale().toFixed(1);
			if (Date.now() - lastStateUpdate > 5000 && hash !== window.location.hash) {
				window.history.pushState({}, "", hash);
				lastStateUpdate = Date.now();
			} else {
				window.history.replaceState({}, "", hash);
			}
		}, 100);
	});

	function setScrollFromHash() {
		var coords = window.location.hash.slice(1).split(',');
		var x = coords[0] | 0;
		var y = coords[1] | 0;
		var scale = parseFloat(coords[2]);
		resizeCanvas({ x: x, y: y });
		Tools.setScale(scale);
		window.scrollTo(x * scale, y * scale);
	}

	function scaleToCenter(origin, scale) {
		const defaultScale = 1;
		var oldScale = origin.scale;
		var newScale = Tools.setScale(scale);
		window.scrollTo(
			origin.scrollX + origin.x * (newScale - oldScale),
			origin.scrollY + origin.y * (newScale - oldScale)
		);
		scaleToCenter(defaultOrigin, defaultScale);

		const defaultOrigin = {
			scrollX: document.documentElement.scrollLeft,
			scrollY: document.documentElement.scrollTop,
			x: 0.0,
			y: 0.0,
			clientY: 0,
			scale: 1.0
		}
	}

	function scaleToFull() {
		Tools.setScale(1);
	}

	function minusScale() {
		Tools.setScale(Tools.getScale() - 0.1);
	}

	function plusScale() {
		Tools.setScale(Tools.getScale() + 0.1);
	}

	function clearBoard() {
		const needClear = confirm('Are you sure?');
		if (needClear) {
			Tools.drawAndSend({
				'type': 'clearBoard',
				'id': '',
			}, Tools.list.Eraser);
			Tools.historyRedo.splice(0, Tools.historyRedo.length);
			Tools.history.splice(0, Tools.history.length);
			Tools.disableToolsEl('undo');
			Tools.disableToolsEl('redo');
			Tools.change("Hand");
			Tools.drawingArea.innerHTML = '';
		}
	}

	document.getElementById('scalingCenter').addEventListener('click', scaleToCenter, false);
	document.getElementById('scalingFull').addEventListener('click', scaleToFull, false);
	document.getElementById('minusScale').addEventListener('click', minusScale, false);
	document.getElementById('plusScale').addEventListener('click', plusScale, false);
	document.getElementById('clearBoard').addEventListener('click', clearBoard, false);

	window.addEventListener("hashchange", setScrollFromHash, false);
	window.addEventListener("popstate", setScrollFromHash, false);
	window.addEventListener("DOMContentLoaded", setScrollFromHash, false);
})();

function resizeCanvas(m) {
	//Enlarge the canvas whenever something is drawn near its border
	var x = m.x | 0, y = m.y | 0
	var MAX_BOARD_SIZE = Tools.server_config.MAX_BOARD_SIZE || 65536; // Maximum value for any x or y on the board
	if (x > Tools.svg.width.baseVal.value - 2000) {
		Tools.svg.width.baseVal.value = Math.min(x + 2000, MAX_BOARD_SIZE);
	}
	if (y > Tools.svg.height.baseVal.value - 2000) {
		Tools.svg.height.baseVal.value = Math.min(y + 2000, MAX_BOARD_SIZE);
	}
}

function updateUnreadCount(m) {
	if (document.hidden && ["child", "update"].indexOf(m.type) === -1) {
		Tools.newUnreadMessage();
	}
}

// List of hook functions that will be applied to messages before sending or drawing them
Tools.messageHooks = [resizeCanvas, updateUnreadCount];

Tools.scale = 1.0;
var scaleTimeout = null;
Tools.setScale = function setScale(scale) {
	var fullScale = Math.max(window.innerWidth, window.innerHeight) / Tools.server_config.MAX_BOARD_SIZE;
	var minScale = Math.max(0.67, fullScale);
	var maxScale = 2;
	if (isNaN(scale)) scale = 1;
	scale = Math.max(minScale, Math.min(maxScale, scale));
	Tools.svg.style.willChange = 'transform';
	Tools.svg.style.transform = 'scale(' + scale + ')';
	clearTimeout(scaleTimeout);
	scaleTimeout = setTimeout(function () {
		Tools.svg.style.willChange = 'auto';
	}, 1000);
	Tools.scale = scale;
	document.getElementById('scaleValue').innerText = Math.round(scale * 100) + '%';
	return scale;
}
Tools.getScale = function getScale() {
	return Tools.scale;
}

//List of hook functions that will be applied to tools before adding them
Tools.toolHooks = [
	function checkToolAttributes(tool) {
		if (typeof (tool.name) !== "string") throw "A tool must have a name";
		if (typeof (tool.listeners) !== "object") {
			tool.listeners = {};
		}
		if (typeof (tool.onstart) !== "function") {
			tool.onstart = function () { };
		}
		if (typeof (tool.onquit) !== "function") {
			tool.onquit = function () { };
		}
	},
	function compileListeners(tool) {
		//compile listeners into compiledListeners
		var listeners = tool.listeners;

		//A tool may provide precompiled listeners
		var compiled = tool.compiledListeners || {};
		tool.compiledListeners = compiled;

		function compile(listener) { //closure
			return (function listen(evt) {
				var x = evt.pageX / Tools.getScale(),
					y = evt.pageY / Tools.getScale();
				return listener(x, y, evt, false);
			});
		}

		function compileTouch(listener) { //closure
			return (function touchListen(evt) {
				//Currently, we don't handle multitouch
				if (evt.changedTouches.length === 1) {
					//evt.preventDefault();
					var touch = evt.changedTouches[0];
					var x = touch.pageX / Tools.getScale(),
						y = touch.pageY / Tools.getScale();
					return listener(x, y, evt, true);
				}
				return true;
			});
		}

		function wrapUnsetHover(f, toolName) {
			return (function unsetHover(evt) {
				document.activeElement && document.activeElement.blur && document.activeElement.blur();
				return f(evt);
			});
		}

		if (listeners.press) {
			compiled["mousedown"] = wrapUnsetHover(compile(listeners.press), tool.name);
			compiled["touchstart"] = wrapUnsetHover(compileTouch(listeners.press), tool.name);
		}
		if (listeners.move) {
			compiled["mousemove"] = compile(listeners.move);
			compiled["touchmove"] = compileTouch(listeners.move);
		}
		if (listeners.release) {
			var release = compile(listeners.release),
				releaseTouch = compileTouch(listeners.release);
			compiled["mouseup"] = release;
			if (!Tools.isIE) compiled["mouseleave"] = release;
			compiled["touchleave"] = releaseTouch;
			compiled["touchend"] = releaseTouch;
			compiled["touchcancel"] = releaseTouch;
		}
	}
];

Tools.applyHooks = function (hooks, object) {
	//Apply every hooks on the object
	hooks.forEach(function (hook) {
		hook(object);
	});
};


// Utility functions

Tools.generateUID = function (prefix, suffix) {
	var uid = Date.now().toString(36); //Create the uids in chronological order
	uid += (Math.round(Math.random() * 36)).toString(36); //Add a random character at the end
	if (prefix) uid = prefix + uid;
	if (suffix) uid = uid + suffix;
	return uid;
};

Tools.createSVGElement = function createSVGElement(name, attrs) {
	var elem = document.createElementNS(Tools.svg.namespaceURI, name);
	if (typeof (attrs) !== "object") return elem;
	Object.keys(attrs).forEach(function (key, i) {
		elem.setAttributeNS(null, key, attrs[key]);
	});
	return elem;
};

Tools.positionElement = function (elem, x, y) {
	elem.style.top = y + "px";
	elem.style.left = x + "px";
};

Tools.colorPresets = [
	{ color: "#001f3f", key: '1' },
	{ color: "#FF4136", key: '2' },
	{ color: "#0074D9", key: '3' },
	{ color: "#FFFFFF", key: '4' },
	{ color: "#3D9970", key: '5' },
	{ color: "#E65194" }
];

Tools.currentColor = Tools.colorPresets[0].color;

Tools.setColor = function (color) {
	const previousColor = document.getElementById("color_" + Tools.currentColor?.substring(1));

	if (previousColor) {
		previousColor.innerHTML = "";
	}
	const tickImage = document.createElement('img')
	tickImage.id = "tick-icon-clr"
	const currentColorElem = document.getElementById(
		"color_" + color.substring(1)
	);
	tickImage.setAttribute('src', '/SvgIcons/tick.svg')
	currentColorElem?.appendChild(tickImage);
	Tools.currentColor = color;
}

Tools.getColor = (function color() {
	var color_index = (Math.random() * Tools.colorPresets.length) | 0;
	var initial_color = Tools.colorPresets[color_index].color;
	Tools.setColor(initial_color);
	return function () { return Tools.currentColor; };
})();

Tools.colorPresets.forEach(Tools.HTML.addColorButton.bind(Tools.HTML));

Tools.disableToolsEl = function (elementId) {
	document.getElementById(elementId).classList.add('disabled');
}

Tools.enableToolsEl = function (elementId) {
	document.getElementById(elementId).classList.remove('disabled');
}

Tools.sizeChangeHandlers = [];
Tools.setSize = (function size() {
	var chooser = document.getElementById("chooseSize");

	const valueEl = document.getElementById("sizeValue");
	const sizeList = document.getElementById("size-list");
	const middleSize = (Tools.server_config.MINIMAL_LINE_WIDTH + Tools.server_config.MAX_LINE_WIDTH) / 2;
	const sizes = [Tools.server_config.MINIMAL_LINE_WIDTH, (Tools.server_config.MINIMAL_LINE_WIDTH + middleSize) / 2, middleSize, (middleSize + Tools.server_config.MAX_LINE_WIDTH) / 2, Tools.server_config.MAX_LINE_WIDTH];
	const sizeListElement = document.getElementById('sizeListElement');

	chooser.setAttribute('min', Tools.server_config.MINIMAL_LINE_WIDTH);
	chooser.setAttribute('max', Tools.server_config.MAX_LINE_WIDTH);
	sizes.forEach(size => {
		sizeList.insertAdjacentHTML("beforeend", `<span class="size-item">${Math.round(size)}</span>`)
	});
	sizeList.addEventListener('click', function (evt) {
		evt.stopPropagation();
		if (evt.target.classList.contains('size-item')) {
			Tools.setSize(+evt.target.innerText);
		}
	});
	function chooserDisplay(evt) {
		if (chooser.classList.contains('hide')) {
			chooser.classList.remove('hide');
		} else {
			chooser.classList.add('hide');
		}
	}
	sizeListElement.addEventListener('click', function (evt) {
		evt.preventDefault();
		if (evt.target.id !== 'chooseSize') chooserDisplay(evt)
	});
	sizeListElement.addEventListener('mouseleave', function () {
		chooser.classList.remove('hide');
	});

	function update() {
		var size = Math.max(1, Math.min(50, chooser.value | 0));
		chooser.value = size;
		valueEl.innerText = size;
		Tools.sizeChangeHandlers.forEach(function (handler) {
			handler(size);
		});
	}
	update();

	chooser.onchange = chooser.oninput = update;
	return function (value) {
		if (value !== null && value !== undefined) { chooser.value = value; update(); }
		return parseInt(chooser.value);
	};
})();

Tools.getSize = (function () { return Tools.setSize() });

Tools.getOpacity = (function opacity() {
	var chooser = document.getElementById("chooseOpacity");
	var opacityIndicator = document.getElementById("opacityIndicator");

	function update() {
		opacityIndicator.setAttribute("opacity", chooser.value);
	}
	update();

	chooser.onchange = chooser.oninput = update;
	return function () {
		return Math.max(0.1, Math.min(1, chooser.value));
	};
})();

// Undo/Redo tools

Tools.undo = (function () {
	const el = document.getElementById("undo");

	function update() {
		if (Tools.history.length) {
			const action = Tools.history.pop();
			console.log("Undo", Tools.history,action);
			Tools.socket.emit("popActionToHistory", {});
			if (Tools.history.length === 0) {
				Tools.disableToolsEl('undo');
			}
			var instrument = null;
			switch (action.type) {
				case "array":
					if (action.events[0].type === 'delete') {
						instrument = Tools.list.Eraser;
						action.sendBack = true;
						action.sendToRedo = true;
						Tools.drawAndSend(action, instrument);
					} else {
						const dataForRedo = { type: 'array', events: [] };
						action.events.forEach(function (event) {
							event.sendBack = true;
							dataForRedo.events.push({ type: 'delete', id: event.id, dontClear: true });
							if (event.tool === 'Pencil') {
								_drawLine(event);
							} else {
								Tools.drawAndSend(event, Tools.list[event.tool]);
							}
						});
						Tools.historyRedo.push(dataForRedo);
						Tools.socket.emit("pushActionToHistoryRedo", dataForRedo);
					}
					break;
				case "line":
					_drawLine(action);
					Tools.historyRedo.push({ type: "delete", id: action.id });
					Tools.socket.emit("pushActionToHistoryRedo", { type: "delete", id: action.id, dontClear: true });
					break;
				case "delete":
					instrument = Tools.list.Eraser;
					action.sendBack = true;
					action.sendToRedo = true;
					break;
				case "update":
					instrument = Tools.list[action.tool];
					action.dontClear = true;
					const dataForRedo  = JSON.parse(JSON.stringify(action));
					for(var i=0; i< dataForRedo._children.length; i++){
						dataForRedo._children[i].transform = action._children[i].old_transform;
						dataForRedo._children[i].old_transform = action._children[i].transform;
					}
					Tools.historyRedo.push(dataForRedo)
					// console.log("historyRedo", Tools.historyRedo,dataForRedo)
					break;
				default:
					instrument = Tools.list[action.tool];
					Tools.historyRedo.push({ type: "delete", id: action.id });
					Tools.socket.emit("pushActionToHistoryRedo", { type: "delete", id: action.id, dontClear: true });
					break;
			}
			if (action.type !== "line" && action.type !== "array") {
				// console.log(action);
				Tools.drawAndSend(action, instrument);
			}
			Tools.enableToolsEl('redo');
		}
	}

	el.onclick = update;
	return function () {
		update();
	}
})();

Tools.redo = (function () {
	const el = document.getElementById("redo");

	function update() {
		if (Tools.historyRedo.length) {
			const action = Tools.historyRedo.pop();
			Tools.socket.emit("popActionToHistoryRedo", {});
			if (Tools.historyRedo.length === 0) {
				Tools.disableToolsEl('redo');
			}
			var instrument = null;
			action.sendBack = true;
			switch (action.type) {
				case "array":
					if (action.events[0].type === 'delete') {
						instrument = Tools.list.Eraser;
						action.sendBack = true;
						Tools.drawAndSend(action, instrument);
					} else {
						const dataForUndo = { type: 'array', events: [], dontClear: true };
						action.events.forEach(function (event) {
							event.sendBack = true;
							dataForUndo.events.push({ type: 'delete', id: event.id });
							if (event.tool === 'Pencil') {
								_drawLine(event);
							} else {
								Tools.drawAndSend(event, Tools.list[event.tool]);
							}
						});
						Tools.history.push(dataForUndo);
						Tools.socket.emit("pushActionToHistory", dataForUndo);
					}
					break;
				case "line":
					_drawLine(action);
					Tools.history.push({ type: "delete", id: action.id });
					Tools.socket.emit("pushActionToHistory", { type: "delete", id: action.id, dontClear: true });
					break;
				case "delete":
					instrument = Tools.list.Eraser;
					action.sendBack = true;
					break;
				case "update":
					action.dontClear = true;
					const dataForRedo  = JSON.parse(JSON.stringify(action));
					for(var i=0; i< dataForRedo._children.length; i++){
						dataForRedo._children[i].transform = action._children[i].old_transform;
						dataForRedo._children[i].old_transform = action._children[i].transform;
					}
					Tools.history.push(dataForRedo)
					// console.log("undoHistory", Tools.history);
					break;
				default:
					instrument = Tools.list[action.tool];
					Tools.history.push({ type: "delete", id: action.id });
					Tools.socket.emit("pushActionToHistory", { type: "delete", id: action.id, dontClear: true });
					break;
			}
			if (action.type !== "line" && action.type !== "array") {
				Tools.drawAndSend(action, instrument);
			}
			Tools.enableToolsEl('undo');
		}
	}

	el.onclick = update;
	return function () {
		update();
		console.log("History:\n", Tools.history);
	}
})();

function _drawLine(action) {
	Tools.drawAndSend({
		'type': 'line',
		'id': action.id,
		'color': action.color,
		'size': action.size,
		'opacity': action.opacity,
		'dotted': action.dotted,
	}, Tools.list.Pencil);
	for (var child of action._children) {
		Tools.drawAndSend({
			'type': 'child',
			'parent': action.id,
			'tool': 'Pencil',
			'x': child.x,
			'y': child.y,
		}, Tools.list.Pencil);
	}
}

Tools.history = [];
Tools.historyRedo = [];

Tools.addActionToHistory = function (data, dontClear) {
	Tools.enableToolsEl('undo');
	if (Tools.history.length === 80) {
		Tools.history.shift();
	}
	const clear = dontClear || false;
	if (!clear) {
		Tools.disableToolsEl('redo');
		Tools.historyRedo.splice(0, Tools.historyRedo.length);
	}
	Tools.history.push(data);
}

Tools.addActionToHistoryRedo = function (data, dontClear) {
	Tools.enableToolsEl('redo');
	if (Tools.historyRedo.length === 80) {
		Tools.historyRedo.shift();
	}
	const clear = dontClear || false;
	if (!clear) {
		Tools.disableToolsEl('undo');
		Tools.historyRedo.splice(0, Tools.historyRedo.length);
	}
	Tools.historyRedo.push(data);
}

//Scale the canvas on load
Tools.svg.width.baseVal.value = document.body.clientWidth;
Tools.svg.height.baseVal.value = document.body.clientHeight;

/**
 What does a "tool" object look like?
 newtool = {
	  "name" : "SuperTool",
	  "listeners" : {
			"press" : function(x,y,evt){...},
			"move" : function(x,y,evt){...},
			"release" : function(x,y,evt){...},
	  },
	  "draw" : function(data, isLocal){
			//Print the data on Tools.svg
	  },
	  "onstart" : function(oldTool){...},
	  "onquit" : function(newTool){...},
	  "stylesheet" : "style.css",
}
*/


(function () {
	var pos = { top: 0, scroll: 0 };
	var menu = document.getElementById("menu");
	function menu_mousedown(evt) {
		pos = {
			top: menu.scrollTop,
			scroll: evt.clientY
		}
		menu.addEventListener("mousemove", menu_mousemove);
		document.addEventListener("mouseup", menu_mouseup);
	}
	function menu_mousemove(evt) {
		var dy = evt.clientY - pos.scroll;
		menu.scrollTop = pos.top - dy;
	}
	function menu_mouseup(evt) {
		menu.removeEventListener("mousemove", menu_mousemove);
		document.removeEventListener("mouseup", menu_mouseup);
	}
	menu.addEventListener("mousedown", menu_mousedown);
})()
