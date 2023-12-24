import Cache from "./Cache.js";
export default class Exchange {
    constructor( sideSwapWs) {
        this.id = 0;
        this.pending = {};
        this.assetSubscriptions = {};
        this.trackedAssets=[];
        this.sideSwapWs = sideSwapWs;
           }

    async subscribeToAssetPriceUpdate(assetHash, callback) {
        if(!this.assetSubscriptions[assetHash])this.assetSubscriptions[assetHash]=[];
        this.assetSubscriptions[assetHash].push(callback);
        this.query('load_prices', { asset: assetHash });
    }

    async unsubscribeFromAssetPriceUpdate(assetHash, callback) {
        if(!this.assetSubscriptions[assetHash])return;
        const index=this.assetSubscriptions[assetHash].indexOf(callback);
        if(index<0)return;
        this.assetSubscriptions[assetHash].splice(index,1);
    }

    async getAllAssets(){
        const assets=await Cache.get("sw:assets",false,async ()=>{
            const assets={};
            const availableAssets = (await this.query("assets", { embedded_icons: true })).assets;
            for (const asset of availableAssets) {    
                const id = asset.asset_id; 
                assets[id] = asset;
            }
            const availableAmpAssets = (await this.query("amp_assets", { embedded_icons: true })).assets;
            for (const asset of availableAmpAssets) {
                const id = asset.asset_id;
                assets[id] = asset;
            }
            return [assets,Date.now()+1000*60*60*24];
        })
        return assets;

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
            console.trace();
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
                    const error=response.error;
                    if(error){
                        console.error(error);
                        if (this.pending[response.id]) {
                            this.pending[response.id][1](error);
                            delete this.pending[response.id];
                        }
                        return;
                    }else{
                        if (this.pending[response.id]) {
                            this.pending[response.id][0](response.result);
                            delete this.pending[response.id];
                        }
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
            this.pending[id] = [resolve,reject];
            const request = {
                id,
                method,
                params,
            };
            this.sw.send(JSON.stringify(request));
        });
    }


}