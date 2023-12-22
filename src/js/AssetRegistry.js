
export default class AssetRegistry{
    constructor(esplora, baseAssetId, basePrecision, baseTicker, baseName){
        this.esplora=esplora;
        this.cache={};
        this.baseAssetId=baseAssetId;
        this.basePrecision=basePrecision;
        this.baseTicker=baseTicker;
        this.baseName=baseName;

    }
    async getFee(priority=1){
        const url=this.esplora+"fee-estimates";
        const response=await fetch(url).then(r=>r.json());
        const keys=Object.keys(response);
        keys.sort((a,b)=>parseInt(a)-parseInt(b));
        const n=keys.length;
        if(priority<0)priority=0;
        if(priority>1)priority=1;
        priority=1.0-priority;
        priority=Math.floor(priority*n);
        const selectedKey=keys[priority];
        const out= {
            blocks:Number(selectedKey),
            fee:Number(response[selectedKey])
        }
        if(!out.fee){
            out.fee=270;
        }
        if(!out.blocks){
            out.blocks=1;
        }
        return out;
    }
    async getInfo(assetId){
        if(assetId===this.baseAssetId){
            return {
                precision:this.basePrecision,
                ticker:this.baseTicker,
                name:this.baseName,
                hash:this.baseAssetId
            }
        }
        if(this.cache[assetId]){
            return this.cache[assetId];
        }
        const url=this.esplora+"asset/"+assetId;
        const response=await fetch(url).then(r=>r.json());
        const precision=response.precision||0
        const ticker=response.ticker||"???";
        const name=response.name||"???";
        console.log(response);
        const info = { precision, ticker, name, hash:assetId};
        this.cache[assetId]=info;
        return info;
    }
}