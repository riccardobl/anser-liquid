# Anser API Documentation

## window.liquid

### wallet

Returns an instance of LiquidWallet.

```javascript
window.liquid.wallet(): Promise<LiquidWallet>
```

### getWallet (Deprecated)

Returns an instance of LiquidWallet.

```javascript
window.liquid.getWallet(): Promise<LiquidWallet>
```

### receive

Generates a payment URL and QR code to receive a payment.

```javascript
window.liquid.receive(amount: number, assetHash: string, qrOptions: any): Promise<{url: string, qr: string}>
```

### send

Sends an amount to an address.

```javascript
window.liquid.send(amount: number, assetHash: string, toAddress: string, fee: number): Promise<string>
```

### estimateFee

Estimates the fee for a transaction.

```javascript
window.liquid.estimateFee(priority: number): Promise<{feeRate: string, blocks: number}>
```

### balance

Gets the balance of each owned asset.

```javascript
window.liquid.balance(): Promise<[{asset: string, value: number}]>
```

### isAnser

Checks if Anser is loaded.

```javascript
window.liquid.isAnser: boolean
```

### isAnser (Deprecated)

Checks if Anser is loaded.

```javascript
window.liquid.isAnser(): Promise<boolean>
```

### getNetworkName (Deprecated)

Returns the network name (e.g., "liquid", "testnet").

```javascript
window.liquid.getNetworkName(): Promise<string>
```

### networkName

Returns the network name (e.g., "liquid", "testnet").

```javascript
window.liquid.networkName(): Promise<string>
```

### BTC

Returns the hash for L-BTC.

```javascript
window.liquid.BTC(): Promise<string>
```

### assetInfo

Returns info for the given asset.

```javascript
window.liquid.assetInfo(assetHash: string): Promise<{name: string, ticker: string, precision: number, hash:string}>
```

### assetIcon

Gets the icon for the given asset.

```javascript
window.liquid.assetIcon(assetHash: string): Promise<string>
```
