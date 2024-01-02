# Anser API Documentation

## window.liquid

### wallet

Returns an instance of LiquidWallet.

```javascript
/**
* Return an instance of LiquidWallet
* @returns {Promise<LiquidWallet>} the wallet instance
*/
window.liquid.wallet(): Promise<LiquidWallet>
```

### receive

Generates a payment URL and QR code to receive a payment.

```javascript
/**
* Generate a payment url and QR code to receive a payment
* @param {number} amount  Hint the amount to receive as floating point number (eg. 0.001) 0 = any (N.B. this is just a hint, the sender can send any amount)
* @param {string} assetHash Asset hash of the asset to receive (NB. this is just a hint, the sender can send any asset). Leave empty for any asset or L-BTC.
* @returns {Promise<{url: string, qr: string}>} A promise that resolves to an object with a payment url and a qr code image url
*/
window.liquid.receive(amount: number, assetHash: string, qrOptions: any): Promise<{url: string, qr: string}>
```

### send

Sends an amount to an address.

```javascript
/**
* Send an amount to an address
* @param {number} amount The amount to send as floating point number (eg. 0.001)
* @param {string} assetHash  Asset hash of the asset to send.
* @param {string} toAddress  The address to send to
* @param {number} fee  The fee in sats per vbyte to use. 0 or empty = auto
* @returns {Promise<string>} The txid of the transaction
*/
window.liquid.send(amount: number, assetHash: string, toAddress: string, fee: number): Promise<string>
```

### estimateFee

Estimates the fee for a transaction.

```javascript
/**
* Estimate the fee for a transaction
* @param {number} priority 0 = low, 1 = high
* @returns {Promise<{feeRate: string, blocks: number}>} The fee in sats per vbyte to pay and the number of blocks that will take to confirm
*/
window.liquid.estimateFee(priority: number): Promise<{feeRate: string, blocks: number}>
```

### balance

Gets the balance of each owned asset.

```javascript
/**
* Get the balance of each owned asset
* @returns {Promise<[{asset: string, value: number}]>} An array of objects with asset and value
*/
window.liquid.balance(): Promise<[{asset: string, value: number}]>
```

### isAnser

A boolean that is true if Anser is loaded.

```javascript
window.liquid.isAnser: boolean
```

### networkName

Returns a string representing the network name (e.g., "liquid", "testnet").

```javascript
/**
* Returns the network name (eg. "liquid", "testnet"...)
* @returns {Promise<string>} the network name
*/
window.liquid.networkName(): Promise<string>
```

### BTC

Returns a string representing the hash for L-BTC.

```javascript
/**
* Returns the hash for L-BTC
* @returns  {Promise<string>} the asset hash
*/
window.liquid.BTC(): Promise<string>
```

### assetInfo

Returns info for the given asset.

```javascript
/**
* Returns info for the given asset
* @param {string} assetHash asset hash
* @returns {Promise<{name: string, ticker: string, precision: number, hash:string}>} The info for this asset
*/
window.liquid.assetInfo(assetHash: string): Promise<{name: string, ticker: string, precision: number, hash:string}>
```

### assetIcon

Gets the icon for the given asset.

```javascript
/**
* Get the icon for the given asset
* @param {string} assetHash  the asset
* @returns {Promise<string>} the url to the icon
*/
window.liquid.assetIcon(assetHash: string): Promise<string>
```

## Examples

Examples are available at [CodePen](https://codepen.io/collection/aMPjgB).
