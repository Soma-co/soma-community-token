# soma-community-token
## Soma Community Token (SCT)

Ethereum-based token for soma.co platform.

More details at [soma.co](http://soma.co/).

## Prerequisites

[Truffle](http://truffleframework.com/) and [testrpc](https://github.com/ethereumjs/testrpc).
Versions `truffle@3.2.93` and `ethereumjs-testrpc@3.9.2` as of July 2017:

	npm install -g truffle@beta ethereumjs-testrpc@beta

## Building

	truffle compile

## Testing

	# first run testrpc in the background, e.g.:
	nohup testrpc > testrpc.log &

	# then run the tests
	truffle test