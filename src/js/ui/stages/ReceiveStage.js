import Html from "../Html.js";
import UIStage from "../UIStage.js";
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
export default class ReceiveStage extends UIStage {
    constructor() {
        super("receive");
    }

    async renderReceive(stageCntEl, lq, ui) {
        stageCntEl.resetState();
        const network = await lq.getNetworkName();
        const store = await ui.storage();
        const primaryCurrency = (await store.get(`primaryCurrency${network}`)) || lq.getBaseAsset();
        const secondaryCurrency = (await store.get(`secondaryCurrency${network}`)) || "USD";

        let ASSET_HASH = primaryCurrency;
        let ASSET_INFO = await lq.assets().getAssetInfo(primaryCurrency);
        let INPUT_AMOUNT = 0;

        let SECONDARY_CURRENCY = secondaryCurrency;
        let SECONDARY_INFO = await lq.assets().getAssetInfo(secondaryCurrency);

        const c0 = $vlist(stageCntEl).fill().makeScrollable();
        const c1 = $vlist(stageCntEl).grow(100).fill().makeScrollable();

        const assetSelector = $inputSelect(c0, "Select Asset");
        $vsep(c0);
        const invoiceQr = $hlist(c0);

        const invoiceTx = Html.$inputText(c0).setEditable(false);

        $icon(invoiceTx)
            .setAction(() => {
                navigator.clipboard.writeText(invoiceTx.getValue());
                ui.info("Copied to clipboard");
            })
            .setValue("content_copy");

        $title(c1).setValue("Settings");
        const amountPrimaryEl = $inputNumber(c1).grow(50).setPlaceHolder("0.00");
        const tickerEl = $text(amountPrimaryEl).setValue(ASSET_INFO.ticker);

        const amountSecondaryEl = Html.$inputNumber(c1).grow(50).setPlaceHolder("0.00");
        const tickerEl2 = $text(amountSecondaryEl).setValue(SECONDARY_INFO.ticker);

        // const tickerEl = Html.$text(amountPrimaryRow, ".asset", ["center", "enforceSmallWidth"]).grow(5);

        // const amountSecondaryRow = Html.$hlist(c02El, "#amountCntS", ["fillw"]);
        // const amountSecondaryEl = Html.$inputNumber(amountSecondaryRow, ".amountInput")
        //     .grow(50)
        //     .setPlaceHolder("0.00");
        // const tickerEl2 = Html.$text(amountSecondaryRow, ".asset", ["center", "enforceSmallWidth"]).grow(5);

        $text(c1, ["warning"]).setValue(
            `
        <span>
        Please ensure that the sender is on the <b>${await lq.getNetworkName()}</b> network.
        </span>
                `,
            true,
        );
        // const warningRowEl = Html.$vlist(c02El, "#warningNetwork", ["fillw", "warning"]);
        // warningRowEl.setValue(
        //     `
        // <span>
        // Please ensure that the sender is on the <b>${await lq.getNetworkName()}</b> network.
        // </span>
        //         `,
        //     true,
        // );
        const _updateInvoice = async () => {
            if (!ASSET_HASH || !ASSET_INFO) return; // if unset do nothing
            const { addr, qr } = await lq.receive(INPUT_AMOUNT, ASSET_HASH); // create invoice
            $img(invoiceQr, ["qr", "invoiceQr"], "qr").setSrc(qr); // show qr
            invoiceTx.setValue(addr); // show copyable address
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

        // // load currencies async and list for changes
        lq.getPinnedAssets().then((assets) => {
            for (const asset of assets) {
                lq.assets()
                    .getAssetInfo(asset.hash)
                    .then((info) => {
                        const optionEl = assetSelector.addOption(asset.hash, info.ticker, async (value) => {
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
