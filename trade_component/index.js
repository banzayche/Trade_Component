const TRADE = require("./controllers/trade");
const TRADE_CONFIG = require("./config")
const _ = require('lodash');
const util = require('util');


const CURRENCY1 = TRADE_CONFIG.trade_config.currency_1;
const CURRENCY2 = TRADE_CONFIG.trade_config.currency_2;
const CURRENCY_PAIR = `${CURRENCY1}_${CURRENCY2}`;
const STOCK_FEE = TRADE_CONFIG.trade_config.stock_fee;
const PROFIT = TRADE_CONFIG.trade_config.profit;
const ORDER_LIFE_TIME = TRADE_CONFIG.trade_config.order_life_time;
const SPENDING_LIMIT = TRADE_CONFIG.trade_config.can_spend;
const AVG_PRICE_PERIOD = TRADE_CONFIG.trade_config.avg_price_period;


/** 
 * Get current seconds
 */
function getCurrentSeconds() {
  return ((new Date().getTime() / 1000) + TRADE_CONFIG.trade_config.stock_time_offset * 60 * 60);
}
/**
 * Get passed time
 * @param {integer} pastTime - value in seconds in the past
 */
function getPassedTime(pastTime) {
  return (getCurrentSeconds() - pastTime);
}


/**
 *  Step #1
 *  To check Active Sell Orders
 */
function checkActiveOrders(orders) {
  orders = JSON.parse(orders);
  let isNoOrders = _.isEmpty(orders);

  let sellOrder = _.find(orders[CURRENCY_PAIR], ['type', 'sell']);
  let buyOrder = _.find(orders[CURRENCY_PAIR], ['type', 'buy']);

  // To check active orders
  if (!isNoOrders && _.has(orders, CURRENCY_PAIR)) {
    if (sellOrder) {
      util.log('Opened deal already exists. Will check again after 3 minutes.');
      // setInterval(run, 180000);
    } else if (buyOrder) {
      let time_passed = getPassedTime(buyOrder.created);

      // To check old buy orders
      if (time_passed > ORDER_LIFE_TIME * 60) {
        util.log('Order to old, close it.');
        TRADE.api_query('order_cancel', { "order_id": buyOrder.order_id }, closeOrderCallback);
      } else {
        util.log('Opened order isn\'t old anought. Will check again after 3 minutes.');
        // setInterval(run, 180000);
      }
    }
  } else {
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

  // // Check if some currency_1 exists to sell
  // if (parseFloat(res.balances[CURRENCY1]) > 0) {
  //   // Create sell order
  //   createSellOrder(res.balances[CURRENCY1]);
  // } else 
  if (parseFloat(res.balances[CURRENCY2]) >= SPENDING_LIMIT) {
    // Create buy order
    createBuyOrder();
  } else {
    util.log('No money');
    // setInterval(run, 180000);
  }
}

function createBuyOrder(params) {
  util.log('Calculate price and amount for Buy');

  TRADE.api_query('trades', {
    "pair": CURRENCY_PAIR
  }, (res) => {
    // Orders statistics
    res = JSON.parse(res);

    let getPricesByPeriod = _.reduce(res[CURRENCY_PAIR], function(result, value) {
      let condition = getPassedTime(parseFloat(value.date)) < AVG_PRICE_PERIOD * 60;
      if (condition) result.push(parseFloat(value.price));
      return result;
    }, []);

    let avgPrice = _.sum(getPricesByPeriod) / getPricesByPeriod.length;

    let myNeedPrice = avgPrice - avgPrice * (STOCK_FEE + PROFIT);
    let myAmount = SPENDING_LIMIT / myNeedPrice;

    util.log('Buy info: ', JSON.stringify({ avgPrice, myNeedPrice, myAmount }, null, 2));

    // TRADE.api_query('pair_settings', {}, (res) => {
    //   let quantity = JSON.parse(res)[CURRENCY_PAIR].min_quantity;

    //   if (myAmount >= quantity) {
    //     util.log('Creating BUY order');

    //     TRADE.api_query('order_create', {
    //       'pair': CURRENCY_PAIR,
    //       'quantity': myAmount,
    //       'price': myNeedPrice,
    //       'type': 'buy'
    //     }, (res) => {
    //       let res = JSON.parse(res);
    //       if (res.result === true && _.isEmpty(res.error)) util.log(`Buy order created. id: ${res.order_id}`);
    //       else util.log('Something went wrong, got error when try to buy');
    //     });
    //   } else {
    //     util.log('WARN. Have no money to create Buy Order');
    //   }
    // });
  });
}

function createSellOrder(balanceCurrency_1) {
  util.log('Create Sell order');
  let wannaGet = SPENDING_LIMIT + SPENDING_LIMIT * (STOCK_FEE + PROFIT);

  util.log('Sell info: ', JSON.stringify({ CURRENCY_PAIR, wannaGet, balanceCurrency_1 }, null, 2));

  TRADE.api_query('order_create', {
    'pair': CURRENCY_PAIR,
    'quantity': balanceCurrency_1,
    'price': wannaGet,
    'type': 'sell'
  }, (res) => {
    res = JSON.parse(res);
    if (res.result === true && _.isEmpty(res.error)) util.log(`Sell order created. id: ${res.order_id}`);
    else util.log('Something went wrong, got error when try to sell');
  });
}

function run() {
  TRADE.init_exmo({ key: TRADE_CONFIG.key, secret: TRADE_CONFIG.secret });
  TRADE.api_query("user_open_orders", {}, checkActiveOrders);
}

run();
// exports.run = run;