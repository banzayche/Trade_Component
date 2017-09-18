# trade_bot
to investigate this area

Use as npm dependency
```
let component = require('trade_bot');
const configs = {
  "key":"???",
  "secret":"???",
  "trade_config": {
    "currency_1": "BTC",
    "currency_2": "USD",
    "order_life_time": 3,
    "stock_time_offset": 0,
    "stock_fee": 0.002,
    "avg_price_period": 30,
    "can_spend": 10,
    "profit": 0.001
  }
};

// To start trading
component.initConstants(configs);
// To stop trading
component.closeTrading();
```

## before start execute
`npm install`

## you able to start by executing
`npm start`

### or by double click on on of the files
`run_onMac.command` (for MAC)

`run_onPC.bat`     (for PC)