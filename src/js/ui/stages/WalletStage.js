import Html from "../Html.js";
import UIStage from "../UIStage.js";
import LinkOpener from "../../utils/LinkOpener.js";
import Constants from "../../Constants.js";
export default class WalletPage extends UIStage {
    constructor() {
        super("wallet");
    }

    async renderAssets(parentEl, lq, filter, ui) {
        const assetsEl = Html.$list(parentEl, "#assets", ["main", "p$h", "l$v", "fillw"]);
        Html.enableOutScroll(assetsEl);
        assetsEl.setPriority(-10);
        assetsEl.initUpdate();
        const balance = await lq.getBalance();

        let i = 0;
        await Promise.all(
            balance.map((balance) => {
                const id = "asset" + balance.asset.substr(0, 8) + balance.asset.substr(-8);

                const assetEl = Html.$list(assetsEl, "#" + id, [
                    "asset",
                    "l$h",
                    "p$v",
                    "p$center",
                    "l$right",
                ]);
                const assetC0El = Html.$vlist(assetEl, "#c0", []);
                const assetC1El = Html.$vlist(assetEl, "#c1", []);
                const assetC2El = Html.$vlist(assetEl, "#c2", ["l$right", "p$center"]);

                assetEl.style.setProperty("--anim-delta", i + "s");
                i += 0.1;

                const iconEl = Html.$icon(assetC0El, ".icon", ["big"]);

                const tickerEl = Html.$text(assetC1El, ".ticker", ["title"]);
                const nameEl = Html.$text(assetC1El, ".name", ["sub", "small"]);

                const balanceEl = Html.$text(assetC2El, ".balance");
                const balanceAltCntEl = Html.$hlist(assetC2El, ".balanceAltCnt", ["left"]);
                const balancePrimaryEl = Html.$text(balanceAltCntEl, ".balancePrimary", ["sub"]);
                Html.$text(balanceAltCntEl, ".sep").setValue("/");
                const balanceSecondaryEl = Html.$text(balanceAltCntEl, ".balanceSecondary", ["sub"]);

                lq.v(balance.value, balance.asset)
                    .human()
                    .then((value) => {
                        balanceEl.setValue(value);
                    });

                lq.v(balance.value, balance.asset)
                    .human(lq.getBaseAsset())
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
                    .human("USD")
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
                            console.error(e);
                        }
                    });

                const loadIconPromise = lq
                    .assets()
                    .getAssetIcon(balance.asset)
                    .then((icon) => {
                        console.info("Loading icon", icon, balance);
                        try {
                            iconEl.setSrc(icon);
                            assetEl.setCover(icon);
                        } catch (e) {
                            console.error(e);
                        }
                    });
                return Promise.all([loadInfoPromise, loadIconPromise]);
            }),
        );

        assetsEl.commitUpdate();
    }

    async renderHistoryPanel(parentEl, lq, filter, ui, limit = 100, page = 0) {
        const historyEl = Html.$vlist(parentEl, "#history", ["main", "fillw", "outscroll"]);

        const history = (await lq.getHistory()).slice(page * limit, page * limit + limit);

        historyEl.initUpdate();
        let animDelta = 0;
        for (const tx of history) {
            const id = "history" + (tx.tx_hash.substr(0, 8) + tx.tx_hash.substr(-8));
            const txElCnt = Html.$hlist(historyEl, "#" + id, ["left", "tx"]);
            if (txElCnt.confirmed) continue; // never attempt to update confirmed txs

            if (Constants.EXT_TX_VIEWER) {
                const extViewer = Constants.EXT_TX_VIEWER[lq.getNetworkName()];
                if (extViewer) {
                    txElCnt.setAction(() => {
                        LinkOpener.navigate(extViewer.replace("${tx_hash}", tx.tx_hash));
                    });
                }
            }

            txElCnt.style.setProperty("--anim-delta", animDelta + "s");
            animDelta += 0.2;

            const txDirectionEl = Html.$icon(txElCnt, ".txdirection", ["big"]);
            const txAssetIconEl = Html.$icon(txDirectionEl, ".txasset");

            const txSymbolEl = Html.$text(txElCnt, ".txsymbol");

            const statusTxHashCntEl = Html.$hlist(txElCnt, ".txstatushash", ["sub"]);
            const txHashEl = Html.$text(statusTxHashCntEl, ".txhash", ["toolong"]);
            const txStatusEl = Html.$icon(statusTxHashCntEl, ".txstatus");
            const blockTimeEl = Html.$text(txElCnt, ".txblocktime", ["sub"]);

            const txAmountEl = Html.$text(txElCnt, ".txAmount", []);

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
            txHashEl.setValue(tx.tx_hash.substr(0, 16) + "...");

            lq.getTransaction(tx.tx_hash).then((txData) => {
                blockTimeEl.setValue(new Date(txData.timestamp).toLocaleString());
                txElCnt.setPriority(Math.floor(-(txData.timestamp / 1000)));

                if (!txData.info.valid) {
                    txDirectionEl.setValue("receipt_log");
                    txElCnt.hide();
                } else {
                    if (txData.info.isIncoming) {
                        txDirectionEl.setValue("arrow_downward");
                        txDirectionEl.classList.add("incoming");
                        // lq.assets().getAssetIcon(txData.info.inAsset).then((icon) => {
                        //     txAssetIconEl.setSrc(icon);
                        // });
                        // lq.assets().getAssetInfo(txData.info.inAsset).then(info => {
                        //     if (filter) {
                        //         if (!filter(info.hash, true) && !filter(info.ticker) && !filter(info.name) && !filter(tx.tx_hash, true)) {
                        //             txElCnt.remove();
                        //             return;
                        //         }
                        //     }
                        //     txSymbolEl.setValue(info.ticker);
                        // });
                        // lq.v(txData.info.inAmount, txData.info.inAsset).human().then((value) => {
                        //     txAmountEl.setValue(value);
                        // });
                    } else {
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
                            if (filter) {
                                if (
                                    !filter(info.hash, true) &&
                                    !filter(info.ticker) &&
                                    !filter(info.name) &&
                                    !filter(tx.tx_hash, true)
                                ) {
                                    txElCnt.remove();
                                    return;
                                }
                            }
                            txSymbolEl.setValue(info.ticker);
                        });
                    lq.v(txData.info.outAmount, txData.info.outAsset)
                        .human()
                        .then((value) => {
                            txAmountEl.setValue(value);
                        });
                    // }
                }
            });
        }
        historyEl.commitUpdate();
    }

    async renderBalance(parentEl, lq, ui) {
        const balanceSumCntEl = Html.$vlist(parentEl, "#balanceSumCnt", ["center"]);
        const balanceSumEl = Html.$text(balanceSumCntEl, ".balanceSum", ["titleBig", "center"]);
        const balanceSumSecondaryEl = Html.$hlist(balanceSumCntEl, ".balanceSumAltCnt", ["title", "center"]);
        balanceSumCntEl.setPriority(-20);

        let sumPrimary = 0;
        let sumSecondary = 0;
        let primarySymbol = "";
        let secondarySymbol = "";
        lq.getBalance().then((assets) => {
            for (const asset of assets) {
                lq.v(asset.value, asset.asset)
                    .human(lq.getBaseAsset())
                    .then(async (value) => {
                        [value, primarySymbol] = value.split(" ");
                        sumPrimary += Number(value);
                        balanceSumEl.setValue(
                            await lq
                                .v(
                                    await lq.v(sumPrimary, lq.getBaseAsset()).int(lq.getBaseAsset()),
                                    lq.getBaseAsset(),
                                )
                                .human(lq.getBaseAsset()),
                        );
                    });
                lq.v(asset.value, asset.asset)
                    .human("USD")
                    .then(async (value) => {
                        [value, secondarySymbol] = value.split(" ");
                        sumSecondary += Number(value);

                        balanceSumSecondaryEl.setValue(
                            await lq.v(await lq.v(sumSecondary, "USD").int("USD"), "USD").human("USD"),
                        );
                    });
            }
        });
    }

    async renderSendReceive(parentEl, lq, filter, ui) {
        const cntEl = Html.$hlist(parentEl, "#sendReceive", ["buttons", "fillw", "main"]).setPriority(-15);
        Html.$button(cntEl, ".receive", [])
            .setValue("Receive")
            .setIconValue("arrow_downward")
            .setAction(() => {
                ui.setStage("receive");
            });
        Html.$button(cntEl, ".send", [])
            .setValue("Send")
            .setIconValue("arrow_upward")
            .setAction(() => {
                ui.setStage("send");
            });
    }

    async renderSearchBar(walletEl, lq, render, ui) {
        const searchBarEl = Html.elById(walletEl, "searchBar", ["searchBar", "list"]);
        const searchInputEl = Html.elByClass(searchBarEl, "searchInput", ["input", "listItem"], "input");
        searchInputEl.setAttribute("placeholder", "Search");
        searchInputEl.setAttribute("type", "text");
        searchInputEl.setAttribute("autocomplete", "off");
        searchInputEl.setAttribute("autocorrect", "off");
        searchInputEl.setAttribute("autocapitalize", "off");
        searchInputEl.setAttribute("spellcheck", "false");
        searchBarEl.setPriority(-10);
        let lastValue = "";
        let scheduledTimeout = undefined;
        searchInputEl.addEventListener("input", () => {
            const value = searchInputEl.value;
            if (value === lastValue) return;
            lastValue = value;
            if (scheduledTimeout) clearTimeout(scheduledTimeout);
            scheduledTimeout = setTimeout(() => {
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

                render((str) => {
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
            }, 1000);
        });
    }

    onReload(walletEl, lq, ui) {
        const c0El = Html.$vlist(walletEl, ".c0", ["fillw"]).grow(1);
        const c1El = Html.$vlist(walletEl, ".c1", ["fillw"]).grow(3);
        const render = (filter) => {
            this.renderBalance(c0El, lq, ui);
            this.renderAssets(c0El, lq, filter, ui);

            this.renderSendReceive(c0El, lq, filter, ui);
            this.renderHistoryPanel(c1El, lq, filter, ui);
        };
        this.renderSearchBar(c1El, lq, render, ui);
        render("");

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
