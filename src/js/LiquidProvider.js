import Alert from './Alert.js';
import { ElectrumWS } from 'ws-electrumx-client';
import Liquid from 'liquidjs-lib';
import ZkpLib from '@vulpemventures/secp256k1-zkp';
import QrCode from 'qrcode';
import BlockExplorer from './BlockExplorer.js';
import VByteEstimator from './VByteEstimator.js';
import Constants from './Constants.js';
import Exchange from './Exchange.js';
import Icons from './Icons.js';
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
        
        // initialize asset registry
        this.assetRegistry = new BlockExplorer(esploraHttps,this.baseAsset,8,"L-BTC","Bitcoin (Liquid)");
  
        // get base asset info
        this.baseAssetInfo = await this.assetRegistry.getAssetInfo(this.baseAsset);

        // load exchange
        this.exchange = new Exchange(this.baseAsset, sideswapWs);   

        // load icons
        this.icons=new Icons(this.exchange);


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


    async receive(amount, confidential = false, asset=null, qrOptions={}){
        await this.check();
        let address = await this.getAddress();
        if(!asset){
            asset=this.baseAsset;
        }
        if(confidential){             
            address = address.confidentialAddress;
        }else{
            address = address.address;
        }

        const info=await this.assetRegistry.getAssetInfo(asset);
        if(info.precision){
            amount=Math.floor(amount*10**info.precision);
        }else{
            amount=undefined;
        }

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
            url:payLink,
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

    async getHistory(){
        await this.check();
        const addr=await this.getAddress();
        const scripthash = this.getElectrumScriptHash(addr.outputScript);

        let history=[];
        history.push(...await this.elcAction('blockchain.scripthash.get_history', [scripthash]));
        // history.push(...await this.elcAction('blockchain.scripthash.get_mempool', scripthash));
        console.log("History",history);
        const transactions=[];
        
        for(const tx of history){
            transactions.push({
                tx_hash: tx.tx_hash,
                height: tx.height,
                confirmed: tx.height >0
            });
        }

        // history=[];
        // for(const tx of history){
        //     transactions.push({
        //         tx_hash: tx.tx_hash,
        //         height: tx.height,
        //         confirmed: false
        //     });
        // }

        return transactions;
    }


    async estimateFeeRate(priority=1){
        await this.check();
        const fee=await this.assetRegistry.getFee(priority);
        return fee;
    }
   
    async prepareTransaction(amount, asset, toAddress, estimatedFeeVByte=null, averageSizeVByte=2000){
        await this.check();
        if (!estimatedFeeVByte){
            estimatedFeeVByte=(await this.assetRegistry.getFee(1)).fee;
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
                    blindingPublicKey: address.publicKey,
                };
                console.log("Change output", changeOutput)
                outputs.push(changeOutput);
            }


            ///// FEES
            // Collect fees inputs 
            if (expectedFee>0){
                for (const utxo of utxos) {
                    if (utxo.ldata.asset !== feeAsset) continue;
                    if (utxo.ldata.value <= 0) throw new Error("Invalid UTXO");
                    if (!utxo.ldata.value || utxo.ldata.value <= 0 || isNaN(utxo.ldata.value) || Math.floor(utxo.ldata.value) != utxo.ldata.value) throw new Error("Invalid UTXO");
                    collectedFee += utxo.ldata.value;
                    inputs.push(utxo);
                    if (collectedFee >= expectedFee) break;
                }
            

                if (collectedFee < expectedFee) {
                    throw new Error("Insufficient funds for fees");
                }

                // Calculate change
                const changeFee = collectedFee - expectedFee;
                if (changeFee < 0 || Math.floor(changeFee) != changeFee) {
                    throw new Error("Invalid fee change  " + changeFee );
                }

                // Set changes
                if (changeFee > 0) {
                    const changeFeeOutput = {
                        asset,
                        amount: changeFee,
                        script: Liquid.address.toOutputScript(address.address),
                        blinderIndex: 0,
                        blindingPublicKey: address.publicKey,
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

            console.log("Verification OK: fees", fees, "totalOut", totalOut, "totalIn", totalIn);
        }

        // Prepare zkp
        const ownedInputs = inputs.map((input, i) => {
            console.log(input);
            return {
                index: i,
                value: input.ldata.value,
                valueBlindingFactor: input.ldata.valueBlindingFactor,
                asset: input.ldata.asset,
                assetBlindingFactor: input.ldata.assetBlindingFactor
            }
        });

        const zkpLib=await this.getZkp();
        const zkpGenerator = new Liquid.ZKPGenerator(
            zkpLib,
            Liquid.ZKPGenerator.WithOwnedInputs(ownedInputs),
        );

        const outputBlindingArgs = zkpGenerator.blindOutputs(
            pset,
            Liquid.Pset.ECCKeysGenerator(zkpLib.ecc),
        );

        // blind
        const blinder = new Liquid.Blinder(
            pset,
            ownedInputs,
            zkpLib.validator,
            zkpGenerator
        );

        blinder.blindLast({ outputBlindingArgs });


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


     


    async getTxInfo(tx, resolveOutputs =true, resolveInputs=true){
        await this.check();
        let tx_hash = tx.tx_hash;
        if(!tx_hash) throw new Error("Invalid tx");
        // if(!tx_hash) tx_hash=tx.txid;
        // if(!tx_hash) tx_hash=tx.tx_hash;
        // if(!tx_hash) tx_hash=tx.hash;
        // if(!tx_hash) tx_hash=tx;
        
        const txHex = await this.elcAction('blockchain.transaction.get', [tx_hash, false]);
        const txData=Liquid.Transaction.fromHex(txHex);

        txData.tx_hash=tx_hash;
        txData.height=tx.height;
        txData.confirmed=tx.confirmed;

        const addr = await this.getAddress();

        if (resolveOutputs){
            await Promise.all(txData.outs.map(out => this._resolveOutput(addr,out, txData)));
        }

        for(const inTx of txData.ins){
            const script = inTx.script;
            
            console.log("Script compare", script,addr.outputScript);
            
            if (script == addr.outputScript) {
                txData.isOutgoing = true;
         
            }

        }
            
        
        txData.isIncoming = !txData.isOutgoing;


        return txData;
    }


    isConfidentialOutput(tx) {
        const { rangeProof, surjectionProof, nonce } = tx;
        function bufferNotEmptyOrNull(buffer) {
            return buffer != null && buffer.length > 0;
        }

        return (
            bufferNotEmptyOrNull(rangeProof) &&
            bufferNotEmptyOrNull(surjectionProof) &&
            nonce !== Buffer.from('0x00', 'hex')
        );
    }


    async getZkp(){
        if(!this.zkpLib){
            this.zkpLib = await ZkpLib();
        }
        if (!this.zkpLib.validator){
            this.zkpLib.validator = new Liquid.ZKPValidator(this.zkpLib);
        }
        return this.zkpLib;
    }

    async _resolveOutput(address,out,txData){
        try{
            out.valid = true;
            if (out.script.length === 0) { // fees
                throw new Error("Fee output");
            }

            // const elementsValue = Liquid.ElementsValue.fromBytes(out.value);
            const isConfidential = this.isConfidentialOutput(out);
            if (!isConfidential) {
                out.ldata = {
                    assetBlindingFactor: Buffer.alloc(32).fill(0),
                    valueBlindingFactor: Buffer.alloc(32).fill(0),
                    asset: Liquid.AssetHash.fromBytes(out.asset).bytesWithoutPrefix,
                    // value: parseInt(elementsValue.number.toString(), 10),
                    value: Liquid.confidential.confidentialValueToSatoshi(out.value)
                }
            } else {
                // const slip77node = this.slip77.fromMasterBlindingKey(address.blindingPrivateKey);
                const blindPrivKey = address.blindingPrivateKey;// slip77node.derive(out.script).privateKey;

                if (!blindPrivKey){
                    throw new Error('Blinding private key error for script ' + output.script.toString('hex'));
                }

                // if (out.rangeProof && out.rangeProof.length !== 0) {
                    let cnfd;
                    if(!this.cnfd){
                        const zkpLib = await this.getZkp();
                        this.cnfd = new Liquid.confidential.Confidential(zkpLib);
                        cnfd = this.cnfd;
                    }else{
                        cnfd=this.cnfd;
                    }

                   
                    out.ldata = cnfd.unblindOutputWithKey(
                        out,
                        blindPrivKey
                    );

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
            out.ldata.assetInfo = this.assetRegistry.getAssetInfo(out.ldata.assetHash);
            
        }catch(e){
            out.valid=false;
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
            if(!transactions[txid]) transactions[txid]=await this.getTxInfo(utxo,false,false);            
            const transaction=transactions[txid];
            const out=transaction.outs[utxo.tx_pos];
            console.log(out);
            if (out.script.length === 0) continue; // fee out

            try {
                // const resolvedOut=await this._resolveOutput(addr, out, transaction);
                // if(resolvedOut.valid){
                //     resolvedOut.tx_pos = utxo.tx_pos;
                //     resolvedOut.tx_hash = utxo.tx_hash;
                //     outputs.push(resolvedOut);
                // }
                outputs.push(this._resolveOutput(addr, out, transaction).then(resolvedOut => {
                    if (resolvedOut.valid) {
                        resolvedOut.tx_pos = utxo.tx_pos;
                        resolvedOut.tx_hash = utxo.tx_hash;
                    }
                    return resolvedOut;
                }));
            }catch(err){
                console.error("Failed to resolve" ,out,err);
            }           
        }
        outputs=await Promise.all(outputs);
        outputs=outputs.filter(out=>out.valid);
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
                hash:asset
            };
            balanceXasset[asset].value+=utxo.ldata.value;
            if(!balanceXasset[asset].info){
                balanceXasset[asset].info=utxo.ldata.assetInfo;
            }
        }

        console.log(balanceXasset);

        // TODO pinned assets
        if(!balanceXasset[this.baseAsset]){
            balanceXasset[this.baseAsset]={
                info:this.baseAssetInfo,
                value:0,
                hash:this.baseAsset
            };
        }

        const balance=[];
        for(const asset in balanceXasset){
            const assetData=balanceXasset[asset];
            assetData.ready=false;
            assetData.info = Promise.resolve(assetData.info);
            assetData.icon=this.icons.getIcon(asset);

            assetData.waitForData=Promise.all([
                assetData.info,
                assetData.icon            
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


}