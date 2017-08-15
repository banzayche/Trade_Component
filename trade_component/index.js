// FOR trade request
const TRADE = require("./controllers/trade");
const TRADE_CONFIG = require("./config")
const _ = require('lodash');
const util = require('util');

/**
  *  Step #1
  *  To check Active Sell Orders
  */
function checkActiveOrders(orders) {
  orders = JSON.parse(orders); 
  let isNoOrders = _.isEmpty(orders);
  let neededDealType = `${TRADE_CONFIG.trade_config.currency_1}_${TRADE_CONFIG.trade_config.currency_2}`;

  let sellOrder = _.find(orders[neededDealType], ['type', 'sell']);
  let buyOrder = _.find(orders[neededDealType], ['type', 'buy']);

  // To check active orders
  if (!isNoOrders && _.has(orders, neededDealType)) {
    if (sellOrder) {
      util.log('Opened deal already exists. Will check again after 3 minutes.');
      // setInterval(run, 180000);
    }
    else if (buyOrder) {
      let time_passed = (new Date().getTime() / 1000) + TRADE_CONFIG.trade_config.stock_time_offset*60*60 - buyOrder.created;
      
      // To check old buy orders
      if (time_passed > TRADE_CONFIG.trade_config.order_life_time * 60) {
        util.log('Order to old, close it.');
        TRADE.api_query('order_cancel', {"order_id": buyOrder.order_id}, closeOrderCallback);
      }
      else {
        util.log('Opened order isn\'t old anought. Will check again after 3 minutes.');
        // setInterval(run, 180000);
      }            
    }
  }
  else {
    sellBuyFunction();
  }
}

function closeOrderCallback(res) {
  res = JSON.parse(res);
  util.log(`Close the order. Result is - ${res.result}`);
}

function sellBuyFunction() {
  util.log('No active orders. Need to sell or buy.');
}

function run() {
  TRADE.init_exmo({key: TRADE_CONFIG.key, secret: TRADE_CONFIG.secret});
  TRADE.api_query("user_open_orders", {}, checkActiveOrders);
}

run();
// exports.run = run;