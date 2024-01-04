import Html from "../Html.js";
import UIStage from "../UIStage.js";
import LinkOpener from "../../utils/LinkOpener.js";
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

export default class WalletPage extends UIStage {
    constructor() {
        super("wallet");
    }

    async renderAssets(parentEl, lq, filter, ui) {
        const network = await lq.getNetworkName();
        const store = await ui.storage();
        const primaryCurrency = (await store.get(`primaryCurrency${network}`)) || lq.getBaseAsset();
        const secondaryCurrency = (await store.get(`secondaryCurrency${network}`)) || "USD";

        const assetsEl = $list(parentEl, ["main", "highlight", "p$h", "l$v"], "assets").makeScrollable(
            true,
            true,
        );
        assetsEl.setPriority(-10);
        assetsEl.initUpdate();

        const balance = await lq.getBalance();
        let i = 0;
        await Promise.all(
            balance.map((balance) => {
                const id = "asset" + balance.asset.substr(0, 8) + balance.asset.substr(-8);

                const assetEl = $list(assetsEl, ["asset", "l$h", "p$v", "p$center", "l$right"], id);
                const assetC0El = $vlist(assetEl, []);
                const assetC1El = $vlist(assetEl, []);
                const assetC2El = $vlist(assetEl, ["l$right", "p$center"]);

                assetEl.style.setProperty("--anim-delta", i + "s");
                i += 0.1;

                const iconEl = $icon(assetC0El, ["big"]);

                const tickerEl = $text(assetC1El, ["title", "ticker"]);
                const nameEl = $text(assetC1El, ["sub", "small", "name"]);

                const balanceEl = $text(assetC2El, ["balance"]);
                const balanceAltCntEl = $hlist(assetC2El, ["balanceAltCnt", "left"]);
                const balancePrimaryEl = $text(balanceAltCntEl, ["sub"]);
                $text(balanceAltCntEl).setValue("/");
                const balanceSecondaryEl = $text(balanceAltCntEl, ["sub"]);

                lq.v(balance.value, balance.asset)
                    .human(balance.asset, false)
                    .then((value) => {
                        balanceEl.setValue(value);
                    });

                lq.v(balance.value, balance.asset)
                    .human(primaryCurrency)
                    .then((price) => {
                        if (price) {
                            balancePrimaryEl.setValue(price);
                            assetEl.setPriority(-Math.floor(Number(price.split(" ")[0]) * 100000));
                        } else {
                            assetEl.setPriority(0);
                            balancePrimaryEl.setValue("-");
                        }
                    });

                lq.v(balance.value, balance.asset)
                    .human(secondaryCurrency)
                    .then((price) => {
                        if (price) {
                            balanceSecondaryEl.setValue(price);
                        } else {
                            balanceSecondaryEl.setValue("-");
                        }
                    });

                const loadInfoPromise = lq
                    .assets()
                    .getAssetInfo(balance.asset)
                    .then((info) => {
                        try {
                            if (filter) {
                                if (
                                    !filter(balance.hash, true) &&
                                    !filter(info.ticker) &&
                                    !filter(info.name)
                                ) {
                                    assetEl.remove();
                                    return;
                                }
                            }
                            tickerEl.setValue(info.ticker);
                            nameEl.setValue(info.name);
                        } catch (e) {
                            console.log(e);
                        }
                    });

                const loadIconPromise = lq
                    .assets()
                    .getAssetIcon(balance.asset)
                    .then((icon) => {
                        console.log("Loading icon", icon, balance);
                        try {
                            iconEl.setSrc(icon);
                            assetEl.setCover(icon);
                        } catch (e) {
                            console.log(e);
                        }
                    });
                return Promise.all([loadInfoPromise, loadIconPromise]);
            }),
        );

        assetsEl.commitUpdate();
    }

    async renderHistoryPanel(parentEl, lq, filter, ui, forceRefresh = false, limit = 100, page = 0) {
        filter = this.filter;
        const historyEl = $vlist(parentEl, ["main", "highlight"], "history")
            .makeScrollable(true, true)
            .fill();

        const history = await lq.getHistory(); //.slice(page * limit, page * limit + limit); TODO: pagination

        historyEl.initUpdate();
        let animDelta = 0;
        for (const tx of history) {
            const id = "history" + (tx.tx_hash.substr(0, 8) + tx.tx_hash.substr(-8));
            const txElCnt = $hlist(historyEl, ["left", "tx"], id);
            if (!forceRefresh && txElCnt.confirmed) continue; // never attempt to update confirmed txs

            if (Constants.EXT_TX_VIEWER) {
                const extViewer = Constants.EXT_TX_VIEWER[lq.getNetworkName()];
                if (extViewer) {
                    txElCnt.setAction(() => {
                        LinkOpener.navigate(extViewer.replace("${tx_hash}", tx.tx_hash));
                    });
                }
            }

            txElCnt.style.setProperty("--anim-delta", animDelta + "s");
            // animDelta += 0.2;

            const txDirectionEl = $icon(txElCnt, ["big", "txdirection"]);
            const txAssetIconEl = $icon(txDirectionEl, ["txasset"]);

            const txSymbolEl = $text(txElCnt, ["txsymbol"]);

            const statusTxHashCntEl = $hlist(txElCnt, ["txstatushash", "sub"]);
            const txHashEl = $text(statusTxHashCntEl, ["txhash", "toolong"]);
            const txStatusEl = $icon(statusTxHashCntEl, ["txstatus"]);
            const blockTimeEl = $text(txElCnt, ["txblocktime", "sub"]);
            const txAmountEl = $text(txElCnt, ["txAmount"]);

            if (tx.confirmed) {
                txStatusEl.setValue("done");
                txStatusEl.classList.remove("loading");
                txElCnt.classList.add("confirmed");
                txElCnt.confirmed = true;
            } else {
                txStatusEl.setValue("cached");
                txStatusEl.classList.add("loading");
                txElCnt.classList.remove("confirmed");
                txElCnt.confirmed = false;
            }

            requestAnimationFrame(async () => {
                let txElCntWidth;
                // for (let i = 0; i < 100; i++) {
                txElCntWidth = historyEl.getBoundingClientRect().width;
                // if (txElCntWidth > 10) break;
                // await new Promise((r) => setTimeout(r, 100));
                // }

                txHashEl.setValue(
                    tx.tx_hash.substring(
                        0,
                        Math.floor(txElCntWidth / parseFloat(getComputedStyle(txHashEl).fontSize) / 2),
                    ) + "...",
                );
            });

            lq.getTransaction(tx.tx_hash).then((txData) => {
                blockTimeEl.setValue(new Date(txData.timestamp).toLocaleString());
                txElCnt.setPriority(Math.floor(-(txData.timestamp / 1000)));

                if (!txData.info.valid) {
                    txDirectionEl.setValue("receipt_log");
                    txElCnt.hide();
                } else {
                    if (txData.info.isIncoming) {
                        txElCnt.classList.add("incoming");
                        txDirectionEl.setValue("arrow_downward");
                        txDirectionEl.classList.add("incoming");
                    } else {
                        txElCnt.classList.add("outgoing");
                        txDirectionEl.setValue("arrow_upward");
                        txDirectionEl.classList.add("outgoing");
                    }
                    lq.assets()
                        .getAssetIcon(txData.info.outAsset)
                        .then((icon) => {
                            txAssetIconEl.setSrc(icon);
                        });
                    lq.assets()
                        .getAssetInfo(txData.info.outAsset)
                        .then((info) => {
                            console.log("Info ", filter);
                            if (filter) {
                                console.log(
                                    "Filtering",
                                    info.ticker,
                                    info.name,
                                    tx.tx_hash,
                                    info.hash,
                                    filter(info.hash, true),
                                    filter(info.ticker),
                                    filter(info.name),
                                    filter(tx.tx_hash, true),
                                );

                                if (
                                    !filter(info.hash, true) &&
                                    !filter(info.ticker) &&
                                    !filter(info.name) &&
                                    !filter(tx.tx_hash, true)
                                ) {
                                    txElCnt.hide();
                                    return;
                                } else {
                                    txElCnt.show();
                                }
                            } else {
                            }
                            txSymbolEl.setValue(info.ticker);
                        });
                    lq.v(txData.info.outAmount, txData.info.outAsset)
                        .human(txData.info.outAsset, false)
                        .then((value) => {
                            txAmountEl.setValue(value);
                        });
                }
            });
        }
        historyEl.commitUpdate();
    }

    async renderBalance(parentEl, lq, ui) {
        const network = await lq.getNetworkName();
        const store = await ui.storage();
        const primaryCurrency = (await store.get(`primaryCurrency${network}`)) || lq.getBaseAsset();
        const secondaryCurrency = (await store.get(`secondaryCurrency${network}`)) || "USD";

        const balanceSumCntEl = $vlist(parentEl, ["center"], "balanceSumCnt");
        const balanceSumEl = $text(balanceSumCntEl, ["balanceSum", "titleBig", "center"]);
        const balanceSumSecondaryEl = $hlist(balanceSumCntEl, ["balanceSumAltCnt", "title", "center"]);
        balanceSumCntEl.setPriority(-20);

        let sumPrimary = 0;
        let sumSecondary = 0;

        lq.getBalance().then((assets) => {
            for (const asset of assets) {
                lq.v(asset.value, asset.asset)
                    .float(primaryCurrency)
                    .then(async (value) => {
                        sumPrimary += value;
                        const v = await lq
                            .v(await lq.v(sumPrimary, primaryCurrency).int(primaryCurrency), primaryCurrency)
                            .human(primaryCurrency);
                        balanceSumEl.setValue(v < 0 || v > Infinity ? "0" : v);
                    });
                lq.v(asset.value, asset.asset)
                    .float(secondaryCurrency)
                    .then(async (value) => {
                        sumSecondary += Number(value);
                        const v = await lq
                            .v(
                                await lq.v(sumSecondary, secondaryCurrency).int(secondaryCurrency),
                                secondaryCurrency,
                            )
                            .human(secondaryCurrency);
                        balanceSumSecondaryEl.setValue(v < 0 || v > Infinity ? "0" : v);
                    });
            }
        });
    }

    async renderSendReceive(parentEl, lq, filter, ui) {
        const cntEl = $hlist(parentEl, ["buttons", "fillw", "main", "highlight"], "sendReceive")
            .setPriority(-15)
            .fill();
        $button(cntEl, [])
            .setValue("Receive")
            .setIconValue("arrow_downward")
            .setAction(() => {
                ui.setStage("receive");
            });
        $button(cntEl, [])
            .setValue("Send")
            .setIconValue("arrow_upward")
            .setAction(() => {
                ui.setStage("send");
            });
    }

    async renderSearchBar(walletEl, lq, render, ui) {
        const searchBarParentEl = $hlist(walletEl, ["searchBar", "main", "highlight"])
            .setPriority(-10)
            .fill();
        const searchInputEl = $inputText(searchBarParentEl).setPlaceHolder("Search");
        searchInputEl.setAttribute("autocomplete", "off");
        searchInputEl.setAttribute("autocorrect", "off");
        searchInputEl.setAttribute("autocapitalize", "off");
        searchInputEl.setAttribute("spellcheck", "false");
        // searchInputEl.setPriority(-10);
        let lastValue = "";
        let scheduledTimeout = undefined;
        const searchIcon = $icon(searchInputEl, ["search"]).setValue("search");

        searchInputEl.addEventListener("input", () => {
            searchIcon.setValue("cached");
            searchIcon.classList.add("loading");
        });

        searchInputEl.setAction(async (lastValue) => {
            // set loading icon

            // const value = searchInputEl.value;
            // if (value === lastValue) return;
            // lastValue = value;
            // if (scheduledTimeout) clearTimeout(scheduledTimeout);
            // scheduledTimeout = setTimeout(() => {
            let words = "";
            let partial = true;
            lastValue = lastValue.trim();

            if (lastValue[0] === '"' && lastValue[lastValue.length - 1] === '"') {
                words = [lastValue.substring(1, lastValue.length - 1).trim()];
                partial = false;
            } else {
                words = lastValue.split(" ").filter((w) => w.trim().length > 0);
                partial = true;
            }

            await render((str) => {
                str = str.toLowerCase().trim();
                if (words.length === 0) return true;
                for (const word of words) {
                    if (partial) {
                        if (str.includes(word)) {
                            return true;
                        }
                    } else {
                        if (str === word) {
                            return true;
                        }
                    }
                }
                return false;
            });

            // remove loading icon
            searchIcon.setValue("search");
            searchIcon.classList.remove("loading");
            // }, 1000);
        });
    }

    onReload(walletEl, lq, ui) {
        walletEl.resetState();
        const c0El = $vlist(walletEl, []).grow(1).fill();
        const c1El = $vlist(walletEl, []).grow(3).fill();
        const render = (filter) => {
            if (filter) this.filter = filter;
            this.renderBalance(c0El, lq, ui);
            this.renderAssets(c0El, lq, filter, ui);

            this.renderSendReceive(c0El, lq, filter, ui);
            this.renderHistoryPanel(c1El, lq, filter, ui, !!filter);
        };
        this.renderSearchBar(c1El, lq, render, ui);
        render();

        if (walletEl.historyReloadCallbackTimer) {
            clearTimeout(walletEl.historyReloadCallbackTimer);
        }

        const historyReloadCallback = async () => {
            this.renderHistoryPanel(c1El, lq, undefined, ui);
            walletEl.historyReloadCallbackTimer = setTimeout(historyReloadCallback, 10000);
        };
        setTimeout(historyReloadCallback, 10000);
    }

    onUnload(walletEl, lq, ui) {
        if (walletEl.historyReloadCallbackTimer) {
            clearTimeout(walletEl.historyReloadCallbackTimer);
        }
    }
}
