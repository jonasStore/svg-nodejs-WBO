var path = require('path');
const UglifyJS = require("uglify-js");
const fs = require('fs');

var code = {};
var options = {
};


code['pdp'] = fs.readFileSync("./client-data/js/path-data-polyfill.js", "utf8");
code['minitpl'] = fs.readFileSync("./client-data/js/minitpl.js", "utf8");
code['intersect'] = fs.readFileSync("./client-data/js/intersect.js", "utf8");
code['mat_inv'] = fs.readFileSync("./client-data/js/mat_inv.js", "utf8");
code['canvascolor'] = fs.readFileSync("./client-data/js/canvascolor.js", "utf8");
code['board'] = fs.readFileSync("./client-data/js/board.js", "utf8");

fromDir('./client-data/tools','.js');


function fromDir(startPath, filter) {
    
    //console.log('Starting from dir '+startPath+'/');
    
    if (!fs.existsSync(startPath)) {
        console.log("no dir ", startPath);
        return;
    }
    
    var files = fs.readdirSync(startPath);
    for (var i = 0; i < files.length; i++) {
        var filename = path.join(startPath, files[i]);
        var stat = fs.lstatSync(filename);
        if (stat.isDirectory()) {
            fromDir(filename, filter); //recurse
        } else if (filename.endsWith(filter)) {
            // code.push(fs.readFileSync('./'+filename.replace(/\\/g,'/'), "utf8"));
            code[path.basename(filename)] = fs.readFileSync('./'+filename.replace(/\\/g,'/'), "utf8");
        };
    };
};
// console.log(Object.keys(code));
fs.writeFileSync("./client-min-data/js/board.min.js", UglifyJS.minify(code).code, "utf8");