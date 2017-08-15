const express = require('express');
const app = express();
const path = require('path');

app.use('/static', express.static(path.join(__dirname, 'src')));

app.get('/', function(req, res) {
  var responseText = 'Hello World!';
  responseText += 'Requested at: ' + req.requestTime + '';
  res.send(responseText);
});

app.listen(3000, function() {
  console.log('Example app listening on port 3000!');
});


// =================================================================================================================================
// const TRADE_COMPONENT = require('./trade_component/');
// TRADE_COMPONENT.run();