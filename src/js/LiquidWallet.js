import Alert from './Alert.js';
import { ElectrumWS } from 'ws-electrumx-client';
import Liquid from 'liquidjs-lib';
import ZkpLib from '@vulpemventures/secp256k1-zkp';
import QrCode from 'qrcode';
import AssetProvider from './AssetProvider.js';
import VByteEstimator from './VByteEstimator.js';
import Constants from './Constants.js';
import SideSwap from './SideSwap.js';
import Esplora from './Esplora.js';
import { SLIP77Factory } from 'slip77';
import BrowserStore from './storage/BrowserStore.js';

export default class LiquidProvider {
    constructor(electrumWs, esploraHttps, sideswapWs) {
        this.electrumWs = electrumWs;
        this.esploraHttps = esploraHttps;     
        this.sideswapWs = sideswapWs;
        // initialize refresh callback list
        if (!this.refreshCallbacks) this.refreshCallbacks = [];
    }

    async start(){
        await this._reloadAccount();
        await this.refresh();
    }

    async exportApi(window){
        await this.check();
        if(!window.liquid){
            window.liquid={};
        }
        window.liquid.receive=async (amount/*float*/, assetHash,qrOptions)=>{
            if(!assetHash) assetHash=this.baseAsset;
            amount = await this.v(amount,assetHash).int(assetHash);//int
            return this.receive(amount, assetHash, qrOptions);
        }
        window.liquid.createTransaction=async (amount/*float*/, assetHash, toAddress)=>{
            if(!assetHash) assetHash=this.baseAsset;
            amount = await this.v(amount,assetHash).int(assetHash);//int
            return this.prepareTransaction(amount, assetHash, toAddress);
        }
        window.liquid.send=async (amount/*float*/, assetHash, toAddress)=>{
            const tr=window.liquid.createTransaction(amount, assetHash, toAddress);
            const txid=await tr.broadcast();
            return txid;
        }
    }

    async elcAction(action, params){
        console.log("elcAction",action,params);
        console.trace();
        return this.elc.request(action,...params);
    }

    async elcActions(batch){
        console.log("elcActions",batch);
        console.trace();
        return this.elc.batchRequest(batch);
    }

    getNetworkName(){
        return this.networkName;
    }
    
    getBaseAsset(){
        return this.baseAsset;
    }

    getBaseAssetInfo(){
        return this.baseAssetInfo;
    }

    // Called at startup and when the account changes
    async _reloadAccount(){
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
        this.networkName = (await window.liquid.getAddress()).address.startsWith("tlq") ? "testnet" : "liquid";

        this.cache=await BrowserStore.best("cache:"+this.networkName+(await this.getAddress()).address);

        this.store = await BrowserStore.best("store:"+this.networkName+(await this.getAddress()).address,0);

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
        }else if(typeof electrumWs === "function"){ 
            electrumWs = electrumWs(this.networkName);
        }

        if (!esploraHttps) {
            if (this.networkName === "testnet") {
                esploraHttps = "https://blockstream.info/liquidtestnet/api/";
            } else {
                esploraHttps = "https://blockstream.info/liquid/api/";
            }
        }else if(typeof esploraHttps === "function"){
            esploraHttps = esploraHttps(this.networkName);
        }

        if(!sideswapWs){
            if (this.networkName === "testnet") {
                sideswapWs = "wss://api-testnet.sideswap.io/json-rpc-ws";
            } else {
                sideswapWs = "wss://api.sideswap.io/json-rpc-ws";
            }
            
        }else if(typeof sideswapWs === "function"){
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
        this.sideSwap = new SideSwap(this.cache, this.store,sideswapWs);   
        
        this.esplora = new Esplora(this.cache, this.store,esploraHttps);

        // initialize asset registry
        this.assetProvider = new AssetProvider(
            this.cache,this.store,
            this.sideSwap,
            this.esplora,
            this.baseAsset,
            8,
            "L-BTC",
            "Bitcoin (Liquid)"
        );
  
        // get base asset info
        this.baseAssetInfo = await this.assetProvider.getAssetInfo(this.baseAsset);

    

        // subscribe to events
        const scriptHash = this.getElectrumScriptHash((await this.getAddress()).outputScript);       
        this.scripthashEventSubscription=scriptHash;
        // this.elc.subscribe('blockchain.scripthash.subscribe',function(incomingScriptHash,status){
        //     if (scriptHash===incomingScriptHash){
        //         this._executeRefreshCallbacks();
        //     }
        // }, scriptHash);


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
        if (window.liquid && window.liquid.isEnabled && await window.liquid.isEnabled()) {
            if (window.liquid.on) {
                window.liquid.off("accountChanged", this._reloadAccount);
            }
            if (this.scripthashEventSubscription) {
                const method = 'blockchain.scripthash.subscribe';
                this.elc.unsubscribe(method, this.scripthashEventSubscription);
                this.scripthashEventSubscription = undefined;
            }
        }
    }


    // Called everytime a method is called
    // Performs the initialization if needed
    async check() {
        if (typeof window.liquid === 'undefined') {
            Alert.fatal('Liquid is not available.');
            return false;
        }
        if (typeof window.liquid.isEnabled === 'undefined') {
            Alert.fatal('Liquid is not supported.');
            return false;
        }
        const enabled = await window.liquid.isEnabled();
        if (!enabled) {
            try {
                await window.liquid.enable();
                if (!await window.liquid.isEnabled()) {
                    Alert.fatal('Liquid is not enabled.');
                    return false;
                } else {
                    if (!window.liquid.on) {
                        Alert.error("Callbacks not supported!");
                    } else {
                        window.liquid.on("accountChanged", this._reloadAccount)
                        
                    }
                }
            } catch (err) {
                Alert.fatal(err);
                return false;
            }
        }
        if(!this.zkpLib){
            this.zkpLib = await ZkpLib();
            this.zkpLibValidator = new Liquid.ZKPValidator(this.zkpLib);
            this.slip77=new SLIP77Factory(this.zkpLib.ecc);
        }
    }



    async getAddress() {
        await this.check();
        const out= await window.liquid.getAddress();
       
        const network=this.network;
        const outputScript = Liquid.address.toOutputScript(out.address, network);
        const outScript = outputScript;
        const pubKey = Buffer.from(out.publicKey, 'hex');

        const confidentialAddress = Liquid.address.toConfidential(Liquid.address.fromOutputScript(outScript, network), pubKey);

        return {
            outputScript: outScript,
            address: out.address,
            blindingPrivateKey: Buffer.from(out.blindingPrivateKey, 'hex'),
            publicKey: pubKey,
            confidentialAddress: confidentialAddress
        }
    }


    // amount is int
    async receive(amount,   asset=null, qrOptions={}){
        await this.check();
        let address = await this.getAddress();
        if(!asset){
            asset=this.baseAsset;
        }

        amount=await this.assetProvider.intToFloat(amount,asset);
        // if(confidential){             
        //     address = address.confidentialAddress;
        // }else{
            address = address.address;
        // }
        if(amount<0||isNaN(amount)||amount===Infinity) amount=0;

        // TODO dinamic precision?
        amount = Number(amount.toFixed(10));

        let payLink = address;
        let hasParams=false;

        if(amount){
            if(payLink.includes("?")){  
                payLink+="&";
            }else{
                payLink+="?";
            }
            payLink+="amount="+amount;
            hasParams=true;
        }

        if (asset !== this.baseAsset || hasParams){
            if(payLink.includes("?")){
                payLink+="&";
            }else{
                payLink+="?";
            }
            payLink+="assetid="+asset;
            hasParams=true;
        }

        if(hasParams){
            payLink ="liquidnetwork:"+payLink;
        } 

        if(!qrOptions.errorCorrectionLevel) qrOptions.errorCorrectionLevel="M";
        if(!qrOptions.margin) qrOptions.margin=1;
        if(!qrOptions.width) qrOptions.width=1024;
        if(!qrOptions.color) qrOptions.color={}
        if(!qrOptions.color.dark) qrOptions.color.dark="#000000";
        if(!qrOptions.color.light) qrOptions.color.light="#ffffff";

        const qrCode=await QrCode.toDataURL(payLink,qrOptions);
        return {
            addr:payLink,
            qr:qrCode
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

    async refresh(){
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

    getElectrumScriptHash(script){
        return Liquid.crypto.sha256(script).reverse().toString('hex');
    }


    async getTxHeight(tx_hash){
        await this.check();
        const height=await this.store.get("tx:"+tx_hash+":height");
        return height?height:-1;
    }

    async getHistory(){
        await this.check();
        const addr=await this.getAddress();
        const scripthash = this.getElectrumScriptHash(addr.outputScript);

        const transactions =await this.cache.get("hs:"+scripthash, false,async ()=>{
            const history=[];
            history.push(...await this.elcAction('blockchain.scripthash.get_history', [scripthash]));
            // history.push(...await this.elcAction('blockchain.scripthash.get_mempool', scripthash));
            console.log("History", history);
            const transactions = [];

            for (const tx of history) {
                transactions.push({
                    tx_hash: tx.tx_hash,
                    height: tx.height,
                    confirmed: tx.height > 0
                });
                
            }
            await Promise.all(transactions.map(tx=>this.store.set("tx:"+tx.tx_hash+":height",tx.height)));
            return [transactions,60*1000];
            
        });

        

        return transactions.reverse();
    }


    async estimateFeeRate(priority=1){
        await this.check();
        const fee=await this.esplora.getFee(priority);
        return fee;
    }
   
    /* amount is int*/
    async prepareTransaction(amount, asset, toAddress, estimatedFeeVByte=null, averageSizeVByte=2000){
        await this.check();
        if (!estimatedFeeVByte){
            estimatedFeeVByte = (await this.esplora.getFee(1)).fee;
        }
        
        if (!asset) asset = this.baseAsset;
        const feeAsset = this.baseAsset;

        const address=await this.getAddress();       
        const isConfidential = Liquid.address.isConfidential(toAddress);


        const utxos = await this.getUTXOs();

        const buildTXIO=async (fee, size, withFeeOutput=false)=>{
            const inputs = [];
            const outputs = [];

            const feeXsize=Math.floor(fee*size);

            const expectedCollectedAmount = feeAsset === asset ? amount + feeXsize : amount;
            const expectedFee = feeAsset === asset ? 0 : feeXsize;

            let collectedAmount = 0;
            let collectedFee = 0;

        
            /////////// INPUTS
            ////// VALUE
            // Collect inputs
            for (const utxo of utxos) {
                if (utxo.ldata.assetHash !== asset) {
                    console.log("Skipping", utxo.ldata.asset, asset);
                    continue;
                }
                if (!utxo.ldata.value || utxo.ldata.value <= 0 || isNaN(utxo.ldata.value) || Math.floor(utxo.ldata.value) != utxo.ldata.value) throw new Error("Invalid UTXO");
                collectedAmount += utxo.ldata.value;
                inputs.push(utxo);
                if (collectedAmount >= expectedCollectedAmount) break;
            }

            if (collectedAmount < expectedCollectedAmount) {
                throw new Error("Insufficient funds " + collectedAmount + " < " + expectedCollectedAmount + "("+amount+"+"+feeXsize+")");
            }

            
            // Calculate change
            const changeAmount = collectedAmount - expectedCollectedAmount;
            if (changeAmount < 0 || Math.floor(changeAmount) != changeAmount) {
                throw new Error("Invalid change amount " + changeAmount );
            }

            // Set change outputs
            if (changeAmount > 0) {
                const changeOutput = {
                    asset,
                    amount: changeAmount,
                    script: Liquid.address.toOutputScript(address.address),
                    blinderIndex: 0,
                    blindingPublicKey: Liquid.address.fromConfidential(address.address).blindingKey
                };
                console.log("Change output", changeOutput)
                outputs.push(changeOutput);
            }


            ///// FEES
            // Collect fees inputs 
            if (expectedFee>0){
                for (const utxo of utxos) {
                    console.log(utxo.ldata.asset,feeAsset)
                    if (utxo.ldata.assetHash !== feeAsset) continue;
                    if (utxo.ldata.value <= 0) throw new Error("Invalid UTXO");
                    if (!utxo.ldata.value || utxo.ldata.value <= 0 || isNaN(utxo.ldata.value) || Math.floor(utxo.ldata.value) != utxo.ldata.value) throw new Error("Invalid UTXO");
                    collectedFee += utxo.ldata.value;
                    inputs.push(utxo);
                    if (collectedFee >= expectedFee) break;
                }
            

                if (collectedFee < expectedFee) {
                    throw new Error("Insufficient funds for fees " + collectedFee+ " < " + expectedFee);
                }

                // Calculate change
                const changeFee = collectedFee - expectedFee;
                if (changeFee < 0 || Math.floor(changeFee) != changeFee) {
                    throw new Error("Invalid fee change  " + changeFee );
                }

                // Set changes
                if (changeFee > 0) {
                    const changeFeeOutput = {
                        asset: feeAsset,
                        amount: changeFee,
                        script: Liquid.address.toOutputScript(address.address),
                        blinderIndex: 0,
                        blindingPublicKey: Liquid.address.fromConfidential(address.address).blindingKey,
                    };
                    console.log("Change output", changeFeeOutput)
                    outputs.push(changeFeeOutput);
                }

            }

            /////// OUTPUTS
            // Set primary output
            outputs.push({
                asset,
                amount,
                script: Liquid.address.toOutputScript(toAddress),
                blinderIndex: isConfidential ? 0 : undefined,
                blindingPublicKey: isConfidential
                    ? Liquid.address.fromConfidential(toAddress).blindingKey
                    : undefined,
            });

            // Set fee output
            if (withFeeOutput){
                outputs.push(
                    {
                        asset: feeAsset,
                        amount: feeXsize,
                    }
                );
            }

            return [inputs, outputs, feeXsize];
        }


        const processInput = utxo => {
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
                    surjectionProof: utxo.surjectionProof
                },
                sighashType: Liquid.Transaction.SIGHASH_DEFAULT,
            };
        };

        const newPset=(inputs,outputs)=>{
            let pset = Liquid.Creator.newPset();
            let psetUpdater = new Liquid.Updater(pset);
            psetUpdater.addInputs(inputs.map(processInput));
            psetUpdater.addOutputs(outputs);
            return [pset, psetUpdater];
        }

        let inputs;
        let outputs;
        let pset;
        let psetUpdater;
        let totalFee;


        [inputs, outputs, totalFee] = await buildTXIO(estimatedFeeVByte, averageSizeVByte, false);
        [pset, psetUpdater] = newPset(inputs, outputs);
               
        const estimatedSize = VByteEstimator.estimateVirtualSize(pset, true);
        [inputs, outputs, totalFee] = await buildTXIO(estimatedFeeVByte, estimatedSize, true);
        [pset, psetUpdater] = newPset(inputs, outputs);

        console.log("Estimated fee VByte", estimatedFeeVByte);
        console.log("Estimated size", estimatedSize);
        console.log("Estimated total fee", totalFee);

        console.info(`Preparing transaction
        inputs:${JSON.stringify(inputs)}
        outputs: ${JSON.stringify(outputs)}
        fee: ${totalFee}
        `);

     

       
        // Verify
        {
            // decode transaction
            let totalIn = 0;
            let totalOut = 0;
            let fees = 0;
            for (const input of pset.inputs) {
                totalIn += input.explicitValue;                
            }

            for (const output of pset.outputs) {
                console.log(output);
                const isFee = !output.blindingPubkey;
                if (isFee) {
                    fees += output.value;
                } else {
                    totalOut += output.value;
                }
            }

            if (totalOut + fees !== totalIn) {
                throw new Error("Invalid transaction " + (totalOut + fees) + " " + totalIn);
            } else {
                console.log("Total in", totalIn);
                console.log("Total out", totalOut);
            }

            if (fees > totalOut){
                throw new Error("Fees too high compared to output " + fees);
            }

            if(fees>Constants.FEE_GUARD){
                throw new Error("Fees too high compared to guard " + fees);
            }

            console.log("Verification OK: fees", fees, "totalOut+fee", (totalOut + fees), "totalIn", totalIn);
        }

        // Prepare zkp
        const ownedInputs = inputs.map((input, i) => {
            return {
                index: i,
                value: input.ldata.value,
                valueBlindingFactor: input.ldata.valueBlindingFactor,
                asset: input.ldata.asset,
                assetBlindingFactor: input.ldata.assetBlindingFactor
            }
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
            outputIndexes
        );

        

        const blinder = new Liquid.Blinder(
            pset,
            ownedInputs,
            zkpLibValidator,
            zkpGenerator
        );

        // blinder.blindLast({ outputBlindingArgs });
        if (isLast) {
            blinder.blindLast({ outputBlindingArgs });
        } else {
            blinder.blindNonLast({ outputBlindingArgs });
        }

        pset=blinder.pset;
        psetUpdater =new Liquid.Updater(pset);

        const walletScript = address.outputScript;
        const xOnlyPubKey =address.publicKey.subarray(1);

        for (const [index, input] of pset.inputs.entries()) {
            if (!input.witnessUtxo) continue;
            const script = input.witnessUtxo.script;
            if (script.equals(walletScript)) {
                psetUpdater.addInTapInternalKey(index, xOnlyPubKey);
            }
        }
        
      
        
        return {
            dest: toAddress,
            fee:totalFee,
            broadcast:async ()=>{
                let signedPset = await window.liquid.signPset(psetUpdater.pset.toBase64());
                if (!signedPset || !signedPset.signed) {
                    throw new Error("Failed to sign transaction");
                }
                signedPset = signedPset.signed;
                console.log(signedPset);
                const signed = Liquid.Pset.fromBase64(signedPset);
                const finalizer = new Liquid.Finalizer(signed);
                finalizer.finalize();

                const hex = Liquid.Extractor.extract(finalizer.pset).toHex();
                const txid = await this.elcAction('blockchain.transaction.broadcast',[ hex]);
                return txid;
            }
        }

    }


     
    async getTxBuffer(tx_hash){
        let txBuffer = await this.cache.get("txbf:" + tx_hash);
        if (!txBuffer) {
            const txHex = await this.elcAction('blockchain.transaction.get', [tx_hash, false]);
            txBuffer = Buffer.from(txHex, 'hex');
        }

        const height = await this.getTxHeight(tx_hash);
        const confirmed=height>-1;

        if (confirmed) {
            await this.cache.set("txbf:" + tx_hash, txBuffer);
        } else {
            await this.cache.set("txbf:" + tx_hash, txBuffer, 60 * 1000);
        }

        return txBuffer;

    }


    async getTxInfo(tx_hash, resolveOutputs =true, resolveInputs=true){
        await this.check();
        // let tx_hash = tx.tx_hash;
        // if(!tx_hash) throw new Error("Invalid tx");


        
        const txBuffer=await this.getTxBuffer(tx_hash);
        
        const txData = Liquid.Transaction.fromBuffer(txBuffer);

        txData.tx_hash=tx_hash;
        txData.height=await this.getTxHeight(tx_hash);
        txData.confirmed = txData.height>0;

        const addr = await this.getAddress();

        const cachedOuts=await this.cache.get(`tx:${tx_hash}:outs`,false);
        const cachedIns=await this.cache.get(`tx:${tx_hash}:ins`,false);
        console.log("Cached I/O", cachedOuts, cachedIns);
        // if (resolveOutputs){
        if(!cachedOuts||!cachedIns){
            console.log("Resolving", txData);
            await Promise.all([
                await Promise.all(txData.outs.map(out => this._resolveOutput(addr,out, txData))),
                await Promise.all(txData.ins.map(inp => this._resolveInput(addr, inp, txData)))
            ]);
            await this.cache.set(`tx:${tx_hash}:outs`, txData.outs);
            await this.cache.set(`tx:${tx_hash}:ins`, txData.ins);
        }else{
            txData.outs=cachedOuts;
            txData.ins=cachedIns;
        }


        let info = await this.cache.get(`tx:${tx_hash}:info`);
        if (!info) {
            info = {};

            // check if has an owned input
            let ownedInput = false;
            for (const inp of txData.ins) {
                if (inp.ldata && inp.owner.equals(addr.outputScript)) {
                    ownedInput = true;
                    break;
                }
            }

            if (ownedInput) {
                info.isOutgoing = true;
                info.isIncoming = false;
            } else {
                info.isOutgoing = false;
                info.isIncoming = true;
            }


            if (info.isOutgoing) {
                const outXasset = {};
                const changeXasset = {};
                for (const out of txData.outs) {
                    if (out.fee) {
                        if (!changeXasset[out.fee.assetHash]) changeXasset[out.fee.assetHash] = 0;
                        changeXasset[out.fee.assetHash] += out.fee.value;
                        continue;
                    }
                    if (!out.ldata) continue;
                    if (out.owner.equals(addr.outputScript)) {
                        const hash = out.ldata.assetHash;
                        if (!changeXasset[hash]) changeXasset[hash] = 0;
                        changeXasset[hash] += out.ldata.value;
                    }
                }

                for (const inp of txData.ins) {
                    if (!inp.ldata) continue;
                    if (inp.owner.equals(addr.outputScript)) {
                        const hash = inp.ldata.assetHash;
                        if (!outXasset[hash]) outXasset[hash] = 0;
                        outXasset[hash] += inp.ldata.value;
                    }
                }

                for (let k in outXasset) {
                    if (!outXasset[k]) outXasset[k] = 0;
                    else {
                        if (!changeXasset[k]) changeXasset[k] = 0;
                        outXasset[k] -= changeXasset[k];
                    }
                }

                const out = Object.entries(outXasset)[0];
                info.outAsset = out ? out[0] : undefined;
                info.outAmount = out ? out[1] : 0;
            } else {
                const inXAsset = {};
                for (const out of txData.outs) {
                    if (!out.ldata) continue;
                    if (out.owner.equals(addr.outputScript)) {
                        const hash = out.ldata.assetHash;
                        if (!inXAsset[hash]) inXAsset[hash] = 0;
                        inXAsset[hash] += out.ldata.value;
                    }
                }

                const inp = Object.entries(inXAsset)[0];
                info.inAsset = inp ? inp[0] : undefined;
                info.inAmount = inp ? inp[1] : 0;
            }




            // if (info.outAsset) {
            //     info.outAssetInfo = this.assetProvider.getAssetInfo(info.outAsset);
            //     info.outAssetIcon = this.assetProvider.getAssetIcon(info.outAsset);
            // }

            // if (info.inAsset) {
            //     info.inAssetInfo = this.assetProvider.getAssetInfo(info.inAsset);
            //     info.inAssetIcon = this.assetProvider.getAssetIcon(info.inAsset);
            // }

            info.valid = !!(info.inAsset || info.outAsset);
            console.log("Resolved?", info);
            console.log("Interpret i/o", info);

            this.cache.set(`tx:${tx_hash}:meta`, info);
        }
        txData.info = info;

       
        txData.extraInfo=this.esplora.getTxInfo(tx_hash);
        txData.extraInfo.blockTime=async ()=>{
            if(!txData.extraInfo) return undefined;
            return (await txData.extraInfo).status.block_time;
        };
       
     
       
    
        return txData;
    }


    async _resolveInput(address, input, txData){
        // console.log("Input ",input);
        // const scriptBuffer0=input.script;
        // const scriptBuffer2=address.outputScript;
        try{
            // if (scriptBuffer0.equals(scriptBuffer2)) { // owned input
                const originTxId = input.hash.reverse().toString('hex');
                const originOutId=input.index;
                const originBuffer=await this.getTxBuffer(originTxId);
                const originTx= Liquid.Transaction.fromBuffer(originBuffer);
                const originOut = originTx.outs[originOutId];
                await this._resolveOutput(address, originOut, originTx);
                input.ldata = originOut.ldata;
                input.owner=originOut.owner;
                // input.valid=true;
            // console.log("Resolved Input", input, txData);
                // const revealedInput = this._resolveOutput()
            // }
        }catch(e){
            // input.valid=false;
            if(!input.debug) input.debug=[];
            input.debug.push(e);
            console.log("Input discarded", input, e, txData);
        }

    }
 
    async _resolveOutput(address,out,txData){
        try{
            if(out.ldata)   return out;
            // out.valid = true;
            if (out.script.length === 0) { // fees
                out.fee={
                    asset: Liquid.AssetHash.fromBytes(out.asset).bytesWithoutPrefix,
                    value: Liquid.confidential.confidentialValueToSatoshi(out.value),
                    assetHash:Liquid.AssetHash.fromBytes(out.asset).hex,
                    
                }
                out.owner=Buffer.alloc(0);
                throw new Error("Fee output");
            }

            
            function bufferNotEmptyOrNull(buffer) {
                return buffer != null && buffer.length > 0;
            }

            function isConfidentialOutput({ rangeProof, surjectionProof, nonce }) {
                const emptyNonce = Buffer.from('0x00', 'hex');
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
                
                out.ldata = {
                    assetBlindingFactor: Buffer.alloc(32).fill(0),
                    valueBlindingFactor: Buffer.alloc(32).fill(0),
                    asset: Liquid.AssetHash.fromBytes(out.asset).bytesWithoutPrefix,
                    // value: parseInt(elementsValue.number.toString(), 10),
                    value: Liquid.confidential.confidentialValueToSatoshi(out.value)
                    // value: Liquid.ElementsValue.fromBytes(
                    //     out.value
                    // ).number.toString(),
                }
            } else {
                // const slip77node = this.slip77.fromMasterBlindingKey(address.blindingPrivateKey);
                const blindPrivKey = address.blindingPrivateKey;// slip77node.derive(out.script).privateKey;

                if (!blindPrivKey){
                    throw new Error('Blinding private key error for script ' + output.script.toString('hex'));
                }

                // if (out.rangeProof && out.rangeProof.length !== 0) {

                const zkpLib = this.zkpLib;
                const masterKey=this.slip77.fromMasterBlindingKey(address.blindingPrivateKey);
                const zkpGenerator = new Liquid.ZKPGenerator(
                    zkpLib,
                    Liquid.ZKPGenerator.WithBlindingKeysOfInputs([blindPrivKey]),
                );
                // const cnfd = new Liquid.confidential.Confidential(zkpLib);

                  

                   
                //     out.ldata = cnfd.unblindOutputWithKey(
                //         out,
                //         blindPrivKey
                //     );
                out.ldata = await zkpGenerator.unblindUtxo(out);

                out.ldata.value = parseInt(out.ldata.value.toString(), 10);
                // }else{
                //     out.ldata = {
                //         assetBlindingFactor: Buffer.alloc(32).fill(0),
                //         valueBlindingFactor: Buffer.alloc(32).fill(0),
                //         asset: Liquid.AssetHash.fromBytes(out.asset).bytesWithoutPrefix,
                //         value: Liquid.confidential.confidentialValueToSatoshi(out.value), 
                //     }
                // }
                    console.log("Unblinded", out);
            }

            out.ldata.assetHash=Liquid.AssetHash.fromBytes(out.ldata.asset).hex;
            // out.ldata.assetInfo = this.assetProvider.getAssetInfo(out.ldata.assetHash);
            
            
        }catch(e){
            // out.valid=false;
            if(!out.debug) out.debug=[];
            out.debug.push(e);
            console.log("Output discarded",out,e);

        }

        return out;
    }

    async getUTXOs(){
        await this.check();
        const addr  = await this.getAddress();
        const scripthash = this.getElectrumScriptHash(addr.outputScript);
        const utxos = await this.elcAction('blockchain.scripthash.listunspent', [scripthash]);
        let outputs=[];
        const transactions={};
        console.log("Raw utxo", utxos);
        for(const utxo of utxos){   
                
            const txid=utxo.tx_hash;   
            if(!transactions[txid]) transactions[txid]=await this.getTxInfo(utxo.tx_hash,false,false);            
            const transaction=transactions[txid];
            const out=transaction.outs[utxo.tx_pos];
            if (out.script.length === 0) continue; // fee out

            try {
                // const resolvedOut=await this._resolveOutput(addr, out, transaction);
                // if(resolvedOut.valid){
                //     resolvedOut.tx_pos = utxo.tx_pos;
                //     resolvedOut.tx_hash = utxo.tx_hash;
                //     outputs.push(resolvedOut);
                // }
                outputs.push(this._resolveOutput(addr, out, transaction).then(resolvedOut => {
                    // if (resolved.Out.valid) {
                        resolvedOut.tx_pos = utxo.tx_pos;
                        resolvedOut.tx_hash = utxo.tx_hash;
                    // }
                    return resolvedOut;
                }));
            }catch(err){
                console.error("Failed to resolve" ,out,err);
            }           
        }
        outputs=await Promise.all(outputs);
        outputs=outputs.filter(out=>out.owner.equals(addr.outputScript)&&out.ldata);
        return outputs;//await Promise.all(outputs);
            




        // let utxos = this.
        // utxos =utxos.map(utxo=>{
        //     const elementsValue = Liquid.ElementsValue.fromBytes(utxo.output.value);
        //     if (!elementsValue.isConfidential) {
        //         return {
        //             ...utxo,
        //             ldata: {
        //                 assetBlindingFactor: ZERO,
        //                 valueBlindingFactor: ZERO,
        //                 asset: Liquid.AssetHash.fromBytes(utxo.output.asset).bytesWithoutPrefix,
        //                 value: elementsValue.number.toString(),
        //             },
        //         }
        //     } else{
        //         const ldata = cnfd.unblindOutputWithKey(
        //             utxo.output,
        //             blindingKeyBuffer
        //         );
        //         return {
        //             ...utxo,
        //             ldata
        //         }
        //     }         
        // });


        // return utxos;
       
    }

    async getBalance(filter){
        await this.check();
        const utxos = await this.getUTXOs();
        const balanceXasset={};
        for(const utxo of utxos){
            if (filter){
                if (!filter(utxo.ldata.assetHash, utxo.ldata.assetName)) continue;
            }
            const asset = utxo.ldata.assetHash;
            if(!balanceXasset[asset]) balanceXasset[asset]={
                info:undefined,
                value:0,
                hash:asset,
                asset:asset
            };
            balanceXasset[asset].value += utxo.ldata.value;
            // if(!balanceXasset[asset].info){
            //     balanceXasset[asset].info=utxo.ldata.assetInfo;
            // }
        }


        const pinnedAssets=await this.getPinnedAssets();
        for(const asset of pinnedAssets){
            const hash=asset.hash;
            if (!balanceXasset[hash]){
                balanceXasset[hash]={};
                for(const key in asset){
                    balanceXasset[hash][key]=asset[key];
                }
                balanceXasset[hash].value =0;
            }
        }

        const balance=[];
        for(const asset in balanceXasset){
            const assetData=balanceXasset[asset];
            assetData.ready=false;
            assetData.info = Promise.resolve(assetData.info);
            assetData.icon = this.assetProvider.getAssetIcon(asset);
            // if (!assetData.price )assetData.price = this.assetProvider.getPrice(1,asset,undefined, true);
            // assetData.getValue=(currencyHash,floatingPoint=true,asString=false)=>{
            //     return this.assetProvider.getPrice(assetData.value,asset,currencyHash,floatingPoint,asString);
            // };

            assetData.waitForData=Promise.all([
                Promise.resolve( assetData.info),
                Promise.resolve(assetData.icon),
                // Promise.resolve( assetData.price )           
            ]).then(()=>{
                assetData.ready=true;
            });

            // // check if promise
            // const cm=(info)=>{
            //     // assetData.value = assetData.value / 10 ** info.precision;
            //     assetData.ready = true;      
            // }

            // if(assetData.info.then)assetData.info.then(info=>{
            //     cm(info);
            // });
            // else cm(assetData.info);
            balance.push(assetData);
        }
        
        return balance;

        
    }


    async pinAsset(asset){
        await this.check();
        this.assetProvider.track(asset);
    }

    async unpinAsset(asset){
        await this.check();
        this.assetProvider.untrack(asset);
    }

    async getPinnedAssets(indexCurrency){
        await this.check();
        return this.assetProvider.getTrackedAssets(indexCurrency, false);
    }

    async getAvailableCurrencies(indexCurrency){
        await this.check();
        return this.assetProvider.getTrackedAssets(indexCurrency, true);
    }

   
    v(inAmount, assetHash){
        console.log("Test",inAmount, assetHash)
        if (typeof inAmount == "object"){
            if (typeof inAmount.value != "undefined"){
                assetHash = inAmount.asset||inAmount.hash;
                inAmount = inAmount.value;
            } else if (typeof inAmount.outAmount !="undefined"){
                assetHash = inAmount.outAsset;

                inAmount = inAmount.outAmount;
            }else{
                console.log("INvalid amount",inAmount);
                throw new Error("Invalid amount");
            }
        }

        if(!assetHash) {
            console.log("Invalid asset",assetHash);
            throw new Error("Invalid asset "+assetHash);
        }
        if(typeof inAmount!="number") {
            console.log("Invalid amount",inAmount);
            throw new Error("Invalid amount "+inAmount);
        }
        return {
            human: async (targetAssetHash)=>{
                await this.check();
                if (!targetAssetHash) targetAssetHash = assetHash;

                let amount = inAmount;
                amount = await this.assetProvider.getPrice(amount, assetHash, targetAssetHash);
                amount = await this.assetProvider.intToFloat(amount, targetAssetHash);

                amount = await this.assetProvider.floatToStringValue(amount, targetAssetHash);
                return amount;
            },
            float: async (targetAssetHash)=>{
                await this.check();
                if (!targetAssetHash) targetAssetHash = assetHash;

                let amount = inAmount;

                amount = await this.assetProvider.getPrice(amount, assetHash, targetAssetHash);
                amount = await this.assetProvider.intToFloat(amount, targetAssetHash);
                return amount;
            },
            int: async (targetAssetHash)=>{
                await this.check();
                if (!targetAssetHash) targetAssetHash = assetHash;
                let amount = inAmount;
                amount = await this.assetProvider.floatToInt(amount, assetHash);        
                 amount = await this.assetProvider.getPrice(amount, assetHash, targetAssetHash);
                 return amount;
            }

        }
    }


    assets(){
        return this.assetProvider;
    }
 
}