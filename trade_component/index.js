// FOR trade request
const TRADE = require("./controllers/trade");
const TRADE_CONFIG = require("./config")

function run() {
  TRADE.init_exmo({key: TRADE_CONFIG.key, secret: TRADE_CONFIG.secret});
  
  /**
   *  To Get Active Orders
   */
  TRADE.api_query("user_open_orders", {}, function(result){
    console.log(result);
  });
}

exports.run = run;