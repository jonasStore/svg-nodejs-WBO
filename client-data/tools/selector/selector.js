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
	var selectorStates = {
		pointing: 0,
		selecting: 1,
		transform: 2,
		add: 3,
		remove: 4,
		rotate: 5
	}
	var clicked = false;
	var vector;
	var selected = null;
	var selected_els = [];
	var origin_els = [];
	var selectionRect = createSelectorRect();
	var selectionRectTransform;
	var currentTransform = null;
	var transform_elements = [];
	var inv_transform_elements = [];
	var selectorState = selectorStates.pointing;
	var exsitTransform = false;
	var last_sent = 0;
	var blockedSelectionButtons = Tools.server_config.BLOCKED_SELECTION_BUTTONS;
	var selectionButtons = [
		createButton("delete", "delete", 24, 24,
			function (me, bbox, s) {
				me.width.baseVal.value = me.origWidth / s;
				me.height.baseVal.value = me.origHeight / s;
				me.x.baseVal.value = bbox.r[0];
				me.y.baseVal.value = bbox.r[1] - (me.origHeight + 3) / s;
				me.style.display = "";
			},
			deleteSelection),

		createButton("duplicate", "duplicate", 24, 24,
			function (me, bbox, s) {
				me.width.baseVal.value = me.origWidth / s;
				me.height.baseVal.value = me.origHeight / s;
				me.x.baseVal.value = bbox.r[0] + (me.origWidth + 2) / s;
				me.y.baseVal.value = bbox.r[1] - (me.origHeight + 3) / s;
				me.style.display = "";
			},
			duplicateSelection),

		createButton("scaleHandle", "handle", 14, 14,
			function (me, bbox, s) {
				me.width.baseVal.value = me.origWidth / s;
				me.height.baseVal.value = me.origHeight / s;
				me.x.baseVal.value = bbox.r[0] + bbox.a[0] - me.origWidth / (2 * s);
				me.y.baseVal.value = bbox.r[1] + bbox.b[1] - me.origHeight / (2 * s);
				me.style.display = "";
			},
			startScalingTransform),
		createButton("add", "add", 24, 24,
			function (me, bbox, s) {
				me.width.baseVal.value = me.origWidth / s;
				me.height.baseVal.value = me.origHeight / s;
				me.x.baseVal.value = bbox.r[0] + (2 * me.origWidth + 2) / s;
				me.y.baseVal.value = bbox.r[1] - (me.origHeight + 3) / s;
				me.style.display = "";
			},
			startAdd
		),
		createButton("remove", "remove", 24, 24,
			function (me, bbox, s) {
				me.width.baseVal.value = me.origWidth / s;
				me.height.baseVal.value = me.origHeight / s;
				me.x.baseVal.value = bbox.r[0] + (3 * me.origWidth + 2) / s;
				me.y.baseVal.value = bbox.r[1] - (me.origHeight + 3) / s;
				me.style.display = "";
			},
			startRemove
		),
		createButton("moverr", "mover", 24, 24,
			function (me, bbox, s) {
				me.width.baseVal.value = me.origWidth / s;
				me.height.baseVal.value = me.origHeight / s;
				me.x.baseVal.value = bbox.r[0] + (4 * me.origWidth + 2) / s;
				me.y.baseVal.value = bbox.r[1] - (me.origHeight + 3) / s;
				me.style.display = "";
			},
			startMovingElements
		),
		createButton("rotate", "rotate", 14, 14,
			function (me, bbox, s) {
				me.width.baseVal.value = me.origWidth / s;
				me.height.baseVal.value = me.origHeight / s;
				me.x.baseVal.value = bbox.r[0] + bbox.a[0] - me.origWidth / (2 * s);
				me.y.baseVal.value = bbox.r[1] - me.origHeight / (2 * s);
				me.style.display = "";
			},
			startRotate
		)
	];

	for (i in blockedSelectionButtons) {
		delete selectionButtons[blockedSelectionButtons[i]];
	}

	var getScale = Tools.getScale;

	function getParentMathematics(el) {
		var target;
		var a = el;
		var els = [];
		while (a) {
			els.unshift(a);
			a = a.parentElement;
		}
		var parentMathematics = els.find(function (el) {
			return el.getAttribute("class") === "MathElement";
		});
		if ((parentMathematics) && parentMathematics.tagName === "svg") {
			target = parentMathematics;
		}
		return target || el;
	}

	function deleteSelection() {
		const data = { type: 'array', events: [] };
		selected_els.forEach(function (el) {
			data.events.push({
				"type": "delete",
				"id": el.id
			});
		});
		data.sendBack = true;
		Tools.drawAndSend(data, Tools.list.Eraser);
		selected_els = [];
		hideSelectionUI();
	}

	function duplicateSelection() {
		if (!(selectorState == selectorStates.pointing)
			|| (selected_els.length == 0)) return;
		var msgs = [];
		var newids = [];
		var history = []
		for (var i = 0; i < selected_els.length; i++) {
			var id = selected_els[i].id;
			msgs[i] = {
				type: "copy",
				id: id,
				newid: Tools.generateUID(id[0])
			};
			history[i] = {
				type: "delete",
				id: msgs[i].newid
			};
			newids[i] = id;
		}
		Tools.drawAndSend({ _children: msgs });
		Tools.addActionToHistory({
			type: "array",
			events: history
		});
		selected_els = newids.map(function (id) {
			return Tools.svg.getElementById(id);
		});
	}

	function createSelectorRect() {
		var shape = Tools.createSVGElement("rect");
		shape.id = "selectionRect";
		shape.x.baseVal.value = 0;
		shape.y.baseVal.value = 0;
		shape.width.baseVal.value = 0;
		shape.height.baseVal.value = 0;
		shape.setAttribute("stroke", "red");
		shape.setAttribute("stroke-width", 1.5);
		shape.setAttribute("vector-effect", "non-scaling-stroke");
		shape.setAttribute("fill", "none");
		shape.setAttribute("stroke-dasharray", "5 5");
		shape.setAttribute("opacity", 1);
		Tools.svg.appendChild(shape);
		return shape;
	}

	function createButton(name, icon, width, height, drawCallback, clickCallback) {
		var shape = Tools.createSVGElement("image", {
			href: "tools/hand/" + icon + ".svg",
			width: width, height: height
		});
		shape.style.display = "none";
		shape.origWidth = width;
		shape.origHeight = height;
		shape.drawCallback = drawCallback;
		shape.clickCallback = clickCallback;
		Tools.svg.appendChild(shape);
		return shape;
	}

	function showSelectionButtons() {
		var scale = getScale();
		var selectionBBox = selectionRect.transformedBBox();
		for (var i = 0; i < selectionButtons.length; i++) {
			selectionButtons[i].drawCallback(selectionButtons[i],
				selectionBBox,
				scale);
		}
	}

	function hideSelectionButtons() {
		for (var i = 0; i < selectionButtons.length; i++) {
			selectionButtons[i].style.display = "none";
		}
	}

	function hideSelectionUI() {
		hideSelectionButtons();
		selectionRect.style.display = "none";
	}

	function startMovingElements(x, y, evt) {
		evt.preventDefault();
		if (origin_els.length == 0) {
			origin_els = selected_els.map((el, i) => {
				var oldTransform = get_transform_matrix(el);
				return {
					type: "update",
					id: el.id,
					transform: {
						a: oldTransform.a,
						b: oldTransform.b,
						c: oldTransform.c,
						d: oldTransform.d,
						e: oldTransform.e,
						f: oldTransform.f
					}
				};
			})
			// console.log("test", origin_els);
		}

		selectorState = selectorStates.transform;
		currentTransform = moveSelection;
		selected = { x: x, y: y };
		// Some of the selected elements could have been deleted
		selected_els = selected_els.filter(function (el) {
			return Tools.svg.getElementById(el.id) !== null;
		});
		transform_elements = selected_els.map(function (el) {
			var tmatrix = get_transform_matrix(el);
			return {
				a: tmatrix.a, b: tmatrix.b, c: tmatrix.c,
				d: tmatrix.d, e: tmatrix.e, f: tmatrix.f
			};
		});
		var tmatrix = get_transform_matrix(selectionRect);
		selectionRectTransform = { x: tmatrix.e, y: tmatrix.f };
		hideSelectionButtons();
	}

	function startAdd() {
		selectorState = selectorStates.add;

	}

	function startRemove() {
		selectorState = selectorStates.remove;
	}

	function startRotate(x, y, evt) {
		evt.preventDefault();
		if (origin_els.length == 0) {
			origin_els = selected_els.map((el, i) => {
				var oldTransform = get_transform_matrix(el);
				return {
					type: "update",
					id: el.id,
					transform: {
						a: oldTransform.a,
						b: oldTransform.b,
						c: oldTransform.c,
						d: oldTransform.d,
						e: oldTransform.e,
						f: oldTransform.f
					}
				};
			})
			// console.log("test", origin_els);
		}
		hideSelectionButtons();
		selectorState = selectorStates.transform;
		var bbox = selectionRect.transformedBBox();
		selected = {
			x: bbox.r[0],
			y: bbox.r[1],
			w: bbox.a[0],
			h: bbox.b[1],
		};
		vector = [selected.w / 2, selected.h / 2];
		transform_elements = selected_els.map(function (el) {
			var tmatrix = get_transform_matrix(el);
			return {
				a: tmatrix.a, b: tmatrix.b, c: tmatrix.c,
				d: tmatrix.d, e: tmatrix.e, f: tmatrix.f
			};
		});
		inv_transform_elements = transform_elements.map(el_matrix => {
			var matrix = [[el_matrix.a, el_matrix.c, el_matrix.e],
			[el_matrix.b, el_matrix.d, el_matrix.f],
			[0, 0, 1]];
			return matInverse(matrix);
		})
		// console.log("inv", transform_elements, inv_transform_elements);
		var tmatrix = get_transform_matrix(selectionRect);
		selectionRectTransform = {
			a: tmatrix.a, d: tmatrix.d,
			e: tmatrix.e, f: tmatrix.f
		};
		currentTransform = rotateSelection;
	}

	function addSVGElement(x, y, evt) {
		if (clicked && Tools.drawingArea.contains(evt.target)) {
			var add_els = getParentMathematics(evt.target);
			if (selected_els.indexOf(add_els) == -1) {

				selected_els.push(add_els);
				resetSelectionRect();
				console.log("Add", add_els);
			}
		}
	}

	function removeSVGElement(x, y, evt) {
		if (clicked && Tools.drawingArea.contains(evt.target)) {
			var remove_els = getParentMathematics(evt.target);
			var index;
			console.log(selected_els);
			if ((index = selected_els.indexOf(remove_els)) != -1) {

				selected_els.splice(index, 1);
				console.log("Remove", index, remove_els, selected_els);
				resetSelectionRect();
			}
			if (selected_els.length == 0) {
				hideSelectionUI();
			}
		}
	}

	function rotateSelection(x, y) {
		var Cx = selected.x + selected.w / 2, Cy = selected.y + selected.h / 2;

		var V2 = [x - Cx, Cy - y];

		var angle = Math.atan2(V2[1], V2[0]);
		var _angle = Math.atan2(vector[1], vector[0]);
		angle = _angle - angle;

		var tmatrix = get_transform_matrix(selectionRect);
		var msgs = selected_els.map(function (el, i) {
			var oldTransform = transform_elements[i];

			var curPos = matProduct(inv_transform_elements[i], [[Cx], [Cy], [1]]);
			// console.log("inv", [Cx, Cy, 0], curPos);
			var a = Math.cos(angle);
			var b = Math.sin(angle);
			var c = -Math.sin(angle);
			var d = Math.cos(angle);
			// var e = -curPos[0][0] * Math.cos(angle) + curPos[1][0] * Math.sin(angle) + curPos[0][0];
			// var f = -curPos[0][0] * Math.sin(angle) - curPos[1][0] * Math.cos(angle) + curPos[1][0];
			var e = -Cx * Math.cos(angle) + Cy * Math.sin(angle) + Cx;
			var f = -Cx * Math.sin(angle) - Cy * Math.cos(angle) + Cy;
			var finalMatrix = matProduct([[a, c, e], [b, d, f], [0, 0, 1]], [[oldTransform.a, oldTransform.c, oldTransform.e], [oldTransform.b, oldTransform.d, oldTransform.f], [0, 0, 1]])
			return {
				type: "update",
				id: el.id,
				transform: {
					a: finalMatrix[0][0],
					b: finalMatrix[1][0],
					c: finalMatrix[0][1],
					d: finalMatrix[1][1],
					e: finalMatrix[0][2],
					f: finalMatrix[1][2]
				}
			};
		})
		var msg = {
			_children: msgs
		};
		tmatrix.a = Math.cos(angle);
		tmatrix.b = Math.sin(angle);
		tmatrix.c = -Math.sin(angle);
		tmatrix.d = Math.cos(angle);
		tmatrix.e = -Cx * Math.cos(angle) + Cy * Math.sin(angle) + Cx;
		tmatrix.f = -Cx * Math.sin(angle) - Cy * Math.cos(angle) + Cy;
		// angle = tangle;
		var now = performance.now();
		if (now - last_sent > 70) {
			last_sent = now;
			Tools.drawAndSend(msg);
		} else {
			draw(msg);
		}
		exsitTransform = true;
	}

	function startScalingTransform(x, y, evt) {
		evt.preventDefault();
		if (origin_els.length == 0) {
			origin_els = selected_els.map((el, i) => {
				var oldTransform = get_transform_matrix(el);
				return {
					type: "update",
					id: el.id,
					transform: {
						a: oldTransform.a,
						b: oldTransform.b,
						c: oldTransform.c,
						d: oldTransform.d,
						e: oldTransform.e,
						f: oldTransform.f
					}
				};
			})
			// console.log("test", origin_els);
		}
		hideSelectionButtons();
		selectorState = selectorStates.transform;
		var bbox = selectionRect.transformedBBox();
		selected = {
			x: bbox.r[0],
			y: bbox.r[1],
			w: bbox.a[0],
			h: bbox.b[1],
		};
		transform_elements = selected_els.map(function (el) {
			var tmatrix = get_transform_matrix(el);
			return {
				a: tmatrix.a, b: tmatrix.b, c: tmatrix.c,
				d: tmatrix.d, e: tmatrix.e, f: tmatrix.f
			};
		});
		inv_transform_elements = transform_elements.map(el_matrix => {
			var matrix = [[el_matrix.a, el_matrix.c, el_matrix.e],
			[el_matrix.b, el_matrix.d, el_matrix.f],
			[0, 0, 1]];
			return matInverse(matrix);
		})
		console.log("inv", transform_elements, inv_transform_elements);
		var tmatrix = get_transform_matrix(selectionRect);
		selectionRectTransform = {
			a: tmatrix.a, d: tmatrix.d,
			e: tmatrix.e, f: tmatrix.f
		};
		currentTransform = scaleSelection;
	}

	function startSelector(x, y, evt) {
		evt.preventDefault();

		selected = { x: x, y: y };
		selected_els = [];
		selectorState = selectorStates.selecting;
		selectionRect.x.baseVal.value = x;
		selectionRect.y.baseVal.value = y;
		selectionRect.width.baseVal.value = 0;
		selectionRect.height.baseVal.value = 0;
		selectionRect.style.display = "";
		tmatrix = get_transform_matrix(selectionRect);
		tmatrix.e = 0;
		tmatrix.f = 0;
	}


	function calculateSelection() {
		var selectionTBBox = selectionRect.transformedBBox();
		var elements = Tools.drawingArea.children;
		var selected = [];
		for (var i = 0; i < elements.length; i++) {
			if (transformedBBoxIntersects(selectionTBBox, elements[i].transformedBBox()))
				selected.push(Tools.drawingArea.children[i]);
		}
		return selected;
	}

	function moveSelection(x, y) {
		var dx = x - selected.x;
		var dy = y - selected.y;
		var msgs = selected_els.map(function (el, i) {
			var oldTransform = transform_elements[i];
			var el_matrix = get_transform_matrix(el);
			var matrix = [[el_matrix.a, el_matrix.c, el_matrix.e],
			[el_matrix.b, el_matrix.d, el_matrix.f],
			[0, 0, 1]]
			var inv_matrix = matInverse(matrix);
			return {
				type: "update",
				id: el.id,
				transform: {
					a: oldTransform.a,
					b: oldTransform.b,
					c: oldTransform.c,
					d: oldTransform.d,
					e: dx + oldTransform.e,
					f: dy + oldTransform.f,
				}
			};
		})
		var msg = {
			_children: msgs
		};
		var tmatrix = get_transform_matrix(selectionRect);
		tmatrix.e = dx + selectionRectTransform.x;
		tmatrix.f = dy + selectionRectTransform.y;
		var now = performance.now();
		if (now - last_sent > 70) {
			last_sent = now;
			Tools.drawAndSend(msg);
		} else {
			draw(msg);
		}
		exsitTransform = true;
	}

	function scaleSelection(x, y) {
		var tx = rx = (x - selected.x) / (selected.w);
		var ty = ry = (y - selected.y) / (selected.h);
		var _selected = selected, _x = x, _y = y;
		var msgs = selected_els.map(function (el, i) {
			var oldTransform = transform_elements[i];
			// origin = el.transformedBBox(); 
			var x = el.transformedBBox().r[0];
			var y = el.transformedBBox().r[1];
			var rx = tx, ry = ty;
			if (el.tagName == 'text') {
				rx = Math.abs(rx) > Math.abs(ry) ? Math.abs(ry) * tx / Math.abs(tx) : Math.abs(rx) * tx / Math.abs(tx);
				ry = Math.abs(rx) * ty / Math.abs(ty);
			}
			var a = rx;
			var d = ry;
			var b = 0;
			var c = 0;
			var ee = selected.x * (1 - rx);
			var ff = selected.y * (1 - ry);
			var e = oldTransform.a * ee + oldTransform.c * ff + oldTransform.e;
			var f = oldTransform.b * ee + oldTransform.d * ff + oldTransform.f;
			var finalMatrix = matProduct([[a, c, ee], [b, d, ff], [0, 0, 1]], [[oldTransform.a, oldTransform.c, oldTransform.e], [oldTransform.b, oldTransform.d, oldTransform.f], [0, 0, 1]])
			return {
				type: "update",
				id: el.id,
				transform: {
					a: finalMatrix[0][0],
					b: finalMatrix[1][0],
					c: finalMatrix[0][1],
					d: finalMatrix[1][1],
					e: finalMatrix[0][2],
					f: finalMatrix[1][2]
				}
			};
		})
		var msg = {
			_children: msgs
		};

		var tmatrix = get_transform_matrix(selectionRect);
		tmatrix.a = rx;
		tmatrix.d = ry;
		tmatrix.e = selectionRectTransform.e +
			selectionRect.x.baseVal.value * (selectionRectTransform.a - rx)
		tmatrix.f = selectionRectTransform.f +
			selectionRect.y.baseVal.value * (selectionRectTransform.d - ry)
		var now = performance.now();
		if (now - last_sent > 70) {
			last_sent = now;
			Tools.drawAndSend(msg);
		} else {
			draw(msg);
		}
		exsitTransform = true;
	}

	function updateRect(x, y, rect) {
		rect.x.baseVal.value = Math.min(x, selected.x);
		rect.y.baseVal.value = Math.min(y, selected.y);
		rect.width.baseVal.value = Math.abs(x - selected.x);
		rect.height.baseVal.value = Math.abs(y - selected.y);
	}

	function resetSelectionRect() {
		if (!selected_els.length)
			return;
		if (true) {
			angle = 0;
			var padding = 20;
			var tmpBBox = {};
			var point = [];
			var minX = Infinity, minY = Infinity, maxX = 0, maxY = 0, i;
			selected_els.map((el, i) => {
				var bbox = el.transformedBBox();
				point = [
					[bbox.r[0], bbox.r[1]],
					[bbox.r[0] + bbox.a[0], bbox.r[1] + bbox.a[1]],
					[bbox.r[0] + bbox.b[0], bbox.r[1] + bbox.b[1]],
					[bbox.r[0] + bbox.a[0] + bbox.b[0], bbox.r[1] + bbox.a[1] + bbox.b[1]]
				]
				for (i = 0; i < 4; i++) {
					if (minX > point[i][0])
						minX = point[i][0];
					if (minY > point[i][1])
						minY = point[i][1];
					if (maxX < point[i][0])
						maxX = point[i][0];
					if (maxY < point[i][1])
						maxY = point[i][1];
				}
				// console.log(point,minX,minY,maxX,maxY);
			})
			selectionRect.x.baseVal.value = minX - padding;
			selectionRect.y.baseVal.value = minY - padding;
			selectionRect.width.baseVal.value = maxX - minX + 2 * padding;
			selectionRect.height.baseVal.value = maxY - minY + 2 * padding;
		}
		var tmatrix = get_transform_matrix(selectionRect);
		tmatrix.a = 1; tmatrix.b = 0; tmatrix.c = 0;
		tmatrix.d = 1; tmatrix.e = 0; tmatrix.f = 0;
	}

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
		if (transform == null) {
			transform = elem.transform.baseVal.createSVGTransformFromMatrix(Tools.svg.createSVGMatrix());
			elem.transform.baseVal.appendItem(transform);
		}
		return transform.matrix;
	}

	function draw(data) {
		if (data._children) {
			batchCall(draw, data._children);
		}
		else {
			switch (data.type) {
				case "update":
					// console.log("update", data);
					var elem = Tools.svg.getElementById(data.id);
					if (!elem) throw new Error("Mover: Tried to move an element that does not exist.");
					var tmatrix = get_transform_matrix(elem);
					for (i in data.transform) {
						tmatrix[i] = data.transform[i]
					}
					break;
				case "copy":
					var newElement = Tools.svg.getElementById(data.id).cloneNode(true);
					newElement.id = data.newid;
					Tools.drawingArea.appendChild(newElement);
					break;
				default:
					throw new Error("Mover: 'move' instruction with unknown type. ", data);
			}
		}
	}

	function clickSelector(x, y, evt) {
		selectionRect = selectionRect || createSelectorRect();
		for (var i = 0; i < selectionButtons.length; i++) {
			if (selectionButtons[i].contains(evt.target)) {
				var button = selectionButtons[i];
			}
		}
		if (button) {
			button.clickCallback(x, y, evt);

		} else if (pointInTransformedBBox([x, y], selectionRect.transformedBBox())) {

			if (selectorState == selectorStates.remove) {

			} else {
				hideSelectionButtons();
				startMovingElements(x, y, evt);
			}
		} else {
			if (selectorState == selectorStates.add) {

			} else if (Tools.drawingArea.contains(evt.target)) {
				hideSelectionUI();
				selected_els = [getParentMathematics(evt.target)];
				selectorState = selectorStates.transform;
				startMovingElements(x, y, evt)
			} else {
				hideSelectionButtons();
				startSelector(x, y, evt);
			}
		}
	}

	function releaseSelector(x, y, evt) {
		if (selectorState == selectorStates.selecting) {

			selected_els = calculateSelection();
			resetSelectionRect();
			angle = 0;
			if (selected_els.length == 0) {
				hideSelectionUI();
				transform_elements = [];
			}

		}
		if (selectorState == selectorStates.transform) {
			updateRect(x, y, selectionRect)
			// hideSelectionButtons();
			resetSelectionRect();
		}
		if (selected_els.length != 0) {
			selectionRect.style.display = "";
			resetSelectionRect()
			showSelectionButtons();
		}
		if (exsitTransform && (origin_els.length != 0)) {
			// Tools.history.push({_children: msg})

			origin_els = origin_els.map((el, i) => {
				var oldTransform = get_transform_matrix(selected_els[i]);
				return {
					...el,
					old_transform: {
						a: oldTransform.a,
						b: oldTransform.b,
						c: oldTransform.c,
						d: oldTransform.d,
						e: oldTransform.e,
						f: oldTransform.f
					}
				}
			})
			Tools.addActionToHistory({ _children: origin_els, type: 'update' })
			// Tools.drawAndSend({ _children: origin_els, type: 'update' })
			// console.log("history", Tools.history);
		}

		if (selectorState == selectorStates.add || selectorState == selectorStates.remove) {
			resetSelectionRect()
		} else
			selectorState = selectorStates.pointing;
	}

	function moveSelector(x, y, evt) {
		// console.log("selectorState:", selectorState);
		if (selectorState == selectorStates.selecting) {
			updateRect(x, y, selectionRect);
		} else if (selectorState == selectorStates.remove) {
			if (pointInTransformedBBox([x, y], selectionRect.transformedBBox()))
				removeSVGElement(x, y, evt)
		} else if (selectorState == selectorStates.transform && currentTransform) {

			currentTransform(x, y);
		} else if (selectorState == selectorStates.add) {
			if (!pointInTransformedBBox([x, y], selectionRect.transformedBBox()))
				addSVGElement(x, y, evt)
		}
	}

	function press(x, y, evt, isTouchEvent) {
		clicked = true;
		clickSelector(x, y, evt, isTouchEvent);
	}

	function move(x, y, evt, isTouchEvent) {
		moveSelector(x, y, evt, isTouchEvent);
	}

	function release(x, y, evt, isTouchEvent) {
		if (selected && (selected.x != x) && (selected.y != y))
			move(x, y, evt, isTouchEvent);
		releaseSelector(x, y, evt, isTouchEvent);
		selected = null;
		origin_els = [];
		clicked = false;
		exsitTransform = false;
	}

	function deleteShortcut(e) {
		if (e.key == "Delete" &&
			!e.target.matches("input[type=text], textarea"))
			deleteSelection();
	}

	function duplicateShortcut(e) {
		if (e.key == "d" &&
			!e.target.matches("input[type=text], textarea"))
			duplicateSelection();
	}

	function onquit() {
		selected = null;
		hideSelectionUI();
		window.removeEventListener("keydown", deleteShortcut);
		window.removeEventListener("keydown", duplicateShortcut);
	}

	var handTool = { //The new tool
		"name": "Selector",
		"shortcut": "h",
		"listeners": {
			"press": press,
			"move": move,
			"release": release,
		},
		"onquit": onquit,
		"draw": draw,
		"icon": "tools/selector/selector.svg",
		"mouseCursor": "move",
		"showMarker": true,
	};
	Tools.add(handTool);
	Tools.hideSelectionUI = hideSelectionUI;
	Tools.change("Hand"); // Use the hand tool by default
})(); //End of code isolation
