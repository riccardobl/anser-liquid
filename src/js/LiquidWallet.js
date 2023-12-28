import Alert from "./Alert.js";
import { ElectrumWS } from "ws-electrumx-client";
import Liquid, { address } from "liquidjs-lib";
import ZkpLib from "@vulpemventures/secp256k1-zkp";
import QrCode from "qrcode";
import AssetProvider from "./AssetProvider.js";
import VByteEstimator from "./VByteEstimator.js";
import Constants from "./Constants.js";
import SideSwap from "./SideSwap.js";
import Esplora from "./Esplora.js";
import { SLIP77Factory } from "slip77";
import BrowserStore from "./storage/BrowserStore.js";

/**
 * The full wallet Api.
 * Doesn't need an ui to work.
 *
 * NB: Every monetary value inputted and outputted in this class must be considered as an
 * integer according to the asset precision.
 * Only the v() method deals with float and strings and can be used to convert to and from the
 * more intuitive floating point representation.
 */

export default class LiquidWallet {
    constructor(electrumWs, esploraHttps, sideswapWs) {
        this.electrumWs = electrumWs;
        this.esploraHttps = esploraHttps;
        this.sideswapWs = sideswapWs;
        // initialize refresh callback list
        if (!this.refreshCallbacks) this.refreshCallbacks = [];
    }

    async start() {
        await this._reloadAccount();
        await this.refresh();
    }

    async exportApi(window) {
        await this.check();
        if (!window.liquid) {
            window.liquid = {};
        }
        window.liquid.receive = async (amount /*float*/, assetHash, qrOptions) => {
            if (!assetHash) assetHash = this.baseAsset;
            amount = await this.v(amount, assetHash).int(assetHash); //int
            return this.receive(amount, assetHash, qrOptions);
        };
        window.liquid.createTransaction = async (amount /*float*/, assetHash, toAddress) => {
            if (!assetHash) assetHash = this.baseAsset;
            amount = await this.v(amount, assetHash).int(assetHash); //int
            return this.prepareTransaction(amount, assetHash, toAddress);
        };
        window.liquid.send = async (amount /*float*/, assetHash, toAddress) => {
            const tr = window.liquid.createTransaction(amount, assetHash, toAddress);
            const txid = await tr.broadcast();
            return txid;
        };
    }

    /**
     * Check if an address is syntactically valid
     * @param {string} address
     */
    verifyAddress(address) {
        try {
            const buf = Liquid.address.toOutputScript(address, this.network);
            return buf.length > 0;
        } catch (e) {
            return false;
        }
    }

    async elcAction(action, params) {
        return this.elc.request(action, ...params);
    }

    async elcActions(batch) {
        return this.elc.batchRequest(batch);
    }

    getNetworkName() {
        return this.networkName;
    }

    getBaseAsset() {
        return this.baseAsset;
    }

    getBaseAssetInfo() {
        return this.baseAssetInfo;
    }

    // Called at startup and when the account changes
    async _reloadAccount() {
        await this.check();
        console.log("Reload");

        // deinitialize electrum client
        // if (this.elc) {
        //     this.elc.close();
        //     this.elc = undefined;
        // }

        console.log("Reloading account");
        // if there is a previous subscription: unsubscribe
        // if (this.scripthashEventSubscription) {
        //     this.elc.unsubscribe('blockchain.scripthash.subscribe', this.scripthashEventSubscription);
        // }

        // detect network for new account
        this.networkName = (await window.liquid.getAddress()).address.startsWith("tlq")
            ? "testnet"
            : "liquid";

        this.cache = await BrowserStore.best("cache:" + this.networkName + (await this.getAddress()).address);

        this.store = await BrowserStore.best(
            "store:" + this.networkName + (await this.getAddress()).address,
            0,
        );

        // load electrum and esplora endpoints
        // if they are provided in the constructor: use them
        // if they are functions: evaluate them with the network name
        // if they are unset: use the defaults
        let electrumWs = this.electrumWs;
        let esploraHttps = this.esploraHttps;
        let sideswapWs = this.sideswapWs;

        if (!electrumWs) {
            if (this.networkName === "testnet") {
                electrumWs = "wss://blockstream.info/liquidtestnet/electrum-websocket/api";
            } else {
                electrumWs = "wss://blockstream.info/liquid/electrum-websocket/api";
            }
        } else if (typeof electrumWs === "function") {
            electrumWs = electrumWs(this.networkName);
        }

        if (!esploraHttps) {
            if (this.networkName === "testnet") {
                esploraHttps = "https://blockstream.info/liquidtestnet/api/";
            } else {
                esploraHttps = "https://blockstream.info/liquid/api/";
            }
        } else if (typeof esploraHttps === "function") {
            esploraHttps = esploraHttps(this.networkName);
        }

        if (!sideswapWs) {
            if (this.networkName === "testnet") {
                sideswapWs = "wss://api-testnet.sideswap.io/json-rpc-ws";
            } else {
                sideswapWs = "wss://api.sideswap.io/json-rpc-ws";
            }
        } else if (typeof sideswapWs === "function") {
            sideswapWs = sideswapWs(this.networkName);
        }

        // get network object
        this.network = Liquid.networks[this.networkName];
        if (!this.network) throw new Error("Invalid network");

        // initialize electrum client
        this.elc = new ElectrumWS(electrumWs);

        // get base asset
        this.baseAsset = this.network.assetHash;

        // load exchange
        this.sideSwap = new SideSwap(this.cache, this.store, sideswapWs);

        this.esplora = new Esplora(this.cache, this.store, esploraHttps);

        // initialize asset registry
        this.assetProvider = new AssetProvider(
            this.cache,
            this.store,
            this.sideSwap,
            this.esplora,
            this.baseAsset,
            8,
            "L-BTC",
            "Bitcoin (Liquid)",
        );

        // get base asset info
        this.baseAssetInfo = await this.assetProvider.getAssetInfo(this.baseAsset);

        // subscribe to events
        const scriptHash = this.getElectrumScriptHash((await this.getAddress()).outputScript);
        this.scripthashEventSubscription = scriptHash;

        // listen for updates
        this.elc.subscribe(
            "blockchain.scripthash",
            (incomingScriptHash, state) => {
                if (scriptHash == incomingScriptHash) {
                    if (!this.lastState) this.lastState = state;
                    let newState = this.lastState != state;
                    if (newState) {
                        console.log("Received new state", state);
                        this.lastState = state;
                        this._executeRefreshCallbacks();
                    }
                } else {
                    console.log("Received event for another script hash", incomingScriptHash);
                }
            },
            scriptHash,
        );

        // print some info
        console.info(`!!! LiquidWallet initialized
        network: ${this.networkName}
        electrumWs: ${electrumWs}
        esploraHttps: ${esploraHttps}
        baseAsset: ${this.baseAsset}       
        baseAssetInfo: ${JSON.stringify(this.baseAssetInfo)}
        `);
    }

    // Called everytime there is a change that requires a wallet refresh
    _executeRefreshCallbacks() {
        this.refreshCallbacks.forEach((clb) => {
            clb();
        });
    }

    // Called when the wallet is destroyed
    async destroy() {
        if (window.liquid && window.liquid.isEnabled && (await window.liquid.isEnabled())) {
            if (window.liquid.on) {
                window.liquid.off("accountChanged", this._reloadAccount);
            }
            if (this.scripthashEventSubscription) {
                const method = "blockchain.scripthash.subscribe";
                this.elc.unsubscribe(method, this.scripthashEventSubscription);
                this.scripthashEventSubscription = undefined;
            }
        }
    }

    // Called everytime a method is called
    // Performs the initialization if needed
    async check() {
        if (typeof window.liquid === "undefined") {
            Alert.fatal("Liquid is not available.");
            return false;
        }
        if (typeof window.liquid.isEnabled === "undefined") {
            Alert.fatal("Liquid is not supported.");
            return false;
        }
        const enabled = await window.liquid.isEnabled();
        if (!enabled) {
            try {
                await window.liquid.enable();
                if (!(await window.liquid.isEnabled())) {
                    Alert.fatal("Liquid is not enabled.");
                    return false;
                } else {
                    if (!window.liquid.on) {
                        Alert.error("Callbacks not supported!");
                    } else {
                        window.liquid.on("accountChanged", this._reloadAccount);
                    }
                }
            } catch (err) {
                Alert.fatal(err);
                return false;
            }
        }
        if (!this.zkpLib) {
            this.zkpLib = await ZkpLib();
            this.zkpLibValidator = new Liquid.ZKPValidator(this.zkpLib);
            this.slip77 = new SLIP77Factory(this.zkpLib.ecc);
        }
    }

    async getAddress() {
        await this.check();
        const out = await window.liquid.getAddress();

        const network = this.network;
        const outputScript = Liquid.address.toOutputScript(out.address, network);
        const outScript = outputScript;
        const pubKey = Buffer.from(out.publicKey, "hex");

        return {
            outputScript: outScript,
            address: out.address,
            blindingPrivateKey: Buffer.from(out.blindingPrivateKey, "hex"),
            publicKey: pubKey,
        };
    }

    // amount is int
    async receive(amount, asset = null, qrOptions = {}) {
        await this.check();
        let address = await this.getAddress();
        if (!asset) {
            asset = this.baseAsset;
        }
        amount = await this.v(amount, asset).float(asset);
        address = address.address;
        if (amount < 0 || isNaN(amount) || amount === Infinity) amount = 0;

        let payLink = address;
        let hasParams = false;

        if (amount) {
            if (payLink.includes("?")) {
                payLink += "&";
            } else {
                payLink += "?";
            }
            payLink += "amount=" + amount;
            hasParams = true;
        }

        if (asset !== this.baseAsset || hasParams) {
            if (payLink.includes("?")) {
                payLink += "&";
            } else {
                payLink += "?";
            }
            payLink += "assetid=" + asset;
            hasParams = true;
        }

        if (hasParams) {
            const prefix = Constants.PAYURL_PREFIX[this.networkName];
            payLink = prefix + ":" + payLink;
        }

        if (!qrOptions.errorCorrectionLevel) qrOptions.errorCorrectionLevel = "M";
        if (!qrOptions.margin) qrOptions.margin = 1;
        if (!qrOptions.width) qrOptions.width = 1024;
        if (!qrOptions.color) qrOptions.color = {};
        if (!qrOptions.color.dark) qrOptions.color.dark = "#000000";
        if (!qrOptions.color.light) qrOptions.color.light = "#ffffff";

        const qrCode = await QrCode.toDataURL(payLink, qrOptions);
        return {
            addr: payLink,
            qr: qrCode,
        };
    }

    async addRefreshCallback(clb) {
        if (!this.refreshCallbacks.includes(clb)) {
            this.refreshCallbacks.push(clb);
        }
    }

    async removeRefreshCallback(clb) {
        if (this.refreshCallbacks.includes(clb)) {
            this.refreshCallbacks.splice(this.refreshCallbacks.indexOf(clb), 1);
        }
    }

    async refresh() {
        await this.check();
        this._executeRefreshCallbacks();
    }

    // async getBalance(){
    //     await this.check();
    //     const addr = await this.getAddress();
    //     const scripthash = addr.outputScript;
    //     const balance = await this.elc.request('blockchain.scripthash.get_balance', scripthash);
    //     return balance;
    // }

    getElectrumScriptHash(script) {
        return Liquid.crypto.sha256(script).reverse().toString("hex");
    }

    /**
     * Get the height in blocks of the blockchain
     * @param {number} tx_hash
     * @returns
     */
    async getTransactionHeight(tx_hash) {
        await this.check();
        const height = await this.store.get("tx:" + tx_hash + ":height");
        return height ? height : -1;
    }

    /**
     * Estimate the fee rate for a transaction
     * @param {number} priority  how fast you want the transaction to be confirmed, from 0 to 1 (1 means next block)
     * @returns
     */
    async estimateFeeRate(priority = 1) {
        await this.check();
        const fee = await this.esplora.getFee(priority);
        return fee;
    }

    /**
     * This is the most complex method of the wallet.
     * It prepares a confidential transaction to be broadcasted.
     * Remember: inputs are always integers
     * @param {number} amount input amount (int)
     * @param {string} asset asset hash
     * @param {string} toAddress destination address
     * @param {number} estimatedFeeVByte estimated fee rate in vbyte if unset, will get the best fee for 1 block confirmation (if possible)
     * @param {number} averageSizeVByte average transaction size in vbyte  is used to apr the initial coins collection for fees.
     */
    async prepareTransaction(amount, asset, toAddress, estimatedFeeVByte = null, averageSizeVByte = 2000) {
        await this.check();
        if (!this.verifyAddress(toAddress)) throw new Error("Invalid address");

        // if estimateFee is not set, we get the best fee for speed
        if (!estimatedFeeVByte) {
            estimatedFeeVByte = await this.estimateFeeRate(1);
            estimatedFeeVByte = estimatedFeeVByte.feeRate;
        }

        // If asset unset, we assume its the base asset (L-BTC)
        if (!asset) asset = this.baseAsset;

        // Fee asset is Always L-BTC
        const feeAsset = this.baseAsset;

        console.log(
            "Initialize preparations for transaction of amount",
            amount,
            "asset",
            asset,
            "to",
            toAddress,
            "estimatedFeeVByte",
            estimatedFeeVByte,
            "of asset",
            feeAsset,
            "averageSizeVByte",
            averageSizeVByte,
        );

        // Our address
        const address = await this.getAddress();

        // Check if the address supports confidential transactions
        const isConfidential = Liquid.address.isConfidential(toAddress);

        // Now lets grab all our properly resolved UTXOs
        const utxos = await this.getUTXOs();

        // We wrap the code to build the psed data into a function
        // since it has to be called twice (once to estimate the fee, once to build the actual transaction)
        const build = async (fee, size, withFeeOutput = false) => {
            const inputs = [];
            const outputs = [];

            const feeXsize = Math.floor(fee * size); // fee for the entire size of the transaction

            // how much we expect to collect in amount to send and in fees (nb if feeAsset==asset, we sum the fee to the amount and use a single input)
            const expectedCollectedAmount = feeAsset === asset ? amount + feeXsize : amount;
            const expectedFee = feeAsset === asset ? 0 : feeXsize;

            console.log(
                "Build a pset with fee",
                fee,
                "size",
                size,
                "expectedCollectedAmount",
                expectedCollectedAmount,
                "expectedFee",
                expectedFee,
            );

            let collectedAmount = 0;
            let collectedFee = 0;

            /////////// INPUTS
            ////// VALUE
            // Collect inputs
            for (const utxo of utxos) {
                if (utxo.ldata.assetHash !== asset) continue; // not an input for this asset!
                // first guard: something broken, better to throw an error and stop it here
                if (
                    !utxo.ldata.value ||
                    utxo.ldata.value <= 0 ||
                    isNaN(utxo.ldata.value) ||
                    Math.floor(utxo.ldata.value) != utxo.ldata.value
                )
                    throw new Error("Invalid UTXO");
                collectedAmount += utxo.ldata.value;
                inputs.push(utxo); // collect this input
                if (collectedAmount >= expectedCollectedAmount) break; // we have enough input
            }

            // not enough funds
            if (collectedAmount < expectedCollectedAmount) {
                throw new Error(
                    "Insufficient funds " +
                        collectedAmount +
                        " < " +
                        expectedCollectedAmount +
                        "(" +
                        amount +
                        "+" +
                        feeXsize +
                        ")",
                );
            }

            // Calculate change
            const changeAmount = collectedAmount - expectedCollectedAmount;
            if (changeAmount < 0 || Math.floor(changeAmount) != changeAmount) {
                // guard
                throw new Error("Invalid change amount " + changeAmount);
            }

            // Set change outputs
            if (changeAmount > 0) {
                const changeOutput = {
                    asset,
                    amount: changeAmount,
                    script: Liquid.address.toOutputScript(address.address),
                    blinderIndex: 0, // we have a single blinder
                    blindingPublicKey: Liquid.address.fromConfidential(address.address).blindingKey,
                };
                outputs.push(changeOutput);
            }

            ///// FEES
            // Collect fees inputs
            if (expectedFee > 0) {
                for (const utxo of utxos) {
                    if (utxo.ldata.assetHash !== feeAsset) continue; // not the fee asset
                    if (utxo.ldata.value <= 0) throw new Error("Invalid UTXO"); // guard
                    if (
                        !utxo.ldata.value ||
                        utxo.ldata.value <= 0 ||
                        isNaN(utxo.ldata.value) ||
                        Math.floor(utxo.ldata.value) != utxo.ldata.value
                    )
                        // guard
                        throw new Error("Invalid UTXO");
                    collectedFee += utxo.ldata.value;
                    inputs.push(utxo); // we collect this fee
                    if (collectedFee >= expectedFee) break; // enough fee
                }

                if (collectedFee < expectedFee) {
                    throw new Error("Insufficient funds for fees " + collectedFee + " < " + expectedFee);
                }

                // Calculate change
                const changeFee = collectedFee - expectedFee;
                if (changeFee < 0 || Math.floor(changeFee) != changeFee) {
                    // guard
                    throw new Error("Invalid fee change  " + changeFee);
                }

                // Set changes
                if (changeFee > 0) {
                    const changeFeeOutput = {
                        asset: feeAsset,
                        amount: changeFee,
                        script: Liquid.address.toOutputScript(address.address),
                        blinderIndex: 0, // only us as blinder
                        blindingPublicKey: Liquid.address.fromConfidential(address.address).blindingKey,
                    };
                    outputs.push(changeFeeOutput);
                }
            }

            /////// OUTPUTS
            // Set primary output
            outputs.push({
                asset,
                amount,
                script: Liquid.address.toOutputScript(toAddress), // this is the destination address
                blinderIndex: isConfidential ? 0 : undefined, // only one blinder if any
                blindingPublicKey: isConfidential
                    ? Liquid.address.fromConfidential(toAddress).blindingKey // blinded to the destination
                    : undefined,
            });

            // Set fee output
            if (withFeeOutput) {
                outputs.push({
                    asset: feeAsset,
                    amount: feeXsize,
                });
            }

            return [inputs, outputs, feeXsize];
        };

        // take an input and prepares it for the pset
        const processInput = (utxo) => {
            return {
                txid: utxo.tx_hash,
                txIndex: utxo.tx_pos,
                explicitAsset: Liquid.AssetHash.fromBytes(utxo.ldata.asset).bytes,
                explicitAssetProof: utxo.rangeProof,
                explicitValue: utxo.ldata.value,
                explicitValueProof: utxo.surjectionProof,
                witnessUtxo: {
                    script: utxo.script,
                    value: utxo.value,
                    asset: utxo.asset,
                    nonce: utxo.nonce,
                    rangeProof: utxo.rangeProof,
                    surjectionProof: utxo.surjectionProof,
                },
                sighashType: Liquid.Transaction.SIGHASH_DEFAULT,
            };
        };

        // create a pset from inputs and outputs
        const newPset = (inputs, outputs) => {
            let pset = Liquid.Creator.newPset();
            let psetUpdater = new Liquid.Updater(pset);
            psetUpdater.addInputs(inputs.map(processInput));
            psetUpdater.addOutputs(outputs);
            return [pset, psetUpdater];
        };

        let inputs;
        let outputs;
        let pset;
        let psetUpdater;
        let totalFee;

        // first pset to calculate the fee
        [inputs, outputs, totalFee] = await build(estimatedFeeVByte, averageSizeVByte, false);
        [pset, psetUpdater] = newPset(inputs, outputs);

        // estimate the fee
        const estimatedSize = VByteEstimator.estimateVirtualSize(pset, true);

        // real pset
        [inputs, outputs, totalFee] = await build(estimatedFeeVByte, estimatedSize, true);
        [pset, psetUpdater] = newPset(inputs, outputs);

        // print some useful info
        console.info(`Preparing transaction
        estimated fee VByte: ${estimatedFeeVByte}
        estimated size: ${estimatedSize}
        estimated total fee: ${totalFee}
        inputs:${JSON.stringify(inputs)}
        outputs: ${JSON.stringify(outputs)}
        fee: ${totalFee}
        `);

        // Now the fun part, we verify if the transaction is constructed properly
        // and if it makes sense.
        // Better safe than sorry

        // GUARD
        const asserts = [];

        {
            // decode transaction
            let totalIn = 0;
            let totalOut = 0;
            let fees = 0;

            for (const input of pset.inputs) {
                totalIn += input.explicitValue;
            }

            for (const output of pset.outputs) {
                const isFee = output.script.length === 0;
                console.log(output);
                if (isFee) {
                    fees += output.value;
                } else {
                    totalOut += output.value;
                }
            }

            if (totalOut + fees !== totalIn) {
                // We don't have the same amount of input and output
                throw new Error("Invalid transaction " + (totalOut + fees) + " " + totalIn);
            } else {
                console.log("Total in", totalIn);
                console.log("Total out", totalOut);
                asserts.push("Total in = total out");
            }

            if (fees > totalOut) {
                // we have more fees than outputs (likely an error...)
                throw new Error("Fees too high compared to output " + fees);
            } else {
                asserts.push("Fees are lower than outputs");
            }

            if (fees > Constants.FEE_GUARD) {
                //  Fees are higher than the hardcoded value. This catches user mistakes
                throw new Error("Fees too high compared to guard " + fees);
            } else {
                asserts.push("Fees are lower than guard value");
            }

            console.log("Verification OK: fees", fees, "totalOut+fee", totalOut + fees, "totalIn", totalIn);
        }

        // Prepare zkp
        const ownedInputs = inputs.map((input, i) => {
            return {
                index: i,
                value: input.ldata.value,
                valueBlindingFactor: input.ldata.valueBlindingFactor,
                asset: input.ldata.asset,
                assetBlindingFactor: input.ldata.assetBlindingFactor,
            };
        });

        const outputIndexes = [];
        for (const [index, output] of pset.outputs.entries()) {
            if (output.blindingPubkey && output.blinderIndex) {
                outputIndexes.push(index);
            }
        }

        const inputIndexes = ownedInputs.map((input) => input.index);
        let isLast = true;
        for (const out of pset.outputs) {
            if (out.isFullyBlinded()) continue;
            if (out.needsBlinding() && out.blinderIndex) {
                if (!inputIndexes.includes(out.blinderIndex)) {
                    isLast = false;
                    break;
                }
            }
        }

        const zkpLib = this.zkpLib;
        const zkpLibValidator = this.zkpLibValidator;

        const zkpGenerator = new Liquid.ZKPGenerator(
            zkpLib,
            Liquid.ZKPGenerator.WithOwnedInputs(ownedInputs),
        );

        const outputBlindingArgs = zkpGenerator.blindOutputs(
            pset,
            Liquid.Pset.ECCKeysGenerator(zkpLib.ecc),
            outputIndexes,
        );

        const blinder = new Liquid.Blinder(pset, ownedInputs, zkpLibValidator, zkpGenerator);

        if (isLast) {
            blinder.blindLast({ outputBlindingArgs });
        } else {
            blinder.blindNonLast({ outputBlindingArgs });
        }

        pset = blinder.pset;
        psetUpdater = new Liquid.Updater(pset);

        const walletScript = address.outputScript;
        const xOnlyPubKey = address.publicKey.subarray(1);

        for (const [index, input] of pset.inputs.entries()) {
            if (!input.witnessUtxo) continue;
            const script = input.witnessUtxo.script;
            if (script.equals(walletScript)) {
                psetUpdater.addInTapInternalKey(index, xOnlyPubKey);
            }
        }

        const outtx = {
            dest: toAddress,
            fee: totalFee,
            asserts: asserts,
            amount: amount,
            _compiledTx: undefined,
            _verified: false,
            _txData: undefined,
            compile: async () => {
                if (outtx._compiledTx) return outtx._compiledTx;
                let signedPset = await window.liquid.signPset(psetUpdater.pset.toBase64());
                if (!signedPset || !signedPset.signed) {
                    throw new Error("Failed to sign transaction");
                }
                signedPset = signedPset.signed;
                const signed = Liquid.Pset.fromBase64(signedPset);
                const finalizer = new Liquid.Finalizer(signed);
                finalizer.finalize();

                const hex = Liquid.Extractor.extract(finalizer.pset).toHex();
                outtx._compiledTx = hex;
                return hex;
            },
            verify: async () => {
                if (outtx._verified) return true;
                // now the even funnier part, we verify the transaction as if we were the receiver
                // and we check if everything is in order
                // get and unblind
                if (!outtx._txData) {
                    const hex = await outtx.compile();
                    const txBuffer = Buffer.from(hex, "hex");
                    outtx._txData = await this.getTransaction(undefined, txBuffer);
                }
                const txData = outtx._txData;
                if (!txData.info.valid) throw new Error("Invalid transaction");
                if (txData.info.isIncoming || !txData.info.isOutgoing)
                    throw new Error(
                        "Transaction direction is wrong " +
                            txData.info.isIncoming +
                            "!=" +
                            txData.info.isOutgoing,
                    );
                if (txData.info.outAmount !== amount)
                    throw new Error("Transaction amount is wrong " + txData.info.outAmount + "!=" + amount);
                if (txData.info.outAsset !== asset)
                    throw new Error("Transaction asset is wrong " + txData.info.outAsset + "!=" + asset);
                if (txData.info.feeAmount !== totalFee)
                    throw new Error("Transaction fee is wrong " + txData.info.feeAmount + "!=" + totalFee);

                if (txData.info.feeAsset !== feeAsset)
                    throw new Error(
                        "Transaction fee asset is wrong " + txData.info.feeAsset + "!=" + feeAsset,
                    );
                outtx._verified = true;
                return outtx;
            },

            broadcast: async () => {
                const hex = await outtx.compile();
                await outtx.verify();
                const txid = await this.elcAction("blockchain.transaction.broadcast", [hex]);
                return txid;
            },
        };
        return outtx;
    }

    /**
     * Plain and simple, input a tx hash and get the txData buffer (cached internally)
     * @param {string} tx_hash
     * @returns
     */
    async getTransactionBuffer(tx_hash) {
        let txBuffer = await this.cache.get("txbf:" + tx_hash);
        if (!txBuffer) {
            const txHex = await this.elcAction("blockchain.transaction.get", [tx_hash, false]);
            txBuffer = Buffer.from(txHex, "hex");
        }

        // const height = await this.getTransactionHeight(tx_hash);
        // const confirmed=height>-1;

        // if (confirmed) {
        await this.cache.set("txbf:" + tx_hash, txBuffer); // we always cache the buffer for ever
        // } else {
        //     await this.cache.set("txbf:" + tx_hash, txBuffer, 60 * 1000);
        // }

        return txBuffer;
    }

    /**
     * infers some metadata from the transaction
     * @param {*} txData
     */
    async getTransactionInfo(txData) {
        const addr = await this.getAddress();

        const tx_hash = txData.tx_hash;

        // Due to the confidential nature of liquid tx, we have a bazillion of checks to do
        // and pieces to  connect together to get all the information we need.
        // for this reason we always cache.

        // Check if we already have the metadata
        let info = tx_hash ? await this.cache.get(`tx:${tx_hash}:info`) : undefined;

        if (!info) {
            // no metadata, we need to compute it
            info = {};

            try {
                // First we check if we own at least one input
                let ownedInput = false;
                for (const inp of txData.ins) {
                    if (!inp.ldata) continue; // no ldata means not unblindable, we can't possibly own this input...
                    if (inp.owner.equals(addr.outputScript)) {
                        // It seems we can read this input, so we check if we actually own it
                        ownedInput = true;
                        break;
                    }
                }

                if (ownedInput) {
                    // if there is at least one owned input, likely the transaction is coming from us
                    info.isOutgoing = true;
                    info.isIncoming = false;
                } else {
                    // if not, we are likely receiving it
                    info.isOutgoing = false;
                    info.isIncoming = true;
                }

                info.feeAsset = this.baseAsset; // fee asset is always base asset
                info.feeAmount = 0;

                if (info.isOutgoing) {
                    // unfortunately we can't simply read the blinded outputs, but
                    // we can infer them by summing our inputs and subtracting the output change if preset
                    // and the fee

                    const outXasset = {};
                    // const outDestXasset = {};
                    const changeXasset = {};
                    // lets start by collecting the change for each output asset
                    // and the fee
                    for (const out of txData.outs) {
                        if (out.fee) {
                            // this is a special fee output, we handle it specially
                            if (!changeXasset[out.fee.assetHash]) changeXasset[out.fee.assetHash] = 0;
                            changeXasset[out.fee.assetHash] += out.fee.value;
                            info.feeAmount += out.fee.value;
                            continue;
                        }
                        if (!out.ldata) continue; // ldata is not available, this can't possibly be a change out, so skip
                        if (out.owner.equals(addr.outputScript)) {
                            // seems we can read it, so we check if the output is coming back to us
                            const hash = out.ldata.assetHash;
                            if (!changeXasset[hash]) changeXasset[hash] = 0;
                            changeXasset[hash] += out.ldata.value;
                            // outDestXasset[hash] = out.owner;
                        }
                    }

                    // Now lets collect the input amount
                    for (const inp of txData.ins) {
                        if (!inp.ldata) {
                            console.error("Blinded input of outgoing tx ?? UNEXPECTED");
                            continue; // somehow this input can't be unblinded, so we skip it.
                        }
                        if (inp.owner.equals(addr.outputScript)) {
                            // we check if we own the input (is this really needed?)
                            const hash = inp.ldata.assetHash;
                            if (!outXasset[hash]) outXasset[hash] = 0;
                            outXasset[hash] += inp.ldata.value;
                            // outDestXasset[hash] = out.owner;
                        }
                    }

                    // Good, now we must subtract the change and fee from the input and we shall have the real spent amount
                    for (let k in outXasset) {
                        if (!outXasset[k]) outXasset[k] = 0;
                        else {
                            if (!changeXasset[k]) changeXasset[k] = 0;
                            outXasset[k] -= changeXasset[k];
                        }
                    }

                    // delete empty assets
                    for (let k in outXasset) {
                        if (outXasset[k] <= 0) delete outXasset[k];
                    }

                    // We don't support multiasset transactions
                    if (Object.keys(outXasset).length > 1) {
                        console.error("Multiasset transaction ?? UNEXPECTED", outXasset);
                        throw new Error("Multiasset transaction not supported");
                    }

                    // lets grab the only asset we are outputting
                    const out = Object.entries(outXasset)[0];

                    // We didn't manage to parse the tx or it was invalid
                    if (!out) {
                        console.error("Invalid transaction ?? UNEXPECTED", outXasset);
                        throw new Error("Invalid transaction");
                    }

                    // const outOwner = outDestXasset[out[0]];

                    // if(!outOwner){
                    //     console.error("Invalid output owner ?? UNEXPECTED", outXasset, outDestXasset,out)
                    //     throw new Error("Invalid output owner");
                    // }

                    // Great we have the output!
                    info.outAsset = out[0];
                    info.outAmount = out[1];
                    info.toAddress = "confidential";
                } else {
                    // The incoming transaction is much easier to parse, we just need to check the outputs since we own them
                    const inXAsset = {};
                    for (const out of txData.outs) {
                        if (out.fee) {
                            // this is a special fee output, we handle it specially
                            info.feeAmount += out.fee.value;
                            continue;
                        }
                        if (!out.ldata) continue; // ldata is not available, this can't possibly be an owned output, likely a change output, so skip
                        if (out.owner.equals(addr.outputScript)) {
                            // check if we own the output
                            const hash = out.ldata.assetHash;
                            if (!inXAsset[hash]) inXAsset[hash] = 0;
                            inXAsset[hash] += out.ldata.value;
                        }
                    }

                    // We don't support multiasset transactions
                    // TODO: maybe we need to handle self transactions here?
                    if (Object.keys(inXAsset).length > 1) {
                        console.error("Multiasset transaction ?? UNEXPECTED", inXAsset);
                        throw new Error("Multiasset transaction not supported");
                    }

                    const inp = Object.entries(inXAsset)[0];
                    info.outAsset = inp[0];
                    info.outAmount = inp[1];
                    info.toAddress = address.address;
                }

                // TODO: Are self transactions parsed correctly?

                // Good finally if we have an input or an output, we consider the tx valid.
                if (info.outAsset) info.valid = true;
                else info.valid = false;
                // info.valid = !!(info.inAsset || info.outAsset);
            } catch (e) {
                console.error("Error while parsing transaction", txData, e);
                // we won't throw, but we will mark the tx as invalid
                info.valid = false;
                if (!info.debug) {
                    info.debug = [];
                }
                info.debug.push(e);
            }
            // And cache
            if (tx_hash) this.cache.set(`tx:${tx_hash}:info`, info);
        }

        return info;
    }

    /**
     * Returns a fully unblinded transaction.
     * Both inputs and outputs are resolved by piecing together the historic data, however unowned inputs and outputs
     * that have never been seen before cannot be unblinded obviously.
     * Unblinded inputs and outputs have an extra ldata value containing all the clear data.
     * Inputs and outputs without ldata should just be skipped since they are unusable.
     *
     * @param {string} tx_hash
     * @param {Buffer} providedTxBuffer this is a special parameter we can pass if we want to resolve a transaction that is not in our history yet
     * @returns
     */
    async getTransaction(tx_hash, providedTxBuffer = undefined) {
        await this.check();

        // Get the raw buffer of the transaction
        const txBuffer = providedTxBuffer ? providedTxBuffer : await this.getTransactionBuffer(tx_hash);

        // Deserialize it to a liquidjs-lib transaction
        const txData = Liquid.Transaction.fromBuffer(txBuffer);

        // We add some extra useful metadata
        txData.tx_hash = tx_hash;
        txData.height = tx_hash ? (await this.getTransactionHeight(tx_hash)) || -1 : -1; // if the tx is in our history, we know the height, otherwise we consider it unconfirmed (height=-1)
        txData.confirmed = txData.height > 0; // if height > 0, the tx is confirmed

        // get the wallet address
        const addr = await this.getAddress();

        // Since unblinding inputs and outputs is very slow, we want to cache them.
        // However the txData is not serializable and all the transaction information is actually
        // already serialized efficiently in txBuffer, for this reason we cache only the resolved ins and outs separately
        // instead of dumping the whole txData in a json mess.

        // Load caches
        const cachedOuts = tx_hash ? await this.cache.get(`tx:${tx_hash}:outs`) : undefined;
        const cachedIns = tx_hash ? await this.cache.get(`tx:${tx_hash}:ins`) : undefined;

        // We are out of luck, we need to unblind the inputs and outputs
        if (!cachedOuts || !cachedIns) {
            // console.log("Resolving", txData);
            // We just launch the unblinding of everything and wait
            await Promise.all([
                await Promise.all(txData.outs.map((out) => this._unblindOutput(addr, out, txData))),
                await Promise.all(txData.ins.map((inp) => this._unblindInput(addr, inp, txData))),
            ]);

            // once unblinded, we cache the results
            if (tx_hash) {
                await this.cache.set(`tx:${tx_hash}:outs`, txData.outs);
                await this.cache.set(`tx:${tx_hash}:ins`, txData.ins);
            }
        } else {
            // Data is cached, we can skip the unblinding
            txData.outs = cachedOuts;
            txData.ins = cachedIns;
        }

        // We parse the txData to infer the meatadata
        txData.info = await this.getTransactionInfo(txData);

        // Some extra info from the esplora api.
        // TODO: this will be progressively removed and inferred locally
        if (tx_hash) {
            txData.extraInfo = this.esplora.getTxInfo(tx_hash);
            txData.extraInfo.blockTime = async () => {
                if (!txData.extraInfo) return undefined;
                return (await txData.extraInfo).status.block_time;
            };
        }
        // it was a long journey, but we are finally here
        return txData;
    }

    async _unblindInput(address, input, txData) {
        try {
            if (input.ldata) return input; // so this input is already unblinded, we just return it
            // An input doesn't carry enough information to be unblinded, we need to fetch the original transaction
            // and then gets the data of when it was an utxo.
            const originTxId = input.hash.reverse().toString("hex");
            const originOutId = input.index;
            const originBuffer = await this.getTransactionBuffer(originTxId);
            // we don't call getTransactionInfo or we will end up in an infinite recursion.
            // not a problem since caching is handled elsewhere and this method should never be called
            // from outside (see the discouraging _ prefix)
            const originTx = Liquid.Transaction.fromBuffer(originBuffer);
            const originOut = originTx.outs[originOutId];
            // Now we can unblind it as if it was an output
            await this._unblindOutput(address, originOut, originTx);
            // and set the data back to the input
            input.ldata = originOut.ldata;
            input.owner = originOut.owner;
        } catch (e) {
            if (!input.debug) input.debug = [];
            input.debug.push(e);
            // console.log("Input discarded", input, e, txData); // well it seems this wasn't the input we are looking for...
        }
    }

    async _unblindOutput(address, out, txData) {
        try {
            if (out.ldata) return out; // so this output is already unblinded, we just return it
            if (out.script.length === 0) {
                // it doesn't have a script-> it's a fee output
                out.fee = {
                    // we use this special field to mark it as a fee output and hold the data
                    asset: Liquid.AssetHash.fromBytes(out.asset).bytesWithoutPrefix,
                    value: Liquid.confidential.confidentialValueToSatoshi(out.value),
                    assetHash: Liquid.AssetHash.fromBytes(out.asset).hex,
                };
                out.owner = Buffer.alloc(0); // no owner
                return out;
            }

            function bufferNotEmptyOrNull(buffer) {
                return buffer != null && buffer.length > 0;
            }

            function isConfidentialOutput({ rangeProof, surjectionProof, nonce }) {
                const emptyNonce = Buffer.from("0x00", "hex");
                return (
                    bufferNotEmptyOrNull(rangeProof) &&
                    bufferNotEmptyOrNull(surjectionProof) &&
                    nonce !== emptyNonce
                );
            }

            out.owner = out.script;

            // const elementsValue = Liquid.ElementsValue.fromBytes(out.value);
            const isConfidential = isConfidentialOutput(out);
            if (!isConfidential) {
                // if not confidential, we just pretend we unblinded it
                out.ldata = {
                    assetBlindingFactor: Buffer.alloc(32).fill(0),
                    valueBlindingFactor: Buffer.alloc(32).fill(0),
                    asset: Liquid.AssetHash.fromBytes(out.asset).bytesWithoutPrefix,
                    value: Liquid.confidential.confidentialValueToSatoshi(out.value),
                };
            } else {
                // unblinding!
                const blindPrivKey = address.blindingPrivateKey;

                if (!blindPrivKey) {
                    throw new Error("Blinding private key error for script " + output.script.toString("hex"));
                }

                const zkpLib = this.zkpLib;
                const zkpGenerator = new Liquid.ZKPGenerator(
                    zkpLib,
                    Liquid.ZKPGenerator.WithBlindingKeysOfInputs([blindPrivKey]),
                );

                out.ldata = await zkpGenerator.unblindUtxo(out);
                out.ldata.value = parseInt(out.ldata.value.toString(), 10);
                // console.log("Unblinded", out);
            }

            out.ldata.assetHash = Liquid.AssetHash.fromBytes(out.ldata.asset).hex;
        } catch (e) {
            if (!out.debug) out.debug = [];
            out.debug.push(e);
            // console.log("Output discarded",out,e);
        }
        return out;
    }

    /**
     * Get the history of both confirmed and unconfirmed transactions
     * @returns
     */
    async getHistory() {
        await this.check();
        const addr = await this.getAddress();
        const scripthash = this.getElectrumScriptHash(addr.outputScript); // scriphash used for api calls

        // If the history is cached we return it, otherwise we fetch it from the api
        // nb the way the cache is used here, allows us to return stale data while the api refreshes.
        const transactions = await this.cache.get("hs:" + scripthash, false, async () => {
            const history = await this.elcAction("blockchain.scripthash.get_history", [scripthash]);
            const transactions = [];
            for (const tx of history) {
                transactions.push({
                    tx_hash: tx.tx_hash,
                    height: tx.height,
                    confirmed: tx.height > 0,
                });
            }
            // We store (not cache) the tx height that is otherwise very expensive to fetch on demand.
            await Promise.all(
                transactions.map((tx) => {
                    if (tx.height > 0) {
                        return this.store.set("tx:" + tx.tx_hash + ":height", tx.height);
                    } else {
                        return Promise.resolve(); // we don't cache pending txs, since their height will change later...
                    }
                }),
            );
            return [transactions, 5000]; // the cache is considered stale after 5 seconds
        });
        return transactions.reverse();
    }

    /**
     * Get unspent outputs
     * @returns
     */
    async getUTXOs() {
        await this.check();

        const addr = await this.getAddress();
        const scripthash = this.getElectrumScriptHash(addr.outputScript); // the scripthash used for api calls

        const utxos = await this.elcAction("blockchain.scripthash.listunspent", [scripthash]); // list the utxos

        const transactions = {}; // cache txs to speedup resolution
        let outputs = [];
        for (const utxo of utxos) {
            try {
                const txid = utxo.tx_hash;
                // get the tx of this utxo
                const transaction = transactions[txid]
                    ? transactions[txid]
                    : await this.getTransaction(utxo.tx_hash); // nb this also unblinds it

                // get the output
                const out = transaction.outs[utxo.tx_pos];

                // if it doesn't have a script, it is probably fee, we skip it
                if (out.script.length === 0) continue; // fee out

                // NB. the output was already unblinded when fetching the tx
                if (!out.ldata) continue; // somehow unblinding failed, likely we don't own this output or the tx is invalid, skip

                // we are not the owner of this output, skip (this is needed because unconfidential outputs are not skipped by the previous check)
                if (!out.owner.equals(addr.outputScript)) continue;

                // we add some metadata to the utxo to reference its tx for later
                out.tx_pos = utxo.tx_pos;
                out.tx_hash = utxo.tx_hash;

                outputs.push(out);
            } catch (err) {
                console.error("Failed to resolve", utxo, err);
            }
        }
        return outputs;
    }

    async getBalance(filter) {
        await this.check();

        const balanceXasset = {};

        // sum all valid utxos
        const utxos = await this.getUTXOs();
        for (const utxo of utxos) {
            if (filter) {
                if (!filter(utxo.ldata.assetHash)) continue;
            }
            const asset = utxo.ldata.assetHash;
            if (!balanceXasset[asset])
                balanceXasset[asset] = {
                    info: undefined,
                    value: 0,
                    hash: asset,
                    asset: asset,
                };
            balanceXasset[asset].value += utxo.ldata.value;
        }

        // create 0 balance for pinned assets if not present
        const pinnedAssets = await this.getPinnedAssets();
        for (const asset of pinnedAssets) {
            const hash = asset.hash;
            if (filter) {
                if (!filter(hash)) continue;
            }
            if (!balanceXasset[hash]) {
                balanceXasset[hash] = {};
                for (const key in asset) {
                    balanceXasset[hash][key] = asset[key];
                }
                balanceXasset[hash].value = 0;
                balanceXasset[hash].asset = hash;
                balanceXasset[hash].hash = hash;
            }
        }

        // return array of balances
        const balance = [];
        for (const asset in balanceXasset) {
            const assetData = balanceXasset[asset];
            balance.push(assetData);
        }

        return balance;
    }

    /**
     * Pin an assets, price will be tracked and balance always available even if 0
     * @param {string} assetHash
     */
    async pinAsset(assetHash) {
        await this.check();
        this.assetProvider.track(assetHash);
    }

    /**
     * Unpin an asset, if balance == 0, it will not be tracked anymore
     * @param {string} assetHash
     */
    async unpinAsset(assetHash) {
        await this.check();
        this.assetProvider.untrack(assetHash);
    }

    /**
     * Get a list of all the pinned assets
     * @returns
     */
    async getPinnedAssets() {
        await this.check();
        return this.assetProvider.getTrackedAssets(false);
    }

    /**
     * Get all the available assets. Includes unholdable assets, eg. fiat used only for pricing data
     * @returns
     */
    async getAvailableCurrencies(includeFiat = true) {
        await this.check();
        return this.assetProvider.getAllAssets(includeFiat);
    }

    /**
     * Api to convert amounts between assets and types
     * @param {number} inAmount  the in amount (floating point when using int(), otherwise integer)
     * @param {string} assetHash
     * @returns
     */
    v(inAmount, assetHash) {
        if (typeof inAmount != "number") throw new Error("Invalid amount " + inAmount);
        if (!assetHash || typeof assetHash != "string") throw new Error("Invalid asset " + assetHash);

        return {
            /**
             * Returns the price of an int amount in the target asset in a way an human would write it
             * @param {string} targetAssetHash  if unset means to use the base asset
             * @returns
             */
            human: async (targetAssetHash) => {
                await this.check();
                if (!targetAssetHash) targetAssetHash = assetHash;

                let amount = inAmount;
                amount = await this.assetProvider.getPrice(amount, assetHash, targetAssetHash);
                amount = await this.assetProvider.intToFloat(amount, targetAssetHash);

                amount = await this.assetProvider.floatToStringValue(amount, targetAssetHash);
                return amount;
            },

            /**
             * Returns the price of an int amount in the target asset as a floating point number
             * @param {number} targetAssetHash if unset means to use the base asset
             * @returns
             */
            float: async (targetAssetHash) => {
                await this.check();
                if (!targetAssetHash) targetAssetHash = assetHash;
                let amount = inAmount;
                amount = await this.assetProvider.getPrice(amount, assetHash, targetAssetHash);
                amount = await this.assetProvider.intToFloat(amount, targetAssetHash);
                return amount;
            },
            /**
             * Returns the price of a floating point amount in the target asset as an integer
             * @param {*} targetAssetHash if unset means to use the base asset
             * @returns
             */
            int: async (targetAssetHash) => {
                await this.check();
                if (!targetAssetHash) targetAssetHash = assetHash;
                let amount = inAmount;
                amount = await this.assetProvider.floatToInt(amount, assetHash);
                amount = await this.assetProvider.getPrice(amount, assetHash, targetAssetHash);
                return amount;
            },
        };
    }

    assets() {
        return this.assetProvider;
    }

    async clearCache() {
        await this.cache.clear();
    }
}
