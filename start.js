const express = require('express');
const app = express();
const path = require('path');
const router = express.Router();

const CryptoJS = require('crypto-js');

// NOTICE middlevare function 
var myLogger = function (req, res, next) {
  console.log('LOGGED');
  next();
};
app.use(myLogger);

var requestTime = function (req, res, next) {
  req.requestTime = Date.now();
  next();
};

app.use(requestTime);
// =====================
// Example of using array of functions, for only one route
var cb0 = function (req, res, next) {
  console.log('CB0');
  next();
}

var cb1 = function (req, res, next) {
  console.log('CB1');
  next();
}

var cb2 = function (req, res) {
  res.send('Hello from C!');
}

app.get('/example/c', [cb0, cb1, cb2]);
// =========================================

app.use('/static', express.static(path.join(__dirname, 'src')));



app.get('/', function (req, res) {
  var responseText = 'Hello World!';
  responseText += 'Requested at: ' + req.requestTime + '';
  res.send(responseText);
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});


// =================================================================================================================================
const TRADE_COMPONENT = require('./trade_component/');
TRADE_COMPONENT.run();

  