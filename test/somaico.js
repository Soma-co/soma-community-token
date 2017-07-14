const solidityTestUtil = {
  evmIncreaseTime: (seconds) => new Promise((resolve, reject) =>
    web3.currentProvider.sendAsync({
      jsonrpc: "2.0",
      method: "evm_increaseTime",
      params: [seconds],
      id: new Date().getTime()
    }, (error, result) => error ? reject(error) : resolve(result.result)))
};

var getTransactionReceiptMined = function (txnHash, interval) {
    var transactionReceiptAsync;
    interval |= 500;
    transactionReceiptAsync = function(txnHash, resolve, reject) {
        try {
            var receipt = web3.eth.getTransactionReceipt(txnHash);
            if (receipt == null) {
                setTimeout(function () {
                    transactionReceiptAsync(txnHash, resolve, reject);
                }, interval);
            } else {
                resolve(receipt);
            }
        } catch(e) {
            reject(e);
        }
    };

    return new Promise(function (resolve, reject) {
        transactionReceiptAsync(txnHash, resolve, reject);
    });
};

var SomaIco = artifacts.require("./SomaIco.sol");

contract('SomaIco', function(accounts) {

  it("should not be halted when created", function(done) {
      SomaIco.new(accounts[2], 1234, accounts[1], 8000 * Math.pow(10, 18), 8000 * Math.pow(10, 18), 120000 * Math.pow(10, 18), {from: accounts[0]}).then(function(instance) {
      return instance.halted();
    }).then(function(isHalted) {
      assert.equal(isHalted, false, "should not be halted");
    }).then(done, done);
  });

  it("should be halted and then unhalted", function(done) {
      var soma;
      SomaIco.new(accounts[0], 1234, accounts[1], 8000 * Math.pow(10, 18), 8000 * Math.pow(10, 18), 120000 * Math.pow(10, 18), {from: accounts[0]}).then(function(instance) {
      soma = instance;
      return soma.haltFundraising({from: accounts[0]});
    }).then(function() {
      return soma.halted();
    }).then(function(isHalted) {
      assert.equal(isHalted, true, "should be halted");
      return soma.unhaltFundraising({from: accounts[0]});
    }).then(function() {
      return soma.halted();
    }).then(function(isHalted) {
      assert.equal(isHalted, false, "should be unhalted again");
    }).then(done, done);
  });

  it("should be properly created", function(done) {
    var soma;
    SomaIco.new(accounts[2], 1234, accounts[1], 8000 * Math.pow(10, 18), 8000 * Math.pow(10, 18), 120000 * Math.pow(10, 18), {from: accounts[0]}).then(function(instance) {
      soma = instance;
      return soma.totalSupply();
    }).then(function(totalSupply) {
      assert.equal(totalSupply, 0, "0 == totalSupply expected");
      return soma.paused();
    }).then(function(paused) {
      assert.equal(paused, true, "should be paused");
      return soma.preSaleStartTimestamp();
    }).then(function(preSaleStartTimestamp) {
      assert.equal(preSaleStartTimestamp, 1234, "preSaleStartTimestamp should be == 1234");
      return soma.preSaleEndTimestamp();
    }).then(function(preSaleEndTimestamp) {
      assert.equal(preSaleEndTimestamp, 1234 + (28 * 24 * 60 * 60), "preSaleEndTimestamp should == preSaleStartTimestamp + 28 days");
      return soma.wallet();
    }).then(function(wallet) {
      assert.equal(wallet, accounts[1], "incorrect wallet");
      return soma.owner();
    }).then(function(owner) {
      assert.equal(owner, accounts[2], "incorrect owner");
      return soma.totalRaised();
    }).then(function(totalRaised) {
      assert.equal(totalRaised, 0, "totalRaised should be zero");
    }).then(done, done);
  });

  it("should handle setIcoDates properly", function(done) {
    var soma;
    SomaIco.new(accounts[2], 1234, accounts[1], 8000 * Math.pow(10, 18), 8000 * Math.pow(10, 18), 120000 * Math.pow(10, 18), {from: accounts[0]}).then(function(instance) {
      soma = instance;
      return soma.icoStartTimestamp();
    }).then(function(icoStartTimestamp) {
      assert.equal(icoStartTimestamp, 0, "0 == icoStartTimestamp expected");
      return soma.icoEndTimestamp();
    }).then(function(icoEndTimestamp) {
      assert.equal(icoEndTimestamp, 0, "0 == icoEndTimestamp expected");
      return soma.setIcoDates(1000000, 2000000, {from: accounts[2]});
    }).then(function() {
      return soma.icoStartTimestamp();
    }).then(function(icoStartTimestamp) {
      assert.equal(icoStartTimestamp, 1000000, "1000000 == icoStartTimestamp expected");
      return soma.icoEndTimestamp();
    }).then(function(icoEndTimestamp) {
      assert.equal(icoEndTimestamp, 2000000, "2000000 == icoEndTimestamp expected");
    }).then(done, done);
  });

  it("should convert 1 ETH to 450 * 125% in PreSale", function(done) {
    var currentBlockTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    var soma;
    var walletInitBalance;

    SomaIco.new(accounts[0], currentBlockTimeStamp - 90, accounts[5], 8000 * Math.pow(10, 18), 8000 * Math.pow(10, 18), 120000 * Math.pow(10, 18), {from: accounts[0]}).then(function(instance) {
      walletInitBalance = web3.eth.getBalance(accounts[5]);
      soma = instance;
      return soma.sendTransaction({ from: accounts[1], value: web3.toWei(1, "ether") });
    }).then(function(result) {
      // check if Buy event was emited:
      assert.equal(result.logs.length, 1, "No event emited");
      assert.equal(result.logs[0].event, "Buy", "Buy event was not emited");
      return getTransactionReceiptMined(result.tx);
    }).then(function(result) {
      return soma.isPreSalePeriod();
    }).then(function(isPreSalePeriod) {
      assert.equal(isPreSalePeriod, true, "it should be preSale period now");
      return soma.balanceOf(accounts[1]);
    }).then(function(balanceOf) {
      assert.equal(balanceOf.toNumber(), parseInt(Math.pow(10, 18) * 450 * 1.25), "incorrect balance after investment with bonus");
      return soma.totalRaised();
    }).then(function(totalRaised) {
      assert.equal(totalRaised.toNumber(), Math.pow(10, 18), "incorrect totalRaised after investment with bonus");
      return soma.totalSupply();
    }).then(function(totalSupply) {
      assert.equal(totalSupply.toNumber(), parseInt(Math.pow(10, 18) * 450 * 1.25), "incorrect totalSupply after investment with bonus");
      var walletBalance = web3.eth.getBalance(accounts[5]);
      assert.equal(web3.eth.getBalance(soma.address), 0, "contract balance should be zero at all times");
      assert.equal(walletBalance.toNumber(), parseInt(Math.pow(10, 18)) + walletInitBalance.toNumber(), "wallet balance should have increased by 1 ETH");
    }).then(done, done);
  });
  
  it("should fail as preSale did not start yet", function(done) {
    var currentBlockTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    var soma;
    SomaIco.new(accounts[0], currentBlockTimeStamp + 60*60, accounts[2], 8000 * Math.pow(10, 18), 8000 * Math.pow(10, 18), 120000 * Math.pow(10, 18), {from: accounts[0]}).then(function(instance) {
      soma = instance;
      return soma.isPreSalePeriod();
    }).then(function(isPreSalePeriod) {
      assert.equal(isPreSalePeriod, false, "it should NOT be preSale period now (1)");
      return soma.sendTransaction({ from: accounts[1], value: web3.toWei(1, "ether") });
    }).then(assert.fail).catch(function(error) {
      assert(error.message.indexOf('invalid opcode') >= 0, 'Expected throw, but got: ' + error);
    }).then(done, done);
  });

  it("should fail as preSale is over but ICO dates were not set yet", function(done) {
    var currentBlockTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    var soma;
    SomaIco.new(accounts[0], currentBlockTimeStamp - 90, accounts[2], 8000 * Math.pow(10, 18), 8000 * Math.pow(10, 18), 120000 * Math.pow(10, 18), {from: accounts[0]}).then(function(instance) {
      soma = instance;
      return solidityTestUtil.evmIncreaseTime(100 + 28 * 24 * 60 * 60);
    }).then(function() {
      return soma.sendTransaction({ from: accounts[1], value: web3.toWei(1, "ether") });
    }).then(assert.fail).catch(function(error) {
      assert(error.message.indexOf('invalid opcode') >= 0, 'Expected throw, but got: ' + error);
    }).then(done, done);
  });

  it("should fail as it's halted", function(done) {
    var currentBlockTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    var soma;
    SomaIco.new(accounts[0], currentBlockTimeStamp - 90, accounts[2], 8000 * Math.pow(10, 18), 8000 * Math.pow(10, 18), 120000 * Math.pow(10, 18), {from: accounts[0]}).then(function(instance) {
      soma = instance;
      return soma.haltFundraising({from: accounts[0]});
    }).then(function() {
      return soma.sendTransaction({ from: accounts[1], value: web3.toWei(1, "ether") });
    }).then(assert.fail).catch(function(error) {
      assert(error.message.indexOf('invalid opcode') >= 0, 'Expected throw, but got: ' + error);
    }).then(done, done);
  });

  it("should NOT fail as it's unhalted", function(done) {
    var currentBlockTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    var soma;
    SomaIco.new(accounts[0], currentBlockTimeStamp - 90, accounts[2], 8000 * Math.pow(10, 18), 8000 * Math.pow(10, 18), 120000 * Math.pow(10, 18), {from: accounts[0]}).then(function(instance) {
      soma = instance;
      return soma.unhaltFundraising({from: accounts[0]});
    }).then(function() {
      return soma.sendTransaction({ from: accounts[1], value: web3.toWei(1, "ether") });
    }).then(function(){}).catch(assert.fail).then(done, done);
  });

  it("should fail as it's zero ETH investment", function(done) {
    var currentBlockTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    var soma;
    SomaIco.new(accounts[0], currentBlockTimeStamp - 90, accounts[2], 8000 * Math.pow(10, 18), 8000 * Math.pow(10, 18), 120000 * Math.pow(10, 18), {from: accounts[0]}).then(function(instance) {
      soma = instance;
      return soma.sendTransaction({ from: accounts[1], value: 0 /*web3.toWei(0, "ether")*/ });
    }).then(assert.fail).catch(function(error) {
      assert(error.message.indexOf('invalid opcode') >= 0, 'Expected throw, but got: ' + error);
    }).then(done, done);
  });

  it("should fail when target for PreSale is reached in PreSale phase", function(done) {
    var currentBlockTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    var soma;
    SomaIco.new(accounts[0], currentBlockTimeStamp - 90, accounts[6], 2 * Math.pow(10, 18), 2 * Math.pow(10, 18), 2 * Math.pow(10, 18), {from: accounts[0]}).then(function(instance) {
      soma = instance;
      return soma.sendTransaction({ from: accounts[1], value: web3.toWei(2, "ether") });
    }).then(function(result) {
      // check if Buy event was emited:
      assert.equal(result.logs.length, 1, "No event emited");
      assert.equal(result.logs[0].event, "Buy", "Buy event was not emited");
      // sending one more Ether:
      return soma.sendTransaction({ from: accounts[1], value: web3.toWei(1, "ether") });
    }).then(assert.fail).catch(function(error) {
      assert(error.message.indexOf('invalid opcode') >= 0, 'Expected throw, but got: ' + error);
    }).then(done, done);
  });

  it("should fail when max target for ICO is reached in ICO phase", function(done) {
    var currentBlockTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    var soma;
    SomaIco.new(accounts[0], currentBlockTimeStamp - 90, accounts[6], 2 * Math.pow(10, 18), 2 * Math.pow(10, 18), 3 * Math.pow(10, 18), {from: accounts[0]}).then(function(instance) {
      soma = instance;
      // PreSale Phase:
      return soma.sendTransaction({ from: accounts[6], value: web3.toWei(1.5, "ether") });
    }).then(function(result) {
      assert.equal(result.logs.length, 1, "No event emited");
      assert.equal(result.logs[0].event, "Buy", "Buy event was not emited");
      assert.equal(result.logs[0].args.recipient, accounts[6], "Incorrect recipient");
      assert.equal(result.logs[0].args.weiAmount, parseInt(1.5 * Math.pow(10, 18)), "Incorrect number of weiAmount");
      assert.equal(result.logs[0].args.tokens, parseInt(Math.pow(10, 18) * 450 * 1.25 * 1.5), "Incorrect number of SCT tokens");
      var icoStartTimeStamp = currentBlockTimeStamp + 28 * 24 * 60 * 60;
      var icoEndTimeStamp = icoStartTimeStamp + 1000;
      return soma.setIcoDates(icoStartTimeStamp, icoEndTimeStamp, {from: accounts[0]});
    }).then(function() {
      // Fastforward to ICO phase:
      return solidityTestUtil.evmIncreaseTime(100 + 28 * 24 * 60 * 60);
    }).then(function() {
      // sending 4 ETH, to exhaust max target (should still be fine):
      return soma.sendTransaction({ from: accounts[7], value: web3.toWei(4, "ether") });
    }).then(function(result) {
      assert.equal(result.logs.length, 1, "No event emited");
      assert.equal(result.logs[0].event, "Buy", "Buy event was not emited");
      assert.equal(result.logs[0].args.recipient, accounts[7], "Incorrect recipient");
      assert.equal(result.logs[0].args.weiAmount, 4 * Math.pow(10, 18), "Incorrect number of weiAmount");
      assert.equal(result.logs[0].args.tokens, 4 * 450 * Math.pow(10, 18), "Incorrect number of SCT tokens");
      // sending 0.1 ETH more, should fail this time:
      return soma.sendTransaction({ from: accounts[5], value: web3.toWei(0.1, "ether") });
    }).then(assert.fail).catch(function(error) {
      assert(error.message.indexOf('invalid opcode') >= 0, 'Expected throw, but got: ' + error);
      return soma.totalSupply();
    }).then(function(totalSupply) {
      // divided by Math.pow(10, 5) to still be within JS int scope:
      assert.equal(totalSupply.div(Math.pow(10, 5)), parseInt(Math.pow(10, 13) * 450 * (1.25*1.5 + 4)), "Incorrect totalSupply");
      return soma.totalRaised();
    }).then(function(totalRaised) {
      assert.equal(totalRaised, (1.5 + 4) * Math.pow(10, 18), "Incorrect totalRaised");
    }).then(done, done);
  });

  it("should calculate proper bonuses in various days of the PreSale phase", function(done) {
    var currentBlockTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    var soma;
    SomaIco.new(accounts[0], currentBlockTimeStamp - 90, accounts[6], 200 * Math.pow(10, 18), 200 * Math.pow(10, 18), 300 * Math.pow(10, 18), {from: accounts[0]}).then(function(instance) {
      soma = instance;
      // PreSale Phase 1:
      return soma.sendTransaction({ from: accounts[1], value: web3.toWei(1, "ether") });
    }).then(function(result) {
      assert.equal(result.logs.length, 1, "No event emited");
      assert.equal(result.logs[0].event, "Buy", "Buy event was not emited");
      assert.equal(result.logs[0].args.recipient, accounts[1], "Incorrect recipient");
      assert.equal(result.logs[0].args.weiAmount, 1 * Math.pow(10, 18), "Incorrect number of weiAmount");
      assert.equal(result.logs[0].args.tokens, parseInt(Math.pow(10, 18) * 450 * 1.25 * 1), "Incorrect number of SCT tokens");
      // Fastforward 2 moredays:
      return solidityTestUtil.evmIncreaseTime(2 * 24 * 60 * 60);
    }).then(function() {
      // PreSale Phase 2:
      return soma.sendTransaction({ from: accounts[2], value: web3.toWei(1, "ether") });
    }).then(function(result) {
      assert.equal(result.logs.length, 1, "No event emited");
      assert.equal(result.logs[0].event, "Buy", "Buy event was not emited");
      assert.equal(result.logs[0].args.recipient, accounts[2], "Incorrect recipient");
      assert.equal(result.logs[0].args.weiAmount, 1 * Math.pow(10, 18), "Incorrect number of weiAmount");
      assert.equal(result.logs[0].args.tokens, parseInt(Math.pow(10, 18) * 450 * 1.20 * 1), "Incorrect number of SCT tokens");
      // Fastforward 5 more days:
      return solidityTestUtil.evmIncreaseTime(5 * 24 * 60 * 60);
    }).then(function() {
      // PreSale Phase 3:
      return soma.sendTransaction({ from: accounts[3], value: web3.toWei(1, "ether") });
    }).then(function(result) {
      assert.equal(result.logs.length, 1, "No event emited");
      assert.equal(result.logs[0].event, "Buy", "Buy event was not emited");
      assert.equal(result.logs[0].args.recipient, accounts[3], "Incorrect recipient");
      assert.equal(result.logs[0].args.weiAmount, 1 * Math.pow(10, 18), "Incorrect number of weiAmount");
      assert.equal(result.logs[0].args.tokens, Math.pow(10, 17) * parseInt(10 * 450 * 1.15 * 1), "Incorrect number of SCT tokens");
      // Fastforward 7 more days:
      return solidityTestUtil.evmIncreaseTime(7 * 24 * 60 * 60);
    }).then(function() {
      // PreSale Phase 4:
      return soma.sendTransaction({ from: accounts[4], value: web3.toWei(1, "ether") });
    }).then(function(result) {
      assert.equal(result.logs.length, 1, "No event emited");
      assert.equal(result.logs[0].event, "Buy", "Buy event was not emited");
      assert.equal(result.logs[0].args.recipient, accounts[4], "Incorrect recipient");
      assert.equal(result.logs[0].args.weiAmount, 1 * Math.pow(10, 18), "Incorrect number of weiAmount");
      assert.equal(result.logs[0].args.tokens, Math.pow(10, 17) * parseInt(10 * 450 * 1.10 * 1), "Incorrect number of SCT tokens");
      // Fastforward 7 more days:
      return solidityTestUtil.evmIncreaseTime(7 * 24 * 60 * 60);
      }).then(function() {
      // PreSale Phase 5:
      return soma.sendTransaction({ from: accounts[5], value: web3.toWei(1, "ether") });
    }).then(function(result) {
      assert.equal(result.logs.length, 1, "No event emited");
      assert.equal(result.logs[0].event, "Buy", "Buy event was not emited");
      assert.equal(result.logs[0].args.recipient, accounts[5], "Incorrect recipient");
      assert.equal(result.logs[0].args.weiAmount, 1 * Math.pow(10, 18), "Incorrect number of weiAmount");
      assert.equal(result.logs[0].args.tokens, Math.pow(10, 17) * parseInt(10 * 450 * 1.05 * 1), "Incorrect number of SCT tokens");
      // Fastforward 6 more days:
      return solidityTestUtil.evmIncreaseTime(6 * 24 * 60 * 60);
      }).then(function() {
      // PreSale Phase 6:
      return soma.sendTransaction({ from: accounts[6], value: web3.toWei(1, "ether") });
    }).then(function(result) {
      assert.equal(result.logs.length, 1, "No event emited");
      assert.equal(result.logs[0].event, "Buy", "Buy event was not emited");
      assert.equal(result.logs[0].args.recipient, accounts[6], "Incorrect recipient");
      assert.equal(result.logs[0].args.weiAmount, 1 * Math.pow(10, 18), "Incorrect number of weiAmount");
      assert.equal(result.logs[0].args.tokens, parseInt(Math.pow(10, 18) * 450 * 1.05 * 1), "Incorrect number of SCT tokens");
    }).then(function(result) {
      return soma.totalSupply();
    }).then(function(totalSupply) {
      // divided by Math.pow(10, 5) to still be within JS int scope:
      assert.equal(totalSupply.div(Math.pow(10, 5)), parseInt(Math.pow(10, 13) * 450 *
        (1.25 + 1.20 + 1.15 + 1.10 + 1.05 + 1.05)), "Incorrect totalSupply");
      return soma.totalRaised();
    }).then(function(totalRaised) {
      assert.equal(totalRaised, (6) * Math.pow(10, 18), "Incorrect totalRaised");
    }).then(done, done);
  });

  it("should calculate proper bonuses also if PreSale phase finishes quickly and ICO starts within PreSale period (1)", function(done) {
    var currentBlockTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    var soma;
    SomaIco.new(accounts[0], currentBlockTimeStamp - 90, accounts[6], 2 * Math.pow(10, 18), 3 * Math.pow(10, 18), 5 * Math.pow(10, 18), {from: accounts[0]}).then(function(instance) {
      soma = instance;
      // PreSale Phase 1:
      return soma.sendTransaction({ from: accounts[1], value: web3.toWei(3, "ether") });
    }).then(function(result) {
      assert.equal(result.logs.length, 1, "No event emited");
      assert.equal(result.logs[0].event, "Buy", "Buy event was not emited");
      assert.equal(result.logs[0].args.recipient, accounts[1], "Incorrect recipient");
      assert.equal(result.logs[0].args.weiAmount, 3 * Math.pow(10, 18), "Incorrect number of weiAmount");
      assert.equal(result.logs[0].args.tokens.div(Math.pow(10, 5)), parseInt(Math.pow(10, 13) * 450 * 1.25 * 3), "Incorrect number of SCT tokens");
      // Fastforward 2 moredays:
      return solidityTestUtil.evmIncreaseTime(2 * 24 * 60 * 60);
    }).then(function() {
      // set ICO dates to overlap with already maxed preSale period:
      var icoStartTimeStamp = currentBlockTimeStamp + 1 * 24 * 60 * 60;
      var icoEndTimeStamp = icoStartTimeStamp + 5 * 24 * 60 * 60;
      return soma.setIcoDates(icoStartTimeStamp, icoEndTimeStamp, {from: accounts[0]});
    }).then(function() {
      return soma.sendTransaction({ from: accounts[2], value: web3.toWei(1, "ether") });
    }).then(function(result) {
      assert.equal(result.logs.length, 1, "No event emited");
      assert.equal(result.logs[0].event, "Buy", "Buy event was not emited");
      assert.equal(result.logs[0].args.recipient, accounts[2], "Incorrect recipient");
      assert.equal(result.logs[0].args.weiAmount, 1 * Math.pow(10, 18), "Incorrect number of weiAmount");
      assert.equal(result.logs[0].args.tokens.div(Math.pow(10, 5)), parseInt(Math.pow(10, 13) * 450 * 1 * 1), "Incorrect number of SCT tokens");
    }).then(function(result) {
      return soma.totalSupply();
    }).then(function(totalSupply) {
      // divided by Math.pow(10, 5) to still be within JS int scope:
      assert.equal(totalSupply.div(Math.pow(10, 5)), parseInt(Math.pow(10, 13) * 450 *
        (3 * 1.25 + 1)), "Incorrect totalSupply");
      return soma.totalRaised();
    }).then(function(totalRaised) {
      assert.equal(totalRaised, (4) * Math.pow(10, 18), "Incorrect totalRaised");
    }).then(done, done);
  });

  it("should calculate proper bonuses also if PreSale phase finishes quickly and ICO starts within PreSale period (2)", function(done) {
    var currentBlockTimeStamp = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
    var soma;
    SomaIco.new(accounts[0], currentBlockTimeStamp - 90, accounts[6], 2 * Math.pow(10, 18), 3 * Math.pow(10, 18), 5 * Math.pow(10, 18), {from: accounts[0]}).then(function(instance) {
      soma = instance;
      // PreSale Phase 1:
      return soma.sendTransaction({ from: accounts[1], value: web3.toWei(2, "ether") });
    }).then(function(result) {
      assert.equal(result.logs.length, 1, "No event emited");
      assert.equal(result.logs[0].event, "Buy", "Buy event was not emited");
      assert.equal(result.logs[0].args.recipient, accounts[1], "Incorrect recipient");
      assert.equal(result.logs[0].args.weiAmount, 2 * Math.pow(10, 18), "Incorrect number of weiAmount");
      assert.equal(result.logs[0].args.tokens.div(Math.pow(10, 5)), parseInt(Math.pow(10, 13) * 450 * 1.25 * 2), "Incorrect number of SCT tokens");
      // Fastforward 2 moredays:
      return solidityTestUtil.evmIncreaseTime(2 * 24 * 60 * 60);
    }).then(function() {
      // set ICO dates to overlap with already maxed preSale period:
      var icoStartTimeStamp = currentBlockTimeStamp + 1 * 24 * 60 * 60;
      var icoEndTimeStamp = icoStartTimeStamp + 5 * 24 * 60 * 60;
      return soma.setIcoDates(icoStartTimeStamp, icoEndTimeStamp, {from: accounts[0]});
    }).then(function() {
      return soma.sendTransaction({ from: accounts[2], value: web3.toWei(1, "ether") });
    }).then(function(result) {
      assert.equal(result.logs.length, 1, "No event emited");
      assert.equal(result.logs[0].event, "Buy", "Buy event was not emited");
      assert.equal(result.logs[0].args.recipient, accounts[2], "Incorrect recipient");
      assert.equal(result.logs[0].args.weiAmount, 1 * Math.pow(10, 18), "Incorrect number of weiAmount");
      assert.equal(result.logs[0].args.tokens.div(Math.pow(10, 5)), parseInt(Math.pow(10, 13) * 450 * 1 * 1), "Incorrect number of SCT tokens");
    }).then(function(result) {
      return soma.totalSupply();
    }).then(function(totalSupply) {
      // divided by Math.pow(10, 5) to still be within JS int scope:
      assert.equal(totalSupply.div(Math.pow(10, 5)), parseInt(Math.pow(10, 13) * 450 *
        (2 * 1.25 + 1)), "Incorrect totalSupply");
      return soma.totalRaised();
    }).then(function(totalRaised) {
      assert.equal(totalRaised, (3) * Math.pow(10, 18), "Incorrect totalRaised");
    }).then(done, done);
  });
  
});
