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
    util.log('No active orders. Need to sell or buy.');
    // to get conts of currency_1 and currency_2
    TRADE.api_query('user_info', {}, sellBuyFunction);
  }
}

function closeOrderCallback(res) {
  res = JSON.parse(res);
  util.log(`Close the order. Result is - ${res.result}`);
}

function sellBuyFunction(res) {
  res = JSON.parse(res);

  // Check if some currency_1 exists to sell
  if (parseFloat(res.balances[TRADE_CONFIG.trade_config.currency_1]) > 0) {
    // Create sell order
    createSellOrder();
  }
  else if (parseFloat(res.balances[TRADE_CONFIG.trade_config.currency_2]) >= TRADE_CONFIG.trade_config.can_spend) {
    // Create buy order
    createBuyOrder();
  }
  else {
    util.log('No money');
    // setInterval(run, 180000);
  }
}

function createBuyOrder(params) {
  util.log('Calculate price and amount for Buy');
  let pair = `${TRADE_CONFIG.trade_config.currency_1}_${TRADE_CONFIG.trade_config.currency_2}`;

  TRADE.api_query('trades', {
    "pair": pair
  }, (res) => {
    // Orders statistics
    res = JSON.parse(res);

    let time_check = (new Date().getTime() / 1000) + TRADE_CONFIG.trade_config.stock_time_offset*60*60;

    let getPricesByPeriod = _.reduce(res[pair], function(result, value) {
      let condition = time_check - parseFloat(value.date) < TRADE_CONFIG.trade_config.avg_price_period*60;
      if (condition) result.push(parseFloat(value.price));
      return result;
    }, []);

    let avgPrice = _.sum(getPricesByPeriod)/getPricesByPeriod.length;   

    let myNeedPrice = avgPrice - avgPrice * (TRADE_CONFIG.trade_config.stock_fee + TRADE_CONFIG.trade_config.profit);
    let myAmount = TRADE_CONFIG.trade_config.can_spend/myNeedPrice;
    
    util.log('avgPrice: ', avgPrice);
    util.log('myNeedPrice: ', myNeedPrice);
    util.log('myAmount: ', myAmount);


    TRADE.api_query('pair_settings', {}, (res) => {
      let quantity = JSON.parse(res)[pair].min_quantity;

      if (myAmount >= quantity) {
        util.log('Creating BUY order')
      }
      else {
        util.log('WARN. Have no money to create Buy Order');
      }
    });
  });
}

function createSellOrder(params) {
  util.log('Create Sell order');
}

function run() {
  TRADE.init_exmo({key: TRADE_CONFIG.key, secret: TRADE_CONFIG.secret});
  TRADE.api_query("user_open_orders", {}, checkActiveOrders);
}

run();
// exports.run = run;