/* global web3, assert */

const transaction = (address, wei) => ({
  from: address,
  value: wei,
});

const ethBalance = address => web3.eth.getBalance(address).toNumber();

const toWei = number => number * (10 ** 18);

const fail = msg => error => assert(false, error && error.message ? `${msg}, but got error: ${error.message}` : msg);

const assertExpectedError = error => assert(error.message.indexOf('invalid opcode') >= 0, `Expected throw, but got: ${error.message}`);

const assertTransferEvent = (recipient, amount) => (result) => {
  assert.equal(result.logs.length, 1, 'No event emited');
  assert.equal(result.logs[0].event, 'Transfer', 'Transfer event was not emitted');
  assert.equal(result.logs[0].args.from, 0x0, 'Incorrect from');
  assert.equal(result.logs[0].args.to, recipient, 'Incorrect to');
  assert.equal(result.logs[0].args.value, amount, 'Incorrect token amount');
};

const timeController = (() => {
  const addSeconds = seconds => new Promise((resolve, reject) =>
    web3.currentProvider.sendAsync({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [seconds],
      id: new Date().getTime(),
    }, (error, result) => (error ? reject(error) : resolve(result.result))));

  const addDays = days => addSeconds(days * 24 * 60 * 60);

  const currentTimestamp = () => web3.eth.getBlock(web3.eth.blockNumber).timestamp;

  return {
    addSeconds,
    addDays,
    currentTimestamp,
  };
})();

module.exports = {
  transaction,
  ethBalance,
  toWei,
  fail,
  assertExpectedError,
  assertTransferEvent,
  timeController,
};
