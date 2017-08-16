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
    createSellOrder(res.balances[TRADE_CONFIG.trade_config.currency_1]);
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
    
    util.log('Buy info: ', JSON.stringify({avgPrice, myNeedPrice, myAmount}, null, 2));

    TRADE.api_query('pair_settings', {}, (res) => {
      let quantity = JSON.parse(res)[pair].min_quantity;

      if (myAmount >= quantity) {
        util.log('Creating BUY order');

        TRADE.api_query('order_create', {
          'pair': pair,
          'quantity': myAmount,
          'price': myNeedPrice,
          'type': 'buy'
        }, (res)=>{
          let res = JSON.parse(res);
          if (res.result === true && _.isEmpty(res.error)) util.log(`Buy order created. id: ${res.order_id}`);
          else util.log('Something went wrong, got error when try to buy');
        });
      }
      else {
        util.log('WARN. Have no money to create Buy Order');
      }
    });
  });
}

function createSellOrder(balanceCurrency_1) {
  util.log('Create Sell order');
  let pair = `${TRADE_CONFIG.trade_config.currency_1}_${TRADE_CONFIG.trade_config.currency_2}`;
  let wannaGet = TRADE_CONFIG.trade_config.can_spend + TRADE_CONFIG.trade_config.can_spend * (TRADE_CONFIG.trade_config.stock_fee + TRADE_CONFIG.trade_config.profit);
  
  util.log('Sell info: ', JSON.stringify({pair, wannaGet, balanceCurrency_1}, null, 2));

  TRADE.api_query('order_create', {
    'pair': pair,
    'quantity': balanceCurrency_1,
    'price': wannaGet,
    'type': 'sell'
  }, (res)=>{
    let res = JSON.parse(res);
    if (res.result === true && _.isEmpty(res.error)) util.log(`Sell order created. id: ${res.order_id}`);
    else util.log('Something went wrong, got error when try to sell');
  });
}

function run() {
  TRADE.init_exmo({key: TRADE_CONFIG.key, secret: TRADE_CONFIG.secret});
  TRADE.api_query("user_open_orders", {}, checkActiveOrders);
}

run();
// exports.run = run;