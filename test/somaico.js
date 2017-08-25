/* global artifacts, contract, it, assert */
/* eslint no-return-assign: 0 */

const SomaIco = artifacts.require('./SomaIco.sol');
const {
  transaction,
  ethBalance,
  toWei,
  fail,
  assertExpectedError,
  assertTransferEvent,
  timeController,
} = require('./testutils');


// constants
const oneEther = toWei(1);
const oneHour = 3600; // in seconds

contract('SomaIco', (accounts) => {
  // default parameters
  const ethMinCap = 8000;
  const ethMaxCap = 120000;
  const sctEthRate = 450;

  // test account addresses
  const creator = accounts[0];
  const owner = accounts[1];
  const wallet = accounts[2];
  const liquidity = accounts[3];
  const marketing = accounts[4];
  const buyerOne = accounts[5];

  // utilities
  const expectedMarketingPool = weiMaxCap => ((weiMaxCap || toWei(ethMaxCap)) * sctEthRate) / 9;
  const expectedTotalSupply = weiMaxCap =>
    ((weiMaxCap || toWei(ethMaxCap)) * sctEthRate)
    + expectedMarketingPool(weiMaxCap);

  const fromOwner = {
    from: owner,
  };
  const fromCreator = {
    from: creator,
  };

  // contract creators
  const defaultParams = () => {
    const icoStartTimestamp = timeController.currentTimestamp();
    const icoEndTimestamp = icoStartTimestamp + oneHour;
    return {
      minCap: toWei(ethMinCap),
      maxCap: toWei(ethMaxCap),
      icoStartTimestamp,
      icoEndTimestamp,
      totalPresaleRaised: 0,
    };
  };

  const applyDefaults = params => Object.assign({}, defaultParams(), params);

  const createContract = (params) => {
    const {
      minCap,
      maxCap,
      totalPresaleRaised,
    } = applyDefaults(params);

    let soma;
    return SomaIco.new(
      wallet,
      marketing,
      liquidity,
      minCap,
      maxCap,
      totalPresaleRaised,
      fromCreator,
    )
      .then(instance => (soma = instance))
      .then(() => soma.transferOwnership(owner, fromCreator)) // done by factory
      .then(() => soma);
  };

  const createStartedIco = (params) => {
    const {
      icoStartTimestamp,
      icoEndTimestamp,
    } = applyDefaults(params);

    let soma;
    return createContract(params)
      .then(instance => (soma = instance))
      .then(() => soma.setIcoDates(icoStartTimestamp, icoEndTimestamp, fromOwner))
      .then(() => soma);
  };

  it('should not be halted when created', () =>
    createContract()
      .then(soma => soma.halted())
      .then(isHalted => assert(!isHalted, 'should not be halted at start')),
  );

  it('should be halted and then unhalted', () => {
    let soma;
    return createContract()
      .then(instance => (soma = instance))
      .then(() => soma.haltFundraising(fromOwner))
      .then(() => soma.halted())
      .then(isHalted => assert(isHalted, 'should be halted'))
      .then(() => soma.unhaltFundraising(fromOwner))
      .then(() => soma.halted())
      .then(isHalted => assert(!isHalted, 'should be unhalted'));
  });

  it('should be properly created', () => {
    const totalPresaleRaised = 100 * oneEther;
    let soma;
    return createContract({ totalPresaleRaised })
      .then(instance => (soma = instance))
      .then(() => soma.totalSupply())
      .then(totalSupply => assert.equal(totalSupply.toNumber(), toWei(60000000), 'incorrect totalSupply'))
      .then(() => soma.paused())
      .then(paused => assert(paused, 'should be paused'))
      .then(() => soma.wallet())
      .then(actualWallet => assert.equal(actualWallet, wallet, 'incorrect wallet'))
      .then(() => soma.owner())
      .then(actualOwner => assert.equal(actualOwner, owner, 'incorrect owner'))
      .then(() => soma.totalRaised())
      .then(totalRaised => assert.equal(totalRaised, totalPresaleRaised, 'totalRaised should equal totalPresaleRaised'));
  });

  it('should handle setIcoDates properly', () => {
    let soma;
    return createContract()
      .then(instance => (soma = instance))
      .then(() => soma.icoStartTimestamp())
      .then(icoStartTimestamp => assert.equal(icoStartTimestamp, 0, '0 == icoStartTimestamp expected'))
      .then(() => soma.icoEndTimestamp())
      .then(icoEndTimestamp => assert.equal(icoEndTimestamp, 0, '0 == icoEndTimestamp expected'))
      .then(() => soma.setIcoDates(1000000, 2000000, fromOwner))
      .then(() => soma.icoStartTimestamp())
      .then(icoStartTimestamp => assert.equal(icoStartTimestamp, 1000000, '1000000 == icoStartTimestamp expected'))
      .then(() => soma.icoEndTimestamp())
      .then(icoEndTimestamp => assert.equal(icoEndTimestamp, 2000000, '2000000 == icoEndTimestamp expected'))
      .then(() => soma.setIcoDates(2000000, 3000000, fromOwner))
      .then(() => soma.icoStartTimestamp())
      .then(icoStartTimestamp => assert.equal(icoStartTimestamp, 2000000, '2000000 == icoStartTimestamp expected'))
      .then(() => soma.icoEndTimestamp())
      .then(icoEndTimestamp => assert.equal(icoEndTimestamp, 3000000, '3000000 == icoEndTimestamp expected'));
  });

  it('should convert 1 ETH to 450 SCT', () => {
    const walletInitBalance = ethBalance(wallet);
    let soma;

    return createStartedIco()
      .then(instance => (soma = instance))
      .then(() => soma.sendTransaction(transaction(buyerOne, oneEther)))
      .then(assertTransferEvent(buyerOne, oneEther * sctEthRate))
      .then(() => soma.balanceOf(buyerOne))
      .then(balanceOf => assert.equal(balanceOf, toWei(sctEthRate), 'incorrect token balance after transfer'))
      .then(() => soma.totalRaised())
      .then(totalRaised => assert.equal(totalRaised.toNumber(), oneEther, 'incorrect totalRaised after transfer'))
      .then(() => soma.tokensSold())
      .then(tokensSold => assert.equal(tokensSold.toNumber(), expectedMarketingPool() + toWei(sctEthRate), 'incorrect tokens sold amount'))
      .then(() => {
        assert.equal(ethBalance(soma.address), 0, 'contract balance should be zero at all times');
        assert.equal(ethBalance(wallet), oneEther + walletInitBalance, 'wallet balance should have increased by 1 ETH');
      });
  });

  it('should fail as ICO did not start yet', () => {
    // ICO starts in an hour from now
    let soma;

    const icoStartTimestamp = timeController.currentTimestamp() + oneHour;
    return createStartedIco({
      icoStartTimestamp,
      icoEndTimestamp: icoStartTimestamp + oneHour,
    })
      .then(instance => (soma = instance))
      .then(() => soma.isIcoFinished())
      .then(finished => assert.isFalse(finished, 'ICO should not be finished as it did not start yet'))
      .then(() => soma.sendTransaction(transaction(buyerOne, oneEther)))
      .then(fail('should fail as ICO did not start yet'))
      .catch(assertExpectedError);
  });

  it('should fail as it\'s halted', () => {
    let soma;

    return createStartedIco()
      .then(instance => (soma = instance))
      .then(() => soma.haltFundraising(fromOwner))
      .then(() => soma.sendTransaction(transaction(buyerOne, oneEther)))
      .then(fail('should fail - contract halted'))
      .catch(assertExpectedError);
  });

  it('should NOT fail as it\'s unhalted', () => {
    let soma;

    return createStartedIco()
      .then(instance => (soma = instance))
      .then(() => soma.sendTransaction(transaction(buyerOne, oneEther)))
      .catch(fail('should not fail - contract unhalted'));
  });

  it('should fail as it\'s zero ETH transfer', () => {
    let soma;

    return createStartedIco()
      .then(instance => (soma = instance))
      .then(() => soma.sendTransaction(transaction(buyerOne, 0)))
      .then(fail('should fail - zero ETH transfer'))
      .catch(assertExpectedError);
  });

  it('should fail when min target for ICO is reached and time runs out', () => {
    const minCap = 2 * oneEther;
    const maxCap = 3 * oneEther;
    let soma;

    return createStartedIco({
      minCap,
      maxCap,
    })
      .then(instance => (soma = instance))
      // sending 2 ETH to fulfill min target
      .then(() => soma.sendTransaction(transaction(buyerOne, minCap)))
      // fast forward one hour (the ICO duration)
      .then(() => timeController.addSeconds(oneHour))
      // sending 1 wei more, should fail this time:
      .then(() => soma.sendTransaction(transaction(buyerOne, 1)))
      .then(fail('should fail - ICO should be closed after reaching minCap and ICO ends'))
      .catch(assertExpectedError)
      .then(() => soma.totalRaised())
      .then(totalRaised => assert.equal(totalRaised.toNumber(), minCap, 'totalRaised should be 2 ETH'))
      .then(() => soma.tokensSold())
      .then(tokensSold => assert.equal(tokensSold.toNumber(), expectedMarketingPool(maxCap) + toWei(2 * sctEthRate), 'incorrect tokens sold amount'))
      .then(() => soma.totalSupply())
      .then(totalSupply => assert.equal(totalSupply.toNumber(), expectedTotalSupply(maxCap), 'incorrect totalSupply'));
  });

  it('should fail when min target for ICO is reached after the time runs out', () => {
    const minCap = 2 * oneEther;
    const maxCap = 3 * oneEther;
    let soma;

    return createStartedIco({
      minCap,
      maxCap,
    })
      .then(instance => (soma = instance))
      // fast forward one hour (the ICO duration)
      .then(() => timeController.addSeconds(oneHour))
      // sending 2 ETH to fulfill min target (should still be accepted)
      .then(() => soma.sendTransaction(transaction(buyerOne, minCap)))
      // sending 1 wei more, should fail this time:
      .then(() => soma.sendTransaction(transaction(buyerOne, 1)))
      .then(fail('should fail - ICO should be closed after reaching minCap after the ICO ends'))
      .catch(assertExpectedError)
      .then(() => soma.totalRaised())
      .then(totalRaised => assert.equal(totalRaised.toNumber(), minCap, 'totalRaised should be 2 ETH'))
      .then(() => soma.tokensSold())
      .then(tokensSold => assert.equal(tokensSold.toNumber(), expectedMarketingPool(maxCap) + toWei(2 * sctEthRate), 'incorrect tokens sold amount'))
      .then(() => soma.totalSupply())
      .then(totalSupply => assert.equal(totalSupply.toNumber(), expectedTotalSupply(maxCap), 'incorrect totalSupply'));
  });

  it('should fail when max target for ICO is reached in ICO phase', () => {
    const minCap = 2 * oneEther;
    const maxCap = 3 * oneEther;
    let soma;

    return createStartedIco({
      minCap,
      maxCap,
    })
      .then(instance => (soma = instance))
      // sending 3 ETH to exhaust max target
      .then(() => soma.sendTransaction(transaction(buyerOne, 3 * oneEther)))
      // sending 1 wei more, should fail this time:
      .then(() => soma.sendTransaction(transaction(buyerOne, 1)))
      .then(fail('should fail - ICO should be closed after reaching maxCap'))
      .catch(assertExpectedError)
      .then(() => soma.totalRaised())
      .then(totalRaised => assert.equal(totalRaised.toNumber(), 3 * oneEther, 'totalRaised should be 3 ETH'))
      .then(() => soma.tokensSold())
      .then(tokensSold => assert.equal(tokensSold.toNumber(), expectedMarketingPool(maxCap) + toWei(3 * sctEthRate), 'incorrect tokens sold amount'))
      .then(() => soma.totalSupply())
      .then(totalSupply => assert.equal(totalSupply.toNumber(), expectedTotalSupply(maxCap), 'incorrect totalSupply'));
  });

  it('should reserve 6m SCT for marketing', () => {
    let soma;
    return createContract()
      .then(instance => (soma = instance))
      .then(() => soma.balanceOf(marketing))
      .then(balanceOf => assert.equal(balanceOf.toNumber(), expectedMarketingPool(), 'incorrect marketing balance'))
      .then(() => soma.tokensSold())
      .then(tokensSold => assert.equal(tokensSold.toNumber(), expectedMarketingPool(), 'incorrect tokens sold amount'));
  });

  it('should not assign unsold tokens during lock-out period', () => {
    let soma;

    return createStartedIco()
      .then(instance => (soma = instance))
      .then(() => soma.prepareLiquidityReserve())
      .then(fail('should fail - ICO did not complete yet'))
      .catch(assertExpectedError)
      // fast forward till the end of the ICO
      .then(() => timeController.addSeconds(oneHour))
      .then(() => soma.prepareLiquidityReserve())
      .then(fail('should fail - ICO still did not complete yet'))
      .catch(assertExpectedError);
  });

  it('should assign unsold tokens to liquidity reserve', () => {
    const minCap = 1 * oneEther;
    const maxCap = 3 * oneEther;
    const payment = 2 * oneEther;
    const expectedTokensSold = expectedMarketingPool(maxCap) + (payment * sctEthRate);
    const liquidityReserveTokens = expectedTokensSold / 10;
    let soma;

    return createStartedIco({
      minCap,
      maxCap,
    })
      .then(instance => (soma = instance))
      .then(() => soma.sendTransaction(transaction(buyerOne, payment)))
      // fast forward till the end of the ICO:
      .then(() => timeController.addSeconds(2 * oneHour))

      // send any tx to  have block mined and increase block time (it will fail, but that's fine):
      .then(() => soma.sendTransaction(transaction(buyerOne, 0)))
      .catch(assertExpectedError)

      .then(() => soma.isIcoFinished())
      .then(finished => assert.isTrue(finished, 'ICO should be finished'))

      .then(() => soma.prepareLiquidityReserve(fromOwner))
      .then(assertTransferEvent(liquidity, liquidityReserveTokens))


      .then(() => soma.balanceOf(liquidity))
      .then(balanceOf => assert.equal(balanceOf.toNumber(), liquidityReserveTokens, 'incorrect liquidity balance'))
      .then(() => soma.tokensSold())
      .then(tokensSold => assert.equal(tokensSold.toNumber(), liquidityReserveTokens + expectedTokensSold, 'incorrect tokens sold amount'))
      .then(() => soma.prepareLiquidityReserve())
      .catch(assertExpectedError)
    ;
  });

  it('should allow totalSupply to grow because of presale bonuses and going over the max cap', () => {
    const minCap = 2 * oneEther;
    const maxCap = 3 * oneEther;
    const buyerOnePresaleBonus = oneEther * sctEthRate * 0.25;
    const buyerOnePresaleTokens = (oneEther * sctEthRate) + buyerOnePresaleBonus;
    const startDate = timeController.currentTimestamp();
    const endDate = startDate + oneHour;
    let soma;

    return createContract({
      minCap,
      maxCap,
      totalPresaleRaised: oneEther,
    })
      .then(instance => (soma = instance))
      .then(() => soma.manuallyAssignTokens(buyerOne, buyerOnePresaleTokens, fromOwner))
      .then(() => soma.setIcoDates(startDate, endDate, fromOwner))
      // last payment going 1 ETH over the max cap
      .then(() => soma.sendTransaction(transaction(buyerOne, 3 * oneEther)))
      .then(() => soma.totalSupply())
      .then(totalSupply => assert.equal(totalSupply.toNumber(), expectedTotalSupply(maxCap) + (oneEther * sctEthRate) + buyerOnePresaleBonus, 'presale bonus shoul go over totalSupply'))
      .then(() => soma.totalRaised())
      .then(totalRaised => assert.equal(totalRaised.toNumber(), 4 * oneEther, 'totalRaised should be 4 ETH'))
      .then(() => soma.tokensSold())
      .then(tokensSold => assert.equal(tokensSold.toNumber(), expectedMarketingPool(maxCap) + toWei(4 * sctEthRate) + buyerOnePresaleBonus, 'incorrect tokens sold amount'));
  });

  it('should convert 1 ETH to 450 SCT and then burn 450 SCT', () => {
    const walletInitBalance = ethBalance(wallet);
    let soma;

    return createStartedIco()
      .then(instance => (soma = instance))
      .then(() => soma.sendTransaction(transaction(buyerOne, oneEther)))
      .then(assertTransferEvent(buyerOne, oneEther * sctEthRate))
      .then(() => soma.balanceOf(buyerOne))
      .then(balanceOf => assert.equal(balanceOf, toWei(sctEthRate), 'incorrect token balance after transfer'))
      .then(() => soma.totalRaised())
      .then(totalRaised => assert.equal(totalRaised.toNumber(), oneEther, 'incorrect totalRaised after transfer'))
      .then(() => soma.tokensSold())
      .then(tokensSold => assert.equal(tokensSold.toNumber(), expectedMarketingPool() + toWei(sctEthRate), 'incorrect tokens sold amount'))
      .then(() => soma.totalSupply())
      .then(totalSupply => assert.equal(totalSupply.toNumber(), expectedTotalSupply(), 'incorrect totalSupply'))
      .then(() => {
        assert.equal(ethBalance(soma.address), 0, 'contract balance should be zero at all times');
        assert.equal(ethBalance(wallet), oneEther + walletInitBalance, 'wallet balance should have increased by 1 ETH');
      })
      .then(() => soma.unpause(fromOwner))
      .then(() => soma.burn(toWei(sctEthRate), { from: buyerOne }))
      .then(() => soma.balanceOf(buyerOne))
      .then(balanceOf => assert.equal(balanceOf, toWei(0), 'incorrect token balance after burning'))
      .then(() => soma.totalSupply())
      .then(totalSupply => assert.equal(totalSupply.toNumber(), expectedTotalSupply() - toWei(sctEthRate), 'incorrect totalSupply after burning'))
      .then(() => soma.tokensSold())
      .then(tokensSold => assert.equal(tokensSold.toNumber(), expectedMarketingPool() + toWei(sctEthRate), 'incorrect tokens sold amount after burning'))
    ;
  });
});
