
import Html from "../Html.js";
import UIStage from "../UIStage.js";
import Constants from "../../Constants.js";

export default class SendStage extends UIStage {
    constructor() {
        super("send");
    }
    async renderSend(walletEl, lq) {
        let ASSET_HASH = await lq.getBaseAsset();
        let ASSET_INFO = await lq.getBaseAssetInfo();
        let INPUT_AMOUNT = 0;

        let INPUT_CURRENCY = "USD";
        let INPUT_INFO = "USD";

        let TO_ADDR = Constants.DUMMY_OUT_ADDRESS.testnet;

        const sendCntEl = Html.$vlist(walletEl, "#send");
        const addrCntEl = Html.$hlist(sendCntEl, "#addCnt", ["fill"]);
        const addrLabelEl = Html.$text(addrCntEl, ".label");
        const sendAssetCnt = Html.$hlist(sendCntEl, "#sendAssetCnt", ["fill"]);
        const sendAssetLabelEl = Html.$text(sendAssetCnt, ".label");
        sendAssetLabelEl.setValue("Asset");
        const sendAssetEl = Html.$inputSelect(sendAssetCnt, ".asset");
        sendAssetEl.setPreferredValues([ASSET_HASH]);
        lq.getPinnedAssets().then((assets) => {
            for (const asset of assets) {
                asset.info.then(info => {
                    sendAssetEl.addOption(asset.hash, info.ticker, (value) => {
                        ASSET_HASH = value;
                        ASSET_INFO = info;
                    });
                });
            }
        });

        const sendEl = Html.$hlist(sendCntEl, "#sendEl", ["fill"]);
        const labelValueEl = Html.$text(sendEl, ".label");
        labelValueEl.setValue("Amount");
        const valueEl = Html.$inputNumber(sendEl, ".value");
        valueEl.setPlaceHolder("0.00");
  

        const currencyEl = Html.$inputSelect(sendEl, ".currency");
        currencyEl.setPreferredValues([await lq.getBaseAsset(), "USD"]);
        lq.getPinnedAssets().then((assets) => {
            for (const asset of assets) {
                asset.info.then(info => {
                    currencyEl.addOption(asset.hash, info.ticker, (value) => {
                        INPUT_CURRENCY = value;
                        INPUT_INFO = info;
                    });
                });
            }
        });

        const infoCntEl = Html.$vlist(sendCntEl, "#infoCnt", []);
        const feeEl = Html.$text(infoCntEl, "#infoEl", ["fill", "right"]);
        const fee2El = Html.$text(infoCntEl, "#infoEl", ["fill", "right","sub"]);

        const updateTxInfo = async () => {
            let amount = await lq.v(INPUT_AMOUNT, INPUT_CURRENCY).int(ASSET_HASH);
            const asset = ASSET_HASH;
            const to = TO_ADDR;
            lq.prepareTransaction(amount, asset, to).then((tx) => {
                console.log("TXXXX", tx);
                lq.v(tx.fee, lq.getBaseAsset()).human().then((fee) => {
                    feeEl.setValue("Fee: " + fee);
                });
                lq.v(tx.fee, lq.getBaseAsset()).human("USD").then((fee) => {
                    fee2El.setValue("" + fee);
                });
            });
        }

        valueEl.setAction((value) => {
            INPUT_AMOUNT = value;
            updateTxInfo();
        });

       
        addrLabelEl.setValue("To");
        const addrEl = Html.$inputText(addrCntEl, ".addr");
        addrEl.setPlaceHolder("Address");
        addrEl.setAction((value) => {
            TO_ADDR = value;
        });




        const sendBtnEl = Html.$button(sendCntEl, "#sendBtn", ["fill", "button"]);
        sendBtnEl.setValue("Confirm and sign");
        sendBtnEl.setAction(async () => {
            let amount = await lq.v(INPUT_AMOUNT, INPUT_CURRENCY).int(ASSET_HASH);
            const asset = ASSET_HASH;
            const to = TO_ADDR;
            let tx = await lq.prepareTransaction(amount, asset, to);

            console.info(tx);
            tx = await tx.broadcast();
            console.info(tx);

        });


    }

    onReload(walletEl, lq, ui) {
        this.renderSend(walletEl, lq);

    }


}