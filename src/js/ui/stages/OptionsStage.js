import Html from "../Html.js";
import UIStage from "../UIStage.js";
export default class OptionsStage extends UIStage {
    constructor() {
        super("options");
    }



    onReload(containerEl, lq, ui) {
        const listEl=Html.$vlist(containerEl,"#optionsList",["fillw"]);
        // const primaryAssetRowEl = Html.$hlist(listEl, "#primaryAssetRow", ["fillw"]);
        Html.$text(listEl, "#primaryAssetLabel").setValue("Primary currency: ");
        const primaryAssetEl = Html.$inputSelect(listEl, "#primaryAsset", "Select Asset");

        Html.$vsep(listEl,"#sep1");
        // const secondaryAssetRowEl=Html.$hlist(listEl,"#secondaryAssetRow",["fillw"]);
        Html.$text(listEl, "#secondaryAssetLabel").setValue("Secondary currency: ");
        const secondaryAssetEl = Html.$inputSelect(listEl, "#secondaryAsset", "Select Asset");
        Html.$vsep(listEl, "#sep2");
        // const themeRowEl=Html.$hlist(listEl,"#themeRow",["fillw"]);
        Html.$text(listEl, "#themeLabel").setValue("Theme: ");
        const themeEl = Html.$inputSelect(listEl,"#theme","Select Theme");
        
        ui.getCurrentTheme().then((currentTheme)=>{
            themeEl.setPreferredValues([currentTheme]);
            for(const theme of ui.listThemes()){
                themeEl.addOption(theme,theme,()=>{
                    ui.setTheme(theme);
                });            
            }
        });

        ui.storage().then(async store=>{
            const network=await lq.getNetworkName();
            const primaryCurrency = await store.get(`primaryCurrency${network}`)||lq.getBaseAsset();
            const secondaryCurrency = await store.get(`secondaryCurrency${network}`)||"USD"
            primaryAssetEl.setPreferredValues([primaryCurrency]);
            secondaryAssetEl.setPreferredValues([secondaryCurrency]);
            
            const currencies = await lq.getAvailableCurrencies();
            for (const currency of currencies) {
                const info = await lq.assets().getAssetInfo(currency.hash);
                const icon = await lq.assets().getAssetIcon(currency.hash);
                const optionEl = primaryAssetEl.addOption(currency.hash, info.ticker,async ()=>{
                    const store=await ui.storage()
                    store.set(`primaryCurrency${network}`,currency.hash);
                });
                optionEl.setIconSrc(icon);
                const optionEl2 = secondaryAssetEl.addOption(currency.hash, info.ticker,async ()=>{
                    const store=await ui.storage()
                    store.set(`secondaryCurrency${network}`,currency.hash);
                });
                optionEl2.setIconSrc(icon);
            }

        });
        Html.$vsep(listEl, "#sep3");

        Html.$text(listEl, "#pinnedAssetsLabel").setValue("Pinned assets: ");
        const inputSelEl=Html.$inputSelect(listEl,"#pinnedAssets","Select Assets",["fillw"],true);
        
        const loadAssetOptions=async ()=>{
            inputSelEl.clearOptions();
            const pinned=await lq.getPinnedAssets();
            const available=await lq.getAvailableCurrencies(false);
            console.log(available);
            for(const asset of available){
                Promise.all([
                    lq.assets().getAssetInfo(asset.hash),
                    lq.assets().getAssetIcon(asset.hash),
                ]).then(([info,icon])=>{
                    const optionEl=inputSelEl.addOption(asset.hash,info.ticker,async (values)=>{
                        for(const k in values){
                            if (!values[k]){
                                console.log("Unpin",k);
                                await lq.unpinAsset(k);
                            }else{
                                await lq.pinAsset(k);
                            }
                        }                        
                    }, pinned.includes(asset.hash));
                    // alert("A");
                    optionEl.setIconSrc(icon);                  
                    // alert("b");
                });
            }

            console.log(pinned.map((a) => a.hash));

            inputSelEl.setPreferredValues(pinned.map((a)=>a.hash));
        }

        loadAssetOptions();
    }
}