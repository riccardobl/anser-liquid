export default class Exchange {
    constructor(btcHash, sideSwapWs, fiatTickerUrl ="https://blockchain.info/ticker", fiatTrackerTimeout=60*60*1000) {
        this.id = 0;
        this.pending = {};
        this.assetSubscriptions = {};
        this.trackedAssets=[];
        this.sideSwapWs = sideSwapWs;
        this.btcHash = btcHash;
        this.pricesBtcIndex = {};
        this.pricesBtcIndex[btcHash] = 1;
        this.trackedFiat=[];
        this.fiatTickerUrl = fiatTickerUrl;
        this.fiatTrackerTimeout=fiatTrackerTimeout;
        this.updateFiatPricesTimeout=null;
        this.lastFiatTickerData=undefined;
        this.lastFiatTickerUpdate=0;
        this.updateFiatPrices();
    }

    subscribeToAsset(assetHash, callback) {
        if(!this.assetSubscriptions[assetHash])this.assetSubscriptions[assetHash]=[];
        this.assetSubscriptions[assetHash].push(callback);
        this.query('load_prices', { asset: assetHash });
    }

    unsubscribeFromAsset(assetHash, callback) {
        if(!this.assetSubscriptions[assetHash])return;
        const index=this.assetSubscriptions[assetHash].indexOf(callback);
        if(index<0)return;
        this.assetSubscriptions[assetHash].splice(index,1);
    }

    async updateFiatPrices(){
        try{
            if (this.updateFiatPricesTimeout) clearTimeout(this.updateFiatPricesTimeout);
            let data;
            if(this.lastFiatTickerData && Date.now()-this.lastFiatTickerUpdate<this.fiatTrackerTimeout){
                data=this.lastFiatTickerData;
            }else{
                data=await fetch(this.fiatTickerUrl).then(r => r.json());
                this.lastFiatTickerData=data;
                this.lastFiatTickerUpdate=Date.now();
            }
            for(const fiat of this.trackedFiat){
                const price=Number(data[fiat].buy);
                if(isNaN(price))continue;
                this.pricesBtcIndex[fiat]=price;
            }
            this.updateFiatPricesTimeout=setTimeout(()=>this.updateFiatPrices(),this.fiatTrackerTimeout/3);
        }catch(e){
            console.error(e);
        }
        
    }


    async query(method, params) {
        // check if closed
        if (this.sw&&this.sw.readyState === WebSocket.CLOSED)   this.sw=null;
        while (this.starting) {
            console.log('Waiting for websocket to start')
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        // init websocket
        if(!this.sw){
           
            this.starting=true;
            console.log("Connecting to ", this.sideSwapWs);
            this.sw = new WebSocket(this.sideSwapWs);
            await new Promise((resolve, reject) => {
                this.sw.onopen = () => {
                    this.starting=false;
                    resolve();
                }
                this.sw.onerror = (error) => {
                    console.error(error);
                    this.starting=false;
                    reject(error);
                }

                this.sw.onmessage = (event) => { // handle response
                    this.starting = false;

                    const response = JSON.parse(event.data);
                    if (this.pending[response.id]) {
                        this.pending[response.id](response.result);
                        delete this.pending[response.id];
                    }
                    if (response.method=="load_prices") { // handle subscription
                        
                        const assetHash = response.result.asset;
                        if (this.assetSubscriptions[assetHash]) {
                            for (const cb of this.assetSubscriptions[assetHash]) {
                                cb(response.result.ind ? response.result.ind : 0, "BTC");
                            }
                        }
                    }
                    resolve();
                };
                
            });

           
           
        }

        return new Promise((resolve, reject) => {
            const id = this.id++;
            this.pending[id] = resolve;
            const request = {
                id,
                method,
                params,
            };
            this.sw.send(JSON.stringify(request));
        });
    }

    async track(assetHash){
        if(assetHash===this.btcHash)return;
        if (this.trackedAssets.indexOf(assetHash) >= 0) return;

        let first=true;
        return new Promise((res,rej)=>{
                this.trackedAssets.push(assetHash);
                this.subscribeToAsset(assetHash, (price, baseAssetId) => {                     
                    this.pricesBtcIndex[assetHash] = price;
                    if(first){
                        res(price);
                        first=false;
                    }
                });
            
        });
    }


    

    async trackFiat(fiat){
        if(this.trackedFiat.indexOf(fiat)>=0)return;
        this.trackedFiat.push(fiat);
        await this.updateFiatPrices();
    }

    async getPrice(amount, asset , targetAsset) {
        if (amount==0) return 0;
        if (!targetAsset) targetAsset=this.btcHash;
        if (asset == targetAsset) return amount;
        const isHash=(asset)=>{
            return asset.length>4;
        }
        if (isHash(asset)) await this.track(asset);
        else await this.trackFiat(asset);
        if (isHash(targetAsset)) await this.track(targetAsset);
        else await this.trackFiat(targetAsset);

        
        // price of amount asset in targetAsset
        // get getPrice(10,BTC, USD) = price of 10 BTC in USD
        const assetsFor1BTC = this.pricesBtcIndex[asset];
        const targetAssetsFor1BTC = this.pricesBtcIndex[targetAsset];
        const price = targetAssetsFor1BTC / assetsFor1BTC;
        return amount * price;
    }
}