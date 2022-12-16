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

(function hand() { //Code isolation

	var selected = null;
	var last_sent = 0;

	function get_transform_matrix(elem) {
		// Returns the first translate or transform matrix or makes one
		var transform = null;
		for (var i = 0; i < elem.transform.baseVal.numberOfItems; ++i) {
			var baseVal = elem.transform.baseVal[i];
			// quick tests showed that even if one changes only the fields e and f or uses createSVGTransformFromMatrix
			// the brower may add a SVG_TRANSFORM_MATRIX instead of a SVG_TRANSFORM_TRANSLATE
			if (baseVal.type === SVGTransform.SVG_TRANSFORM_MATRIX) {
				transform = baseVal;
				break;
			}
		}
		if (transform === null) {
			transform = elem.transform.baseVal.createSVGTransformFromMatrix(Tools.svg.createSVGMatrix());
			elem.transform.baseVal.appendItem(transform);
		}
		return transform.matrix;
	}

	function draw(data) {
			switch (data.type) {
				case "update":
					var elem = Tools.svg.getElementById(data.id);
					if (!elem) return;
					var tmatrix = get_transform_matrix(elem);
					for (var i in data.transform) {
						tmatrix[i] = data.transform[i];
					}
					break;
				default:
					throw new Error("Mover: 'move' instruction with unknown type. ", data);
			}
	}

	function startHand(x, y, evt, isTouchEvent) {
		if (!isTouchEvent) {
			selected = {
				x: document.documentElement.scrollLeft + evt.clientX,
				y: document.documentElement.scrollTop + evt.clientY,
			};
		}
	}

	function moveHand(x, y, evt, isTouchEvent) {
		if (selected && !isTouchEvent) { //Let the browser handle touch to scroll
			window.scrollTo(selected.x - evt.clientX, selected.y - evt.clientY);
		}
	}

	function press(x, y, evt, isTouchEvent) {
		startHand(x, y, evt, isTouchEvent);
	}


	function move(x, y, evt, isTouchEvent) {
		 moveHand(x, y, evt, isTouchEvent);
	}

	function release(x, y, evt, isTouchEvent) {
		move(x, y, evt, isTouchEvent);
		selected = null;
	}

	var handTool = { //The new tool
		"name": "Hand",
		"shortcut": "h",
		"listeners": {
			"press": press,
			"move": move,
			"release": release,
		},
		"icon": "tools/hand/hand.svg",
		"draw": draw,
		"mouseCursor": "move",
		"showMarker": true,
	};
	Tools.add(handTool);
	//Tools.change("Hand"); // Use the hand tool by default
})(); //End of code isolation
