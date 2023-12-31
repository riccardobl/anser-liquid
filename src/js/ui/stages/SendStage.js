import Html from "../Html.js";
import UIStage from "../UIStage.js";
import Constants from "../../Constants.js";
import {
    $vlist,
    $hlist,
    $text,
    $title,
    $list,
    $vsep,
    $hsep,
    $img,
    $icon,
    $button,
    $inputText,
    $inputNumber,
    $inputSelect,
    $inputSlide,
} from "../Html.js";

export default class SendStage extends UIStage {
    constructor() {
        super("send");
    }
    async renderSend(walletEl, lq, ui) {
        walletEl.resetState();

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

        const c01El = $vlist(walletEl).makeScrollable().fill();

        const assetInputEl = $inputSelect(c01El, "Select Asset");
        $text(c01El, ["warning"]).setValue(
            `
        <span>
        Please ensure that the receiver address is on the <b>${await lq.getNetworkName()}</b> network. 
        </span>
                `,
            true,
        );

        const addrEl = $inputText(c01El).setPlaceHolder("Address");
        $icon(addrEl)
            .setValue("content_paste")
            .setAction(async () => {
                const text = await navigator.clipboard.readText();
                addrEl.setValue(text);
            });

        $title(c01El).setValue("Amount");

        const amountNativeEl = $inputNumber(c01El).setPlaceHolder("0.00");
        const ticker1El = $text(amountNativeEl);

        const amountSecondaryEl = $inputNumber(c01El).setPlaceHolder("0.00");
        const ticker2El = $text(amountSecondaryEl);

        const availableBalanceEl = $hlist(c01El, ["sub"]).fill();
        $hsep(availableBalanceEl).grow(100);
        $text(availableBalanceEl).setValue("Available balance: ");
        const availableBalanceValueEl = $text(availableBalanceEl);
        const useAllEl = $button(availableBalanceEl, ["small"]).setValue("SEND ALL");

        $title(c01El).setValue("Priority");
        const prioritySlideEl = $inputSlide(c01El);

        const feeRowEl = $hlist(c01El, ["sub"]);
        $hsep(feeRowEl).grow(100);
        $text(feeRowEl).setValue("Fee: ");
        const feeValueEl = $text(feeRowEl);
        $hsep(feeRowEl).setValue("/");
        const feeValueSecondaryEl = $text(feeRowEl);

        const errorRowEl = $vlist(c01El, ["error"]);
        errorRowEl.hide();

        const confirmBtnEl = Html.$button(c01El).setValue("Confirm and sign");

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
                FEE = tx.fee;
                errorRowEl.hide();
                feeValueEl.setValue(await lq.v(tx.fee, lq.getBaseAsset()).human());
                feeValueSecondaryEl.setValue(await lq.v(tx.fee, lq.getBaseAsset()).human(SECONDARY_CURRENCY));
                if (signAndSend) {
                    if (TO_ADDR !== DUMMY_ADDR) {
                        console.log("Verify");
                        loading("Verifying...");
                        await tx.verify();
                        console.log("Signing...");
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
