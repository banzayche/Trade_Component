const TRADE = require("./controllers/trade");
const TRADE_CONFIG = require("./config")
const _ = require('lodash');
const winston = require('winston');
var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      colorize: 'all'
    }),
    new (winston.transports.File)({ filename: 'trade_log.log' })
  ]
});

const CURRENCY1 = TRADE_CONFIG.trade_config.currency_1;
const CURRENCY2 = TRADE_CONFIG.trade_config.currency_2;
const CURRENCY_PAIR = `${CURRENCY1}_${CURRENCY2}`;
const STOCK_FEE = TRADE_CONFIG.trade_config.stock_fee;
const PROFIT = TRADE_CONFIG.trade_config.profit;
const ORDER_LIFE_TIME = TRADE_CONFIG.trade_config.order_life_time;
const SPENDING_LIMIT = TRADE_CONFIG.trade_config.can_spend;
const AVG_PRICE_PERIOD = TRADE_CONFIG.trade_config.avg_price_period;

let globalTimeout;
const timeoutTime = 180000;

// Help functions
/**
 * To run the logic
 */
function run() {
  TRADE.init_exmo({ key: TRADE_CONFIG.key, secret: TRADE_CONFIG.secret });
  TRADE.api_query("user_open_orders", {}, checkActiveOrders);
}
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

  let sellOrders = _.filter(orders[CURRENCY_PAIR], { type: 'sell' });
  let buyOrders = _.filter(orders[CURRENCY_PAIR], { type: 'buy' });

  // To check active orders
  if (!isNoOrders && _.has(orders, CURRENCY_PAIR)) {
    processExistingOrders(sellOrders, buyOrders);
  } else {
    logger.info('No active orders. Need to sell or buy.');
    // to get conts of currency_1 and currency_2
    TRADE.api_query('user_info', {}, sellBuyCallback);
  }
}
/**
 * Step #2
 * To process existing orders
 */
function processExistingOrders(sellOrders, buyOrders) {
  if (sellOrders.length > 0) {
    logger.info(`Sell order already exists. Will check again after ${(timeoutTime/1000)/60} minutes.`);
    
    globalTimeout || clearTimeout(globalTimeout);
    globalTimeout = setTimeout(run, timeoutTime);

  } else if (buyOrders.length > 0) {
    processExistingBuyOrders(buyOrders);
  }
}
/**
 * Step #3
 * To process buy orders
 * @param {array} buyOrders - list of user's buy orders 
 */
// TODO: Check it!!!
function processExistingBuyOrders(buyOrders) {
  let interval = null;
  _.forEach(buyOrders, (order) => {
    TRADE.api_query('order_trades', { 'order_id': order.order_id }, (res) => {
      res = JSON.parse(res);
      let halfExecutedCondition = _.has(res, 'trades') && _.get(res, 'trades').length > 0;

      // To close none half-executed and old orders
      if (!halfExecutedCondition && (getPassedTime(order.created) > ORDER_LIFE_TIME * 60)) {
        logger.warn(`Buy order to old, close it. ID - ${order.order_id}`);
        closeOrder(order);
      } else {
        logger.info(`Order id: ${order.order_id} not so old or half-executed. Will check again after ${(timeoutTime/1000)/60} minutes.`);
        // Clear previous interval and setup new to check orders later
        globalTimeout || clearTimeout(globalTimeout);
        globalTimeout = setTimeout(run, timeoutTime);
      }
    });
  });
}
/**
 * Step #4
 * To close old order
 */
function closeOrder(order) {
  TRADE.api_query('order_cancel', { "order_id": order.order_id }, (res) => {
    res = JSON.parse(res);
    logger.warn(`Close the order. Result is - ${res.result}`);
    
    globalTimeout || clearTimeout(globalTimeout);
    globalTimeout = setTimeout(run, timeoutTime);

  });
}
/**
 * Step #5
 * Callback function. To process creating buy or sell order
 * @param {*} res - user_info response 
 */
function sellBuyCallback(res) {
  res = JSON.parse(res);

  // Check if some currency_1 exists to sell
  if (parseFloat(res.balances[CURRENCY1]) > 0) {
    // Create sell order
    createSellOrder(res.balances[CURRENCY1]);
  } else if (parseFloat(res.balances[CURRENCY2]) >= SPENDING_LIMIT) {
    // Create buy order
    createBuyOrder();
  } else {
    logger.warn('No money');
    
    globalTimeout || clearTimeout(globalTimeout);
    globalTimeout = setTimeout(run, timeoutTime);

  }
}
/**
 * Step #6
 * To create Sell order
 * @param {*} sellCurrencyBalance 
 */
function createSellOrder(sellCurrencyBalance) {
  logger.info('Create Sell order');
  let wannaGet = SPENDING_LIMIT + SPENDING_LIMIT * (STOCK_FEE + PROFIT);
  let price = wannaGet / parseFloat(sellCurrencyBalance);

  logger.warn('Sell info: ', JSON.stringify({ CURRENCY_PAIR, wannaGet, price, sellCurrencyBalance }, null, 2));

  TRADE.api_query('order_create', {
    'pair': CURRENCY_PAIR,
    'quantity': sellCurrencyBalance,
    'price': price,
    'type': 'sell'
  }, (res) => {
    res = JSON.parse(res);
    if (res.result === true && _.isEmpty(res.error)) logger.info(`Sell order created. id: ${res.order_id}`);
    else logger.error('Something went wrong, got error when try to sell');
    
    globalTimeout || clearTimeout(globalTimeout);
    globalTimeout = setTimeout(run, timeoutTime);

  });
}
/**
 * Step #7
 * To create Buy order
 */
function createBuyOrder() {
  logger.info('Calculate price and amount for Buy');

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

    logger.warn('Buy info: ', JSON.stringify({ avgPrice, myNeedPrice, myAmount }, null, 2));

    TRADE.api_query('pair_settings', {}, (res) => {
      let quantity = JSON.parse(res)[CURRENCY_PAIR].min_quantity;

      if (myAmount >= quantity) {
        logger.info('Creating BUY order');

        TRADE.api_query('order_create', {
          'pair': CURRENCY_PAIR,
          'quantity': myAmount,
          'price': myNeedPrice,
          'type': 'buy'
        }, (res) => {
          res = JSON.parse(res);
          if (res.result === true && _.isEmpty(res.error)) logger.info(`Buy order created. id: ${res.order_id}`);
          else logger.error('Something went wrong, got error when try to buy');
          globalTimeout || clearTimeout(globalTimeout);
          globalTimeout = setTimeout(run, timeoutTime);
        });
      } else {
        logger.warn('WARN. Have no money to create Buy Order');
        globalTimeout || clearTimeout(globalTimeout);
        globalTimeout = setTimeout(run, timeoutTime);
      }
    });
  });
}

run();
// exports.run = run;