import Html from "../Html.js"
import UIStage from "./UIStage.js";

export default class ReceiveStage extends UIStage {
    constructor() {
        super("receive");
    }
    async renderReceive(stageCntEl, lq) {
        let INPUT_AMOUNT = 0;
        let ASSET_HASH = await lq.getBaseAsset();
        let ASSET_INFO = await lq.getBaseAssetInfo();


        const c01El = Html.$vlist(stageCntEl, "#c01", ["fillw"]);
        const c02El = Html.$vlist(stageCntEl, "#c02", ["fillw"]).grow(100);

        // @@@@@@@@@@@@
        // @@@@ QR @@@@
        // @@@@@@@@@@@@
        const qrContainerEl = Html.$hlist(c01El, "#invoice",["center"]);
        
        // @@@@ @@@@@@@@@@@@@@@@@@@@@ @@@@
        // @@@@ ADDRESS @ COPY_BUTTON @@@@
        // @@@@ @@@@@@@@@@@@@@@@@@@@@ @@@@
        // addr
        const addrContainerEl = Html.$hlist(c02El, "#addr", [ "fillw"]);
        // button
        const addrEl = Html.$inputText(addrContainerEl, ".addr").grow(100);
        Html.$icon(addrContainerEl,".copy").setValue("content_copy").setAction(()=>{
            navigator.clipboard.writeText(addrEl.getValue());
            alert("copied");
        }).shrink(100);


        // @@@@@@@@@@@@@@@@@@@@@@@@
        // @@@@ TITLE_SETTINGS @@@@
        // @@@@@@@@@@@@@@@@@@@@@@@@
        Html.$title(c02El, "#amountTitle").setValue("Invoice Settings");

        // @@@@@@@@@@@@@@@@@@@@@@@
        // @@ AMOUNT @ CURRENCY @@
        // @@@@@@@@@@@@@@@@@@@@@@@
        const amountCntEl = Html.$hlist(c02El, "#amountCnt", ["fillw"]);
        // amount
        Html.$text(amountCntEl, ".label").setValue("Amount: ");
        const amountInputEl = Html.$inputNumber(amountCntEl, ".amountInput").grow(50).setPlaceHolder("0.00");
        //currency
        const currencySelector = Html.$inputSelect(amountCntEl, ".currencySelect").setPreferredValues([ASSET_HASH, "L-BTC", "USD"]);
       

        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        // @@@@@@@@@@@@@@@@@ CONVERSION_PRIMARY / CCONVERSION SECONDARY @@
        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        const conversionRateCntEl = Html.$hlist(c02El, "#conversionRateCnt", ["fillw"]);
        Html.$sep(conversionRateCntEl, ".spacer").grow(100);
        const conversionRatePrimaryEl=Html.$text(conversionRateCntEl, ".conversionRatePrimary", ["sub"]).setValue("0.00");
        Html.$sep(conversionRateCntEl, ".spacer2").setValue("/");
        const conversionRateSecondaryEl=Html.$text(conversionRateCntEl, ".conversionRateSecondary", ["sub"]).setValue("0.00");

        // dummy network selection (only current network is supported)
        const netEl = Html.$hlist(c02El, "#net", ["fillw"]);
        Html.$text(netEl, ".network").setValue("Network: ");
        Html.$inputSelect(netEl, ".networkValue").grow(100).addOption(await lq.getNetworkName(), await lq.getNetworkName());


        
        const updateInvoice = async () => {
            if (!ASSET_HASH || !ASSET_INFO) return; // if unset do nothing
            let amount = await lq.v(INPUT_AMOUNT, ASSET_HASH).int(ASSET_HASH); // compute int value
            const { addr, qr } = await lq.receive(amount, ASSET_HASH); // create invoice 
            Html.$img(qrContainerEl, ".qr", ["invoiceQr"]).setSrc(qr); // show qr
            addrEl.setValue(addr); // show copyable address

            // compute conversion rates
            lq.v(amount, ASSET_HASH).human(lq.getBaseAsset()).then((primaryRate)=>{
                conversionRatePrimaryEl.setValue(primaryRate);

            });
            lq.v(amount, ASSET_HASH).human("USD").then((secondaryRate) => {
                conversionRateSecondaryEl.setValue(secondaryRate);

            });

            

        }



        // on amount change
        amountInputEl.setAction((value) => {
            INPUT_AMOUNT = value;
            updateInvoice();
        });

        // load currencies async and list for changes
        lq.getPinnedAssets().then((assets) => { 
            for (const asset of assets) {
                asset.info.then(info => {
                    currencySelector.addOption(asset.hash, info.ticker, (value) => {
                        ASSET_HASH = value;
                        updateInvoice();
                    });
                });
            }
        });

        updateInvoice();

 



    }

    onReload(walletEl, lq, ui) {
        this.renderReceive(walletEl, lq);

    }



}