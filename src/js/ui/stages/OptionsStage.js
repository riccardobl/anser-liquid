import LinkOpener from "../../utils/LinkOpener.js";
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
import UIStage from "../UIStage.js";

export default class OptionsStage extends UIStage {
    constructor() {
        super("options");
    }

    onReload(containerEl, lq, ui) {
        containerEl.resetState();
        const optionsEl = $vlist(containerEl).makeScrollable().fill();
        $text(optionsEl).setValue("Primary currency: ");
        const primaryAssetSelector = $inputSelect(optionsEl, "Select Asset");
        $vsep(optionsEl);
        $text(optionsEl).setValue("Secondary currency: ");
        const secondaryAssetSelector = $inputSelect(optionsEl, "Select Asset");
        $vsep(optionsEl);
        $text(optionsEl).setValue("Theme: ");
        const themeSelector = $inputSelect(optionsEl, "Select Theme");
        $vsep(optionsEl);
        $text(optionsEl).setValue("Pinned assets: ");
        const pinnedAssetsSelector = $inputSelect(optionsEl, "Select Assets", [], true);
        $vsep(optionsEl);
        $text(optionsEl).setValue("Do you like the app?");
        const sponsorRowEl = $hlist(optionsEl).fill();

        $button(sponsorRowEl)
            .setValue("Zap")
            .setAction(() => {
                LinkOpener.navigate("https://getalby.com/p/rblb");
            })
            .setIconValue("flash_on");

        $button(sponsorRowEl)
            .setValue("Sponsor")
            .setAction(() => {
                LinkOpener.navigate("https://github.com/sponsors/riccardobl");
            })
            .setIconValue("favorite");

        $vsep(optionsEl);

        $button(optionsEl)
            .setValue("Report an issue")
            .setAction(() => {
                LinkOpener.navigate("https://github.com/riccardobl/anser-liquid/issues/new");
            });

        $button(optionsEl)
            .setValue("Clear Cache")
            .setAction(async () => {
                await lq.clearCache();
                alert("Cache cleared");
                window.location.reload();
            });
        $vsep(optionsEl);
        const gpuModel = $text(optionsEl, ["sub"]);
        ui.getGPUModel().then((model) => {
            gpuModel.setValue(`GPU: ${model}`);
        });

        ui.getCurrentTheme().then((currentTheme) => {
            const themeEl = themeSelector;
            themeEl.setPreferredValues([currentTheme]);
            for (const theme of ui.listThemes()) {
                themeEl.addOption(theme, theme, () => {
                    ui.setTheme(theme);
                });
            }
        });

        ui.storage().then(async (store) => {
            const network = await lq.getNetworkName();
            const primaryCurrency = (await store.get(`primaryCurrency${network}`)) || lq.getBaseAsset();
            const secondaryCurrency = (await store.get(`secondaryCurrency${network}`)) || "USD";

            primaryAssetSelector.setPreferredValues([primaryCurrency]);
            secondaryAssetSelector.setPreferredValues([secondaryCurrency]);

            const currencies = await lq.getAvailableCurrencies();
            for (const currency of currencies) {
                const info = await lq.assets().getAssetInfo(currency.hash);
                const icon = await lq.assets().getAssetIcon(currency.hash);
                const optionEl = primaryAssetSelector.addOption(currency.hash, info.ticker, async () => {
                    const store = await ui.storage();
                    store.set(`primaryCurrency${network}`, currency.hash);
                });
                optionEl.setIconSrc(icon);
                const optionEl2 = secondaryAssetSelector.addOption(currency.hash, info.ticker, async () => {
                    const store = await ui.storage();
                    store.set(`secondaryCurrency${network}`, currency.hash);
                });
                optionEl2.setIconSrc(icon);
            }
        });
        const loadAssetOptions = async () => {
            const inputSelEl = pinnedAssetsSelector;
            inputSelEl.clearOptions();
            const pinned = await lq.getPinnedAssets();
            const available = await lq.getAvailableCurrencies(false);
            for (const asset of available) {
                Promise.all([
                    lq.assets().getAssetInfo(asset.hash),
                    lq.assets().getAssetIcon(asset.hash),
                ]).then(([info, icon]) => {
                    const optionEl = inputSelEl.addOption(
                        asset.hash,
                        info.ticker,
                        async (values) => {
                            for (const k in values) {
                                if (!values[k]) {
                                    console.log("Unpin", k);
                                    await lq.unpinAsset(k);
                                } else {
                                    await lq.pinAsset(k);
                                }
                            }
                        },
                        pinned.includes(asset.hash),
                    );
                    optionEl.setIconSrc(icon);
                });
            }
            inputSelEl.setPreferredValues(pinned.map((a) => a.hash));
        };

        loadAssetOptions();
    }
}
