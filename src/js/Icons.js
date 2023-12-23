export default class Icons{
    

    constructor(exchange, exchangeUpdateTimeout=1000*60*60, staticIcons="/static/icons.json"){
        this.exchange=exchange;
        this.icons=undefined;
        this.exchangeAssets={};
        this.lastExchangeAssetsUpdate=0;
        this.exchangeUpdateTimeout=exchangeUpdateTimeout;
        this.staticIcons=staticIcons;
    }


    async getIcon(assetId){
        if(this.staticIcons&&!this.icons){
            this.icons=await fetch(this.staticIcons).then(r=>r.json());
        }
        let out=undefined;
        if (this.icons[assetId]) {
            out = this.icons[assetId];
        }
        if (!out&&this.exchange){  
            if(Date.now()-this.lastExchangeAssetsUpdate>this.exchangeUpdateTimeout){
                const availableAssets = (await this.exchange.query("assets", { embedded_icons:true})).assets;
                for(const asset of availableAssets){
                    const iconB64 = asset.icon;
                    const iconDataUrl="data:image/png;base64,"+iconB64;

                    const icon_url = iconDataUrl;
                   
                    const id=asset.asset_id;
                    this.exchangeAssets[id]=icon_url;
                }
                const availableAmpAssets = (await this.exchange.query("amp_assets", { embedded_icons: true })).assets;
                for(const asset of availableAmpAssets){
                    const id=asset.asset_id;
                    const iconB64 = asset.icon;
                    const iconDataUrl = "data:image/png;base64," + iconB64;
                    const icon_url = iconDataUrl;
                    this.exchangeAssets[id]=icon_url;
                }
                this.lastExchangeAssetsUpdate=Date.now();
            }
            out = this.exchangeAssets[assetId];
        }

        if(!out){
            out = this.icons["unknown"];
        }

        return out;
    }
}