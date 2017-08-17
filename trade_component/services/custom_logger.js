var fs = require('fs');
var util = require('util');
var colors = require('colors');
var logFile = fs.createWriteStream('../logs.log', { flags: 'a' });
// Or 'w' to truncate the file every time the process starts.
var logStdout = process.stdout;

exports.logger = (color, logText) => {
  let date = new Date().toISOString().slice(0, 10);
  let newText = `${date} - ${logText}`;
  custom_logger.apply(null, [newText, colors[color](newText)]);
}

function custom_logger(pureText, colorText) {
  logFile.write(util.format.call(null, pureText) + '\n');
  logStdout.write(util.format.call(null, colorText) + '\n');
}