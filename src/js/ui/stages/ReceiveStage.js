import Html from "../Html.js";
import UIStage from "../UIStage.js";

export default class ReceiveStage extends UIStage {
    constructor() {
        super("receive");
    }
    async renderReceive(stageCntEl, lq, ui) {
        const network = await lq.getNetworkName();
        const store = await ui.storage();
        const primaryCurrency = (await store.get(`primaryCurrency${network}`)) || lq.getBaseAsset();
        const secondaryCurrency = (await store.get(`secondaryCurrency${network}`)) || "USD";

        let ASSET_HASH = primaryCurrency;
        let ASSET_INFO = await lq.assets().getAssetInfo(primaryCurrency);
        let INPUT_AMOUNT = 0;

        let SECONDARY_CURRENCY = secondaryCurrency;
        let SECONDARY_INFO = await lq.assets().getAssetInfo(secondaryCurrency);

        const c01El = Html.$vlist(stageCntEl, ".c0", ["fillw", "outscroll"]);
        const c02El = Html.$vlist(stageCntEl, ".c1", ["fillw", "outscroll"]).grow(2);

        // @@@@@@@@@@@@@@@@@@@@@@@@@
        // @@@@ ASSET SELECTION @@@@
        // @@@@@@@@@@@@@@@@@@@@@@@@@
        const assetInputEl = Html.$inputSelect(c01El, "#asset", "Select Asset");
        Html.$vsep(c01El, "#sep1");

        // @@@@@@@@@@@@
        // @@@@ QR @@@@
        // @@@@@@@@@@@@
        const qrContainerEl = Html.$hlist(c01El, "#invoice", ["center"]);

        // @@@@ @@@@@@@@@@@@@@@@@@@@@ @@@@
        // @@@@ ADDRESS @ COPY_BUTTON @@@@
        // @@@@ @@@@@@@@@@@@@@@@@@@@@ @@@@
        // addr
        const addrContainerEl = Html.$hlist(c02El, "#addr", ["fillw"]);
        // copy
        const addrEl = Html.$inputText(addrContainerEl, ".addr").grow(100);
        Html.$icon(addrContainerEl, ".copy", ["enforceSmallWidth"])
            .setValue("content_copy")
            .setAction(() => {
                navigator.clipboard.writeText(addrEl.getValue());
                alert("copied");
            })
            .shrink(100);

        // @@@@@@@@@@@@@@@@@@@@@@@@
        // @@@@ TITLE_SETTINGS @@@@
        // @@@@@@@@@@@@@@@@@@@@@@@@
        // Html.$title(c02El, "#amountTitle").setValue("Invoice Settings");

        // @@@@@@@@@@@@@@@@@@@@@@@
        // @@ AMOUNT @ CURRENCY @@
        // @@@@@@@@@@@@@@@@@@@@@@@
        // Html.$vsep(c02El, "#sep2");
        // Html.$text(c02El, ".label").setValue("Amount: ");

        Html.$text(c02El, ".label").setValue("Settings: ");
        const amountPrimaryRow = Html.$hlist(c02El, "#amountCnt", ["fillw"]);
        const amountPrimaryEl = Html.$inputNumber(amountPrimaryRow, ".amountInput")
            .grow(50)
            .setPlaceHolder("0.00");
        const tickerEl = Html.$text(amountPrimaryRow, ".asset", ["center", "enforceSmallWidth"]).grow(5);

        const amountSecondaryRow = Html.$hlist(c02El, "#amountCntS", ["fillw"]);
        const amountSecondaryEl = Html.$inputNumber(amountSecondaryRow, ".amountInput")
            .grow(50)
            .setPlaceHolder("0.00");
        const tickerEl2 = Html.$text(amountSecondaryRow, ".asset", ["center", "enforceSmallWidth"]).grow(5);

        const warningRowEl = Html.$vlist(c02El, "#warningNetwork", ["fillw", "warning"]);
        warningRowEl.setValue(
            `
        <span>
        Please ensure that the sender is on the <b>${await lq.getNetworkName()}</b> network. 
        </span>
                `,
            true,
        );
        const _updateInvoice = async () => {
            if (!ASSET_HASH || !ASSET_INFO) return; // if unset do nothing
            const { addr, qr } = await lq.receive(INPUT_AMOUNT, ASSET_HASH); // create invoice
            Html.$img(qrContainerEl, ".qr", ["invoiceQr"]).setSrc(qr); // show qr
            addrEl.setValue(addr); // show copyable address
        };

        amountPrimaryEl.setAction(async (primaryValue) => {
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

            amountPrimaryEl.setValue(primaryValueFloat, true);

            const primaryValueInt = await lq.v(primaryValueFloat, ASSET_HASH).int(ASSET_HASH);
            INPUT_AMOUNT = primaryValueInt;
            _updateInvoice();
        });

        tickerEl.setValue(ASSET_INFO.ticker);
        tickerEl2.setValue(SECONDARY_INFO.ticker);
        // load currencies async and list for changes
        lq.getPinnedAssets().then((assets) => {
            for (const asset of assets) {
                lq.assets()
                    .getAssetInfo(asset.hash)
                    .then((info) => {
                        const optionEl = assetInputEl.addOption(asset.hash, info.ticker, async (value) => {
                            ASSET_HASH = value;
                            ASSET_INFO = await lq.assets().getAssetInfo(value);
                            tickerEl.setValue(ASSET_INFO.ticker);
                            tickerEl2.setValue(SECONDARY_INFO.ticker);
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

        _updateInvoice();
    }

    onReload(walletEl, lq, ui) {
        this.renderReceive(walletEl, lq, ui);
    }
}
