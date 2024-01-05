import Html from "../Html.js";
import UIStage from "../UIStage.js";
import Constants from "../../Constants.js";
import jsQR from "jsqr-es6";

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
    $newPopup,
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
        let PRIORITY = 0.5;

        let SECONDARY_CURRENCY = secondaryCurrency;
        let SECONDARY_INFO = await lq.assets().getAssetInfo(secondaryCurrency);

        const DUMMY_ADDR = Constants.DUMMY_OUT_ADDRESS[network];
        let TO_ADDR = DUMMY_ADDR;
        let FEE = 0;

        const c00El = $vlist(walletEl).fill().makeScrollable();
        const c000El = $list(c00El, ["p$v", "l$h", "l$baselineAlign"]).fill();
        const c02El = $vlist(c000El, ["main"]).makeScrollable().fill();
        const c01El = $vlist(c000El, ["main"]).makeScrollable().fill();
        const c03El = $vlist(c00El, ["bottom"]).fill();

        $title(c02El).setValue("Asset");

        const assetInputEl = $inputSelect(c02El, "Select Asset");

        $title(c01El).setValue("To");

        const addrEl = $inputText(c01El).setPlaceHolder("Address");

        $text(c01El, ["warning"]).setValue(
            `
        <span>
        Please ensure that the receiver address is on the <b>${await lq.getNetworkName()}</b> network. 
        </span>
                `,
            true,
        );

        $icon(addrEl)
            .setValue("qr_code_scanner")
            .setAction(async () => {
                const qrScanViewer = $newPopup(walletEl, "Scan QR Code", [], "qrScan");
                const mediaContainer = $vlist(qrScanViewer).fill();
                let videoEl = mediaContainer.querySelector("video");
                if (!videoEl) {
                    videoEl = document.createElement("video");
                    mediaContainer.addItem(videoEl);
                }

                const constraints = {
                    video: {
                        facingMode: "environment",
                    },
                };
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                videoEl.srcObject = stream;
                videoEl.setAttribute("playsinline", true);
                videoEl.play();

                $button(qrScanViewer, [])
                    .setValue("Close")
                    .setAction(() => {
                        stream.getTracks().forEach((track) => track.stop());
                        videoEl.srcObject = null;
                        qrScanViewer.hide();
                    });

                const canvasEl = document.createElement("canvas");
                canvasEl.width = videoEl.videoWidth;
                canvasEl.height = videoEl.videoHeight;
                const ctx = canvasEl.getContext("2d");

                requestAnimationFrame(tick);

                async function tick() {
                    if (videoEl.readyState === videoEl.HAVE_ENOUGH_DATA) {
                        canvasEl.height = videoEl.videoHeight;
                        canvasEl.width = videoEl.videoWidth;
                        ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
                        const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
                        const code = jsQR(imageData.data, imageData.width, imageData.height);
                        if (code) {
                            console.log("Found QR code", code.data);
                            let addr = code.data.trim();
                            if (
                                !addr.startsWith(Constants.PAYURL_PREFIX[network]) &&
                                !(await lq.verifyAddress(addr))
                            ) {
                                addr = undefined;
                            }
                            if (addr) {
                                addrEl.setValue(addr);
                                stream.getTracks().forEach((track) => track.stop());
                                videoEl.srcObject = null;
                                qrScanViewer.hide();
                                return;
                            }
                        }
                    }

                    requestAnimationFrame(tick);
                }
                qrScanViewer.show();
            });

        $icon(addrEl)
            .setValue("content_paste")
            .setAction(async () => {
                const text = await navigator.clipboard.readText();
                addrEl.setValue(text);
            });

        $title(c02El).setValue("Amount");

        const amountNativeEl = $inputNumber(c02El).setPlaceHolder("0.00");
        const ticker1El = $text(amountNativeEl);

        const amountSecondaryEl = $inputNumber(c02El).setPlaceHolder("0.00");
        const ticker2El = $text(amountSecondaryEl);

        const availableBalanceDataEl = $vlist(c02El, ["sub"]).fill();
        const availableBalanceLabelRowEl = $hlist(availableBalanceDataEl, ["sub"]);
        $hsep(availableBalanceLabelRowEl).grow(100);

        const availableBalanceTextEl = $text(availableBalanceLabelRowEl).setValue("Available balance: ");

        const availableBalanceEl = $hlist(availableBalanceDataEl, ["sub"]);
        $hsep(availableBalanceEl).grow(100);
        const availableBalanceValueEl = $text(availableBalanceEl);

        const useAllEl = $button(availableBalanceEl, ["small"]).setValue("SEND ALL");

        $title(c01El).setValue("Fee");
        const prioritySlideEl = $inputSlide(c01El);
        prioritySlideEl.setLabel(0, "Low (slow)");
        prioritySlideEl.setLabel(0.5, "Medium");
        prioritySlideEl.setLabel(1, "High (fast)");
        const feeDataEl = $vlist(c01El, []).fill();

        const feeRowEl = $hlist(feeDataEl, ["sub"]);
        $hsep(feeRowEl).grow(100);
        $text(feeRowEl).setValue("Fee: ");
        const feeValueEl = $text(feeRowEl);
        $hsep(feeRowEl).setValue("/");
        const feeValueSecondaryEl = $text(feeRowEl);
        const timeRowEl = $hlist(feeDataEl, ["sub"]);
        $hsep(timeRowEl).grow(100);
        $text(timeRowEl).setValue("Confirmation time: ~");
        const timeValueEl = $text(timeRowEl).setValue("10");
        $hsep(timeRowEl).setValue("minutes");

        const errorRowEl = $vlist(c03El, ["error"]);
        errorRowEl.hide();

        const confirmBtnEl = Html.$button(c03El, []).setValue("Confirm and sign");

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
            availableBalanceTextEl.setValue("Available balance (" + ASSET_INFO.ticker + "): ");
            if (INPUT_AMOUNT <= 0) {
                loading("Enter a valid amount...");

                return;
            }
            try {
                const feeRate = await lq.estimateFeeRate(PRIORITY);
                const tx = await lq.prepareTransaction(INPUT_AMOUNT, ASSET_HASH, TO_ADDR, feeRate.feeRate);
                FEE = tx.fee;
                errorRowEl.hide();
                feeValueEl.setValue(await lq.v(tx.fee, lq.getBaseAsset()).human());
                feeValueSecondaryEl.setValue(await lq.v(tx.fee, lq.getBaseAsset()).human(SECONDARY_CURRENCY));

                const time = Constants.BLOCK_TIME[network] * feeRate.blocks;
                timeValueEl.setValue(time / 1000 / 60);

                if (signAndSend) {
                    if (TO_ADDR != DUMMY_ADDR) {
                        console.log("Verify");
                        loading("Verifying...");
                        await tx.verify();
                        console.log("Signing...");
                        console.log("Broadcast");
                        const txid = await tx.broadcast();
                        if (!txid) throw new Error("Transaction not broadcasted");
                        const sendOkPopupEl = $newPopup(
                            walletEl,
                            "Transaction broadcasted",
                            ["sendOK"],
                            "sendOK",
                        );
                        $icon(sendOkPopupEl, ["sendok", "icon"]).setValue("done");
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
            PRIORITY = Math.max(v, 0.001);
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
                            amountNativeEl.setValue(0);
                            amountSecondaryEl.setValue(0);
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

            if (query.assetid) {
                assetInputEl.selectOption(query.assetid);
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
