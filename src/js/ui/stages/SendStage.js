import Html from "../Html.js";
import UIStage from "../UIStage.js";
import Constants from "../../Constants.js";

export default class SendStage extends UIStage {
    constructor() {
        super("send");
    }
    async renderSend(walletEl, lq, ui) {
        const network = await lq.getNetworkName();
        const store = await ui.storage();
        const primaryCurrency = (await store.get(`primaryCurrency${network}`)) || lq.getBaseAsset();
        const secondaryCurrency = (await store.get(`secondaryCurrency${network}`)) || "USD";

        let ASSET_HASH = primaryCurrency;
        let ASSET_INFO = await lq.assets().getAssetInfo(primaryCurrency);
        let INPUT_AMOUNT = 0;
        let PRIORITY = 1;

        let SECONDARY_CURRENCY = secondaryCurrency;
        let SECONDARY_INFO = await lq.assets().getAssetInfo(secondaryCurrency);

        let DUMMY_ADDR = Constants.DUMMY_OUT_ADDRESS.testnet;
        let TO_ADDR = DUMMY_ADDR;
        let FEE = 0;

        const c01El = Html.$vlist(walletEl, ".c0", ["fillw", "outscroll"]);
        const c02El = c01El;

        const assetInputEl = Html.$inputSelect(c01El, "#asset", "Select Asset");
        const warningRowEl = Html.$vlist(c01El, "#warningNetwork", ["fillw", "warning"]);
        warningRowEl.setValue(
            `
        <span>
        Please ensure that the receiver address is on the <b>${await lq.getNetworkName()}</b> network. 
        </span>
                `,
            true,
        );

        const addrCntEl = Html.$hlist(c01El, "#addCnt", ["fillw"]);
        const addrEl = Html.$inputText(addrCntEl, ".addr").setPlaceHolder("Address").grow(70);
        const pasteEl = Html.$icon(addrCntEl, ".paste", ["enforceSmallWidth"]).grow(5);
        pasteEl.setValue("content_paste");
        pasteEl.setAction(async () => {
            const text = await navigator.clipboard.readText();
            addrEl.setValue(text);
        });

        // errorRowEl.hide();

        Html.$text(c02El, ".labelAmount").setValue("Amount: ");
        const amountCntEl = Html.$hlist(c02El, "#amountCnt", ["fillw"]);

        const amountNativeEl = Html.$inputNumber(amountCntEl, ".amount").setPlaceHolder("0.00").grow(70);
        const ticker1El = Html.$text(amountCntEl, ".asset", ["center", "enforceSmallWidth"]).grow(5);

        const amountSecondaryCntEl = Html.$hlist(c02El, "#amountCntS", ["fillw"]);

        const amountSecondaryEl = Html.$inputNumber(amountSecondaryCntEl, ".amountSecondary")
            .setPlaceHolder("0.00")
            .grow(70);
        const ticker2El = Html.$text(amountSecondaryCntEl, ".assetSecondary", [
            "center",
            "enforceSmallWidth",
        ]).grow(5);

        const availableBalanceEl = Html.$hlist(c02El, "#available", ["fillw", "sub"]);
        Html.$sep(availableBalanceEl, ".spacer").grow(100);
        Html.$text(availableBalanceEl, ".label").setValue("Available balance: ");
        const availableBalanceValueEl = Html.$text(availableBalanceEl, ".value");
        const useAllEl = Html.$button(availableBalanceEl, ".useAll", ["button", "small"]).setValue(
            "SEND ALL",
        );

        Html.$text(c02El, ".labelPriority").setValue("Priority: ");
        const prioritySlideEl = Html.$inputSlide(c02El, "#priority", ["fillw"]);

        const feeRowEl = Html.$hlist(c02El, "#fee", ["fillw", "sub"]);
        Html.$sep(feeRowEl, ".spacer").grow(100);
        Html.$text(feeRowEl, ".label").setValue("Fee: ");
        const feeValueEl = Html.$text(feeRowEl, ".value");
        Html.$sep(feeRowEl, ".spacer2").setValue("/");
        const feeValueSecondaryEl = Html.$text(feeRowEl, ".valueSecondary");

        const errorRowEl = Html.$vlist(c02El, "#error", ["fillw", "error"]);
        errorRowEl.hide();

        // const loadinRowEl = Html.$hlist(c02El, "#loading", ["center", "sub"]);
        // Html.$icon(loadinRowEl, "#loadingIcon").setValue("hourglass_empty");
        // const loadingTextEl = Html.$text(loadinRowEl, "#loadingText").setValue("Loading...");
        // loadinRowEl.hide();

        const confirmBtnEl = Html.$button(c02El, "#confirmBtn", ["fillw", "button"]).setValue(
            "Confirm and sign",
        );

        const loading = (v) => {
            if (!v) {
                confirmBtnEl.enable();
                confirmBtnEl.setValue("Confirm and sign");
            } else {
                confirmBtnEl.disable();
                confirmBtnEl.setValue(v);
            }
        };

        const _updateInvoice = async (signAndSend) => {
            loading(!signAndSend ? "Loading..." : "Preparing transaction...");
            // loadingTextEl.setValue(!signAndSend ? "Loading..." : "Preparing transaction...");

            errorRowEl.hide();
            const balance = await lq.getBalance((hash) => {
                return hash === ASSET_HASH;
            });
            for (const asset of balance) {
                lq.v(asset.value, asset.asset)
                    .human()
                    .then((value) => {
                        availableBalanceValueEl.setValue(value);
                    });

                let sendAllValue =
                    asset.asset === lq.getBaseAsset() ? asset.value - (FEE ? FEE * 2 : 0) : asset.value;
                lq.v(sendAllValue, asset.asset)
                    .float(ASSET_HASH)
                    .then((value) => {
                        useAllEl.setAction(() => {
                            amountNativeEl.setValue(value);
                        });
                    });
            }
            ticker1El.setValue(ASSET_INFO.ticker);
            ticker2El.setValue(SECONDARY_INFO.ticker);

            try {
                const feeRate = await lq.estimateFeeRate(PRIORITY);
                const tx = await lq.prepareTransaction(INPUT_AMOUNT, ASSET_HASH, TO_ADDR, feeRate.feeRate);
                console.log(tx);
                FEE = tx.fee;
                errorRowEl.hide();
                feeValueEl.setValue(await lq.v(tx.fee, lq.getBaseAsset()).human());
                feeValueSecondaryEl.setValue(await lq.v(tx.fee, lq.getBaseAsset()).human(SECONDARY_CURRENCY));
                if (signAndSend) {
                    if (TO_ADDR !== DUMMY_ADDR) {
                        console.log("Verify");
                        loading("Verifying...");
                        // loadingTextEl.setValue("Verifying...");
                        await tx.verify();
                        console.log("Signing...");
                        // loadingTextEl.setValue("Signing...");
                        console.log("Broadcast");
                        const txid = await tx.broadcast();
                        const sendOkPopupEl = Html.$newPopup(walletEl, "#sendOK", "Transaction broadcasted");
                        Html.$icon(sendOkPopupEl, ".icon", ["sendok"]).setValue("done");
                        setTimeout(() => {
                            sendOkPopupEl.hide();
                            ui.setStage("wallet");
                        }, 4000);
                        sendOkPopupEl.show();
                    } else {
                        loading(false);

                        errorRowEl.show();
                        errorRowEl.setValue("Please enter a valid address");
                    }
                } else {
                    loading(false);
                }
            } catch (e) {
                loading(false);

                console.log(e);
                errorRowEl.show();
                errorRowEl.setValue(e.message);
            }
        };

        prioritySlideEl.setAction((v) => {
            PRIORITY = v;
            _updateInvoice();
        });

        prioritySlideEl.setValue(PRIORITY, true);

        confirmBtnEl.setAction(async () => {
            await _updateInvoice(true);
        });

        lq.getPinnedAssets().then((assets) => {
            for (const asset of assets) {
                lq.assets()
                    .getAssetInfo(asset.hash)
                    .then(async (info) => {
                        const optionEl = assetInputEl.addOption(asset.hash, info.ticker, (value) => {
                            ASSET_HASH = value;
                            ASSET_INFO = info;
                            _updateInvoice();
                        });
                        lq.assets()
                            .getAssetIcon(asset.hash)
                            .then((icon) => {
                                optionEl.setIconSrc(icon);
                            });
                    });
            }
        });

        addrEl.setAction(async (addr) => {
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
            const primaryValueInt = await lq.v(primaryValue, ASSET_HASH).int(ASSET_HASH);
            INPUT_AMOUNT = primaryValueInt;

            const secondaryValueFloat = await lq.v(primaryValueInt, ASSET_HASH).float(SECONDARY_CURRENCY);
            amountSecondaryEl.setValue(secondaryValueFloat, true);

            _updateInvoice();
        });

        amountSecondaryEl.setAction(async (secondaryValue) => {
            if (!secondaryValue) secondaryValue = 0;
            const secondaryValueInt = await lq.v(secondaryValue, SECONDARY_CURRENCY).int(SECONDARY_CURRENCY);
            const primaryValueFloat = await lq.v(secondaryValueInt, SECONDARY_CURRENCY).float(ASSET_HASH);

            amountNativeEl.setValue(primaryValueFloat, true);

            const primaryValueInt = await lq.v(primaryValueFloat, ASSET_HASH).int(ASSET_HASH);
            INPUT_AMOUNT = primaryValueInt;

            _updateInvoice();
        });
    }

    onReload(walletEl, lq, ui) {
        this.renderSend(walletEl, lq, ui);
    }
}
