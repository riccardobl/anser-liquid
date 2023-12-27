
import Html from "../Html.js";
import UIStage from "../UIStage.js";
import Constants from "../../Constants.js";

export default class SendStage extends UIStage {
    constructor() {
        super("send");
    }
    async renderSend(walletEl, lq, ui) {
        const network = await lq.getNetworkName();
        const store=await ui.storage();
        const primaryCurrency = await store.get(`primaryCurrency${network}`) || lq.getBaseAsset();
        const secondaryCurrency = await store.get(`secondaryCurrency${network}`) || "USD"

        let ASSET_HASH = primaryCurrency;
        let ASSET_INFO = await lq.assets().getAssetInfo(primaryCurrency);
        let INPUT_AMOUNT = 0;
 

        let SECONDARY_CURRENCY = secondaryCurrency;
        let SECONDARY_INFO = await lq.assets().getAssetInfo(secondaryCurrency);

        let DUMMY_ADDR = Constants.DUMMY_OUT_ADDRESS.testnet;
        let TO_ADDR = DUMMY_ADDR;

        const cntEl = Html.$vlist(walletEl, "#sendCnt", ["fillw"]);
        const assetInputEl=Html.$inputSelect(cntEl, "#asset");
        Html.$vsep(cntEl, "#sep1");
        

        Html.$text(cntEl, ".labelAddr").setValue("To: ");
        const addrCntEl = Html.$hlist(cntEl, "#addCnt", ["fillw"]);
        const addrEl = Html.$inputText(addrCntEl, ".addr").setPlaceHolder("Address").grow(70);
        const pasteEl = Html.$icon(addrCntEl, ".paste", ["enforceSmallWidth"]).grow(5);
        pasteEl.setValue("content_paste");
        pasteEl.setAction(async ()=>{
            const text = await navigator.clipboard.readText();
            addrEl.setValue(text);
        });

        const warningRowEl=Html.$vlist(cntEl, "#warningNetwork", ["fillw", "warning"]);
        warningRowEl.setValue(`
        <span>
        Please ensure that the receiver address is on the <b>${await lq.getNetworkName()}</b> network. 
        </span>
                `,true);

        
        // errorRowEl.hide();



        Html.$text(cntEl, ".labelAmount").setValue("Amount: ");
        const amountCntEl = Html.$hlist(cntEl, "#amountCnt", ["fillw"]);

        const amountNativeEl = Html.$inputNumber(amountCntEl, ".amount").setPlaceHolder("0.00").grow(70);
        const ticker1El=        Html.$text(amountCntEl, ".asset", ["center", "enforceSmallWidth"]).grow(5);

        const amountSecondaryCntEl = Html.$hlist(cntEl, "#amountCntS", ["fillw"]);

        const amountSecondaryEl = Html.$inputNumber(amountSecondaryCntEl, ".amountSecondary").setPlaceHolder("0.00").grow(70);
       const ticker2El= Html.$text(amountSecondaryCntEl, ".assetSecondary", ["center","enforceSmallWidth"]).grow(5);

        const availableBalanceEl=Html.$hlist(cntEl, "#available", ["fillw","sub"]);
        Html.$sep(availableBalanceEl, ".spacer").grow(100);
        Html.$text(availableBalanceEl, ".label").setValue("Available balance: ");
        const availableBalanceValueEl=Html.$text(availableBalanceEl, ".value");
        const useAllEl=Html.$button(availableBalanceEl, ".useAll", ["button","small"]).setValue("SEND ALL");

        const feeRowEl=Html.$hlist(cntEl, "#fee", ["fillw", "sub"]);
        Html.$sep(feeRowEl, ".spacer").grow(100);
        Html.$text(feeRowEl, ".label").setValue("Fee: ");
        const feeValueEl=Html.$text(feeRowEl, ".value");
        Html.$sep(feeRowEl, ".spacer2").setValue("/");
        const feeValueSecondaryEl=Html.$text(feeRowEl, ".valueSecondary");
        
        
        const errorRowEl = Html.$vlist(cntEl, "#error", ["fillw", "error"]);       
        errorRowEl.hide();

        const loadinRowEl=Html.$hlist(cntEl, "#loading", [ "center", "sub"]);
        Html.$icon(loadinRowEl, "#loadingIcon").setValue("hourglass_empty");
        const loadingTextEl = Html.$text(loadinRowEl, "#loadingText").setValue("Loading...");
        loadinRowEl.hide();

        const confirmBtnEl = Html.$button(cntEl, "#confirmBtn", ["fillw", "button"]).setValue("Confirm and sign");
        
        
        const _updateInvoice=async (signAndSend)=>{
            confirmBtnEl.disable();
            loadingTextEl.setValue(!signAndSend?"Loading...":"Preparing transaction...");

            errorRowEl.hide();
            loadinRowEl.show();
            const balance=await lq.getBalance((hash) => {
                return hash === ASSET_HASH;
            });
            for(const asset of balance){
                lq.v(asset.value, asset.asset).human().then((value)=>{
                    availableBalanceValueEl.setValue(value);
                   
                });
                lq.v(asset.value, asset.asset).float(ASSET_HASH).then((value)=>{
                    useAllEl.setAction(() => {
                        amountNativeEl.setValue(value);
                        
                    });
                });
            };
            ticker1El.setValue(ASSET_INFO.ticker);
            ticker2El.setValue(SECONDARY_INFO.ticker);

            try{
                const tx=await lq.prepareTransaction(INPUT_AMOUNT, ASSET_HASH, TO_ADDR);
                console.log(tx);
                errorRowEl.hide();
                feeValueEl.setValue(await lq.v(tx.fee, lq.getBaseAsset()).human());
                feeValueSecondaryEl.setValue(await lq.v(tx.fee, lq.getBaseAsset()).human(SECONDARY_CURRENCY));
                if(signAndSend){
                    if (TO_ADDR !== DUMMY_ADDR){
                        console.log("Verify");
                        loadingTextEl.setValue("Verifying...");
                        await tx.verify();
                        loadingTextEl.setValue("Signing...");
                        console.log("Broadcast");
                        await tx.broadcast();
                    }else{
                        loadinRowEl.hide();
                        errorRowEl.show();
                        errorRowEl.setValue("Please enter a valid address");
                    }
                }else{
                    confirmBtnEl.enable();
                    loadinRowEl.hide();

                }
            }catch(e){
                loadinRowEl.hide();
                confirmBtnEl.enable();

                console.error(e);
                errorRowEl.show();
                errorRowEl.setValue(e.message);
            };

        };

        confirmBtnEl.setAction(async () => {
            await _updateInvoice(true);
        });
        
        lq.getPinnedAssets().then((assets) => {
            for (const asset of assets) {
                lq.assets().getAssetInfo(asset.hash).then(async info => {
                    const optionEl = assetInputEl.addOption(asset.hash, info.ticker, (value) => {
                        ASSET_HASH = value;
                        ASSET_INFO = info;
                        _updateInvoice();
                    });
                    lq.assets().getAssetIcon(asset.hash).then((icon) => {
                        optionEl.setIconSrc(icon);
                    });                    
                });
            }
        });

        addrEl.setAction(async (addr)=>{
            if (!addr) {
                TO_ADDR = DUMMY_ADDR;
                return;
            }
            const query = {};

            if (addr.startsWith("liquidnetwork:")) {
                addr = addr.slice("liquidnetwork:".length);
                const queryStart = addr.indexOf("?");
                if (queryStart >= 0) {
                    const queryStr = addr.slice(queryStart + 1);
                    addr = addr.slice(0, queryStart);
                    const queryParts = queryStr.split("&");
                    for (const queryPart of queryParts) {
                        const [key, value] = queryPart.split("=");
                        query[key] = value;
                    }
                }               
            } 
            
            if (query.amount) {
                amountNativeEl.setValue(query.amount);
            }

            if (query.asset) {
                assetInputEl.selectOption(query.asset);
            }

            TO_ADDR = addr;
            _updateInvoice();

        });

        amountNativeEl.setAction(async (primaryValue) => {
            if (!primaryValue) primaryValue = 0;
            const primaryValueInt= await lq.v(primaryValue, ASSET_HASH).int(ASSET_HASH);
            INPUT_AMOUNT = primaryValueInt;

            const secondaryValueFloat= await lq.v(primaryValueInt, ASSET_HASH).float(SECONDARY_CURRENCY);
            amountSecondaryEl.setValue(secondaryValueFloat,true);

            _updateInvoice();

        });

        amountSecondaryEl.setAction(async (secondaryValue) => {
            if (!secondaryValue) secondaryValue = 0;
            const secondaryValueInt= await lq.v(secondaryValue, SECONDARY_CURRENCY).int(SECONDARY_CURRENCY);
            const primaryValueFloat= await lq.v(secondaryValueInt, SECONDARY_CURRENCY).float(ASSET_HASH);

            amountNativeEl.setValue(primaryValueFloat, true);

            _updateInvoice();

        });
        
     
        
       


    }

    onReload(walletEl, lq, ui) {
        this.renderSend(walletEl, lq,ui);

    }


}