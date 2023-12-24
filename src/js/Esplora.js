import Constants from "./Constants.js";
import Cache from "./Cache.js";
import fetch from "./utils/fetch-timeout.js";

export default class Esplora{
    constructor(esploraHttps){
        this.esploraHttps = esploraHttps;
    }

    async query(action, params = {}, method="GET") {
        let url=this.esploraHttps;
        if(!url.endsWith("/")) url+="/";
        url+=action;
        
        if(method==="GET"){
            const urlObj = new URL(url);
            for(let key in params){
                urlObj.searchParams.set(key, params[key]);
            }
            url = urlObj.toString();
        }
        console.log(url);
        const response = await fetch(url, {
            method: method,
            body: method==="GET" ? undefined : JSON.stringify(params)
           
        }).then(r => r.json());

        return response;


    }

    async getFee(priority = 1) {
 
        const response=await this.query("fee-estimates");
        const keys = Object.keys(response);
        keys.sort((a, b) => parseInt(a) - parseInt(b));
        const n = keys.length;
        if (priority < 0) priority = 0;
        if (priority > 1) priority = 1;
        priority = 1.0 - priority;
        priority = Math.floor(priority * n);
        const selectedKey = keys[priority];
        const out = {
            blocks: Number(selectedKey),
            fee: Number(response[selectedKey])
        }
        if (!out.fee) {
            out.fee = Constants.HARDCODED_FEE;
        }
        if (!out.blocks) {
            out.blocks = 1;
        }
        return out;
    }

    async getAssetInfo(assetId){
        return await this.query("asset/"+assetId);
    }

    async getTxInfo(txId){
        return await this.query("tx/"+txId);
    }


}