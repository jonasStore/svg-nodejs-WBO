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
(function () { //Code isolation
    //Indicates the id of the line the user is currently drawing or an empty string while the user is not drawing
    var curLine = null,
        shift = false,
        lastTime = performance.now(); //The time at which the last point was drawn

    //The data of the message that will be sent for every update
    function UpdateMessage(x, y) {
        this.type = 'update';
        this.id = curLine.id;
        this.x2 = x;
        this.y2 = y;
    }

    function startLine(x, y, evt) {

        //Prevent the press from being interpreted by the browser
        if (evt) evt.preventDefault();

        curLine = {
            'type': 'straight',
            'id': Tools.generateUID("s"), //"s" for straight line
            'color': Tools.getColor(),
            'size': Tools.getSize(),
            'opacity': Tools.getOpacity(),
            'x': x,
            'y': y,
            'arrow': true,
        }

        Tools.drawAndSend(curLine);
    }

    function continueLine(x, y, evt) {
        if (evt) {
            shift = evt.shiftKey;
            evt.preventDefault();
        }
        /*Wait 50ms before adding any point to the currently drawing line.
        This allows the animation to be smother*/
        if (curLine !== null) {
            if (shift) {
                var alpha = Math.atan2(y - curLine.y, x - curLine.x);
                var d = Math.hypot(y - curLine.y, x - curLine.x);
                var increment = 2 * Math.PI / 16;
                alpha = Math.round(alpha / increment) * increment;
                x = curLine.x + d * Math.cos(alpha);
                y = curLine.y + d * Math.sin(alpha);
            }
            if (performance.now() - lastTime > 50) {
                Tools.drawAndSend(new UpdateMessage(x, y));
                lastTime = performance.now();
            } else {
                draw(new UpdateMessage(x, y));
            }
        }
    }

    function stopLine(x, y) {
        //Add a last point to the line
        continueLine(x, y);
        if (curLine) {
            Tools.addActionToHistory({ type: "delete", id: curLine.id })
        }
        curLine = null;
    }

    function draw(data) {
        switch (data.type) {
            case "straight":
                createLine(data);
                break;
            case "update":
                var line = svg.getElementById(data['id']);
                if (!line) {
                    console.error("Straight line: Hmmm... I received a point of a line that has not been created (%s).", data['id']);
                    createLine({ //create a new line in order not to loose the points
                        "id": data['id'],
                        "x": data['x2'],
                        "y": data['y2'],
                        "transform": `matrix(${data.transform.a},${data.transform.b},${data.transform.c},${data.transform.d},${data.transform.e},${data.transform.f})`
                    });
                }
                updateLine(line, data);
                break;
            default:
                console.error("Straight Line: Draw instruction with unknown type. ", data);
                break;
        }
    }

    var svg = Tools.svg;
    function createLine(lineData) {
        //Creates a new line on the canvas, or update a line that already exists with new information
        var line = svg.getElementById(lineData.id) || Tools.createSVGElement("line");
        const color = lineData.color || "black";
        if (lineData.dotted) line.classList.add('dotted');
        if (lineData.arrow) {
            createMarker(color);
            line.style = `marker-end: url(#m-${color});`
        }
        line.id = lineData.id;
        line.x1.baseVal.value = lineData['x'];
        line.y1.baseVal.value = lineData['y'];
        line.x2.baseVal.value = lineData['x2'] || lineData['x'];
        line.y2.baseVal.value = lineData['y2'] || lineData['y'];
        //If some data is not provided, choose default value. The line may be updated later
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", lineData.size || 10);
        line.setAttribute("opacity", Math.max(0.1, Math.min(1, lineData.opacity)) || 1);
        if (lineData.transform)
				line.setAttribute("transform", `matrix(${lineData.transform.a},${lineData.transform.b},${lineData.transform.c},${lineData.transform.d},${lineData.transform.e},${lineData.transform.f})`);
        Tools.drawingArea.appendChild(line);
        return line;
    }

    const defs = document.getElementById('defs');
    function createMarker(color) {
        const id = 'm-' + color;
        if (!document.getElementById(id)) {
            const newMarker =
                `<marker id="${id}"  viewBox="0 0 10 10" refX="7.7" refY="5"
                        fill="${color}"
						markerUnits="strokeWidth"  orient="auto"
						markerWidth="5" markerHeight="5">
					<polyline points="0 0 10 5 0 10 0 5" />
				</marker>`;
            defs.insertAdjacentHTML('beforeend', newMarker)
        }
    }

    function updateLine(line, data) {
        line.x2.baseVal.value = data['x2'];
        line.y2.baseVal.value = data['y2'];
        if (data.transform)
				line.setAttribute("transform", `matrix(${data.transform.a},${data.transform.b},${data.transform.c},${data.transform.d},${data.transform.e},${data.transform.f})`);
    }

    var lineTool = {
        "name": "Arrow Line",
        "shortcut": "gl",
        "listeners": {
            "press": startLine,
            "move": continueLine,
            "release": stopLine,
        },
        "draw": draw,
        "mouseCursor": "crosshair",
        "icon": "tools/arrow/arrow.svg",
    };
    Tools.add(lineTool);
})(); //End of code isolation
