import Constants from "./Constants.js";
import fetch from "./utils/fetch-timeout.js";
import Icons from "./Icons.js";
import SpecialSymbols from "./SpecialSymbols.js";
/**
 * A wrapper around several apis.
 * Provides pricing for liquid assets, fiat currencies, their icons and other info.
 * Handles also pricing tracking, conversion and formatting.
 */
export default class AssetProvider {
    constructor(
        cache,
        store,
        sideSwap,
        esplora,
        baseAssetId,
        basePrecision,
        baseTicker,
        baseName,
        fiatTickerUrl = "https://blockchain.info/ticker",
        fiatTrackerTimeout = 5 * 60 * 1000,
    ) {
        this.cache = cache;
        this.store = store;
        this.sideSwap = sideSwap;
        this.esplora = esplora;
        this.baseAssetId = baseAssetId;
        this.basePrecision = basePrecision;
        this.baseTicker = baseTicker;
        this.baseName = baseName;
        this.fiatTickerUrl = fiatTickerUrl;
        this.fiatTrackerTimeout = fiatTrackerTimeout;
        this.trackedAssets = [];
        this.trackedFiatAssets = [];
        this.staticIcons = {};
        this.specialSymbols = {};
    }

    async _getFiatData() {
        const fiatTickerUrlDescriber = this.fiatTickerUrl.toLowerCase().replace(/[^a-z0-9]/g, "");
        let fiatData = await this.cache.get("fiat:" + fiatTickerUrlDescriber);
        if (!fiatData || Date.now() - fiatData.timestamp > this.fiatTrackerTimeout) {
            try {
                this.fiatSyncing = true;
                const data = await fetch(this.fiatTickerUrl).then((r) => r.json());
                const timestamp = Date.now();
                fiatData = {
                    timestamp,
                    data,
                };
                await this.cache.set("fiat:" + fiatTickerUrlDescriber, fiatData);
                this.fiatSyncing = false;
            } catch (e) {
                console.log(e);
            }
        }
        return fiatData;
    }

    async _getFiatPrice(fiatTicker) {
        await this._init();
        while (this.fiatSyncing) {
            await new Promise((res) => setTimeout(res, 100));
        }
        const fiatData = await this._getFiatData();
        let price = fiatData && fiatData.data && fiatData.data[fiatTicker] ? fiatData.data[fiatTicker] : 0;
        if (price) price = price.last;

        if (!price || isNaN(price)) return 0;
        price = parseFloat(price);
        return price;
    }

    _isFiat(asset) {
        return asset.length < 4;
    }

    async _init() {
        while (this.starting) {
            console.log("Waiting...");
            await new Promise((res) => setTimeout(res, 100));
        }
        if (this.ready) return;
        try {
            this.starting = true;
            // restore tracked assets
            this.ready = true;

            const trackedAssets = await this.store.get("trackedAssets");
            if (trackedAssets) {
                for (const asset of trackedAssets) {
                    await this.track(asset, true);
                }
            }

            const trackedFiatAssets = await this.store.get("trackedFiatAssets");
            if (trackedFiatAssets) {
                for (const asset of trackedFiatAssets) {
                    await this.track(asset, true);
                }
            }

            this.staticIcons = Icons;
            this.specialSymbols = SpecialSymbols;
        } catch (e) {
            console.error(e);
        } finally {
            this.ready = true;
            this.starting = false;
        }

        this.starting = false;
    }

    async getAllAssets(includeFiat = true) {
        await this._init();
        const out = [];
        const sideswapAsset = await this.sideSwap.getAllAssets();
        for (const k in sideswapAsset) {
            out.push({
                id: k,
                hash: k,
                assetHash: k,
            });
        }
        if (includeFiat) {
            const fiatAssets = await this._getFiatData();
            for (const k in fiatAssets.data) {
                out.push({
                    hash: k,
                    assetHash: k,
                    id: k,
                });
            }
        }
        return out;
    }

    async getTrackedAssets(includeFiat = true) {
        await this._init();

        const out = [];
        const tracked = [this.baseAssetId, ...this.trackedAssets];

        if (includeFiat) tracked.push(...this.trackedFiatAssets);

        for (const asset of tracked) {
            const d = {};
            // d.price=this.getPrice(1,asset,indexCurrency);
            // d.info=this.getAssetInfo(asset);
            // d.icon=this.getAssetIcon(asset);
            // d.getValue = (currencyHash, floatingPoint = true) => {
            //     return this.assetProvider.getPrice(assetData.value, asset, currencyHash, floatingPoint);
            // };
            d.id = asset;
            d.hash = asset;
            d.assetHash = asset;
            out.push(d);
        }
        return out;
    }

    async getAssetIcon(assetId) {
        await this._init();
        let icon = this.staticIcons[assetId];
        if (!icon) {
            icon = await this.cache.get(
                "icon:" + assetId,
                true,
                async () => {
                    const assets = await this.sideSwap.getAllAssets();
                    const asset = assets[assetId];
                    if (!asset) return undefined;
                    const iconB64 = asset.icon;
                    const iconArrayBuffer = Uint8Array.from(atob(iconB64), (c) => c.charCodeAt(0));
                    const iconBlob = new Blob([iconArrayBuffer], { type: "image/png" });
                    return [iconBlob, 0];
                },
                true,
            );
            console.log("Found icon", icon);
        }
        console.log("Not found icon,try static", this.staticIcons);
        if (!icon) {
            icon = this.staticIcons["unknown"];
        }
        return icon;
    }

    async _getAssetPrice(assetHash) {
        let price = await this.cache.get("p:" + assetHash);
        if (!price) {
            price = await this.sideSwap.getAssetPrice(assetHash);
            await this.cache.set("p:" + assetHash, price);
        }
        return price;
    }

    async track(assetHash, noInit = false) {
        if (!noInit) await this._init();
        if (assetHash === this.baseAssetId) return;
        if (this._isFiat(assetHash)) {
            if (this.trackedFiatAssets.indexOf(assetHash) < 0) {
                this.trackedFiatAssets.push(assetHash);
                await this.store.set("trackedFiatAssets", this.trackedFiatAssets);
            }
            return;
        }

        if (this.trackedAssets.indexOf(assetHash) >= 0) return;

        this.trackedAssets.push(assetHash);
        await this.store.set("trackedAssets", this.trackedAssets);

        let first = true;
        return new Promise((res, rej) => {
            const trackerCallback = async (price, baseAssetId) => {
                await this.cache.set("p:" + assetHash, price);
                if (first) {
                    res(price);
                    first = false;
                }
            };
            if (!this.trackerCallbacks) this.trackerCallbacks = {};
            this.trackerCallbacks[assetHash] = trackerCallback;
            this.sideSwap.subscribeToAssetPriceUpdate(assetHash, trackerCallback);
        });
    }

    async untrack(assetHash) {
        if (assetHash === this.baseAssetId) return;
        if (this._isFiat(assetHash)) return;
        const index = this.trackedAssets.indexOf(assetHash);
        if (index < 0) return;
        this.trackedAssets.splice(index, 1);
        await this.store.set("trackedAssets", this.trackedAssets);
        const trackerCallback = this.trackerCallbacks[assetHash];
        if (trackerCallback) {
            this.sideSwap.unsubscribeFromAssetPriceUpdate(assetHash, trackerCallback);
            delete this.trackerCallbacks[assetHash];
        }
    }

    async intToFloat(amount, assetHash) {
        if (typeof assetHash !== "string") throw new Error("Invalid asset hash " + assetHash);
        await this._init();
        const info = await this.getAssetInfo(assetHash);
        const precision = info.precision;
        let price = amount;
        price = amount / 10 ** precision;
        return price;
    }

    async floatToInt(amount, assetHash) {
        if (typeof assetHash !== "string") throw new Error("Invalid asset hash " + assetHash);
        await this._init();
        const info = await this.getAssetInfo(assetHash);
        const precision = info.precision;
        let price = amount;
        price = Math.floor(amount * 10 ** precision);
        return price;
    }

    async floatToStringValue(v, assetHash) {
        const info = await this.getAssetInfo(assetHash);
        let symbol = info.ticker;
        const precision = info.precision;
        let symbolBeforeValue = false;

        if (this.specialSymbols[symbol]) {
            symbolBeforeValue = true;
            symbol = this.specialSymbols[symbol];
        }

        const isFiat = this._isFiat(assetHash);
        // if isFiat keep only 2 decimal, otherwise keep 6
        let clippedV = v;
        if (isFiat) {
            clippedV = clippedV.toFixed(2);
        } else {
            clippedV = clippedV.toFixed(6);
        }

        if (Number(clippedV) == 0 && Number(v) != 0) {
            clippedV = "0.000001";
            clippedV = "< " + clippedV;
        }
        v = clippedV;

        // v = Number(v) + "";
        // let decs;
        // [v, decs] = v.split(".");
        // if (!decs || decs.length < 2) decs = "00";
        // v = v + "." + decs;
        if (symbol) {
            v = symbolBeforeValue ? symbol + " " + v : v + " " + symbol;
        }
        return v;
    }

    /*
     * @param {Number} amount - amount of asset
     * @param {String} asset - asset hash
     * @param {String} targetAsset - asset hash
     * @param {Boolean} floatingPoint - if true, returns floating point number, otherwise integer
     * @param {Boolean} asString - if true, returns string, otherwise number
     * @returns {Number|String} price
     * */
    async getPrice(amount, asset, targetAsset) {
        if (typeof asset !== "string") throw new Error("Invalid asset hash " + asset);
        if (!targetAsset) targetAsset = this.baseAssetId;

        if (typeof targetAsset !== "string") throw new Error("Invalid targetAsset hash");

        await this._init();

        if (asset === targetAsset) return amount;

        const priceOf = async (asset) => {
            if (asset === this.baseAssetId) {
                return 1 * 10 ** this.basePrecision;
            }
            let fl;
            if (this._isFiat(asset)) {
                fl = 1 / (await this._getFiatPrice(asset));
            } else {
                fl = 1 / (await this._getAssetPrice(asset));
            }
            if (fl < 0 || fl == Infinity || fl == NaN) return 0;
            return fl * 10 ** this.basePrecision;
        };

        await this.track(asset);
        await this.track(targetAsset);

        const price1 = await this.intToFloat(await priceOf(asset), this.baseAssetId);
        const price2 = await this.intToFloat(await priceOf(targetAsset), this.baseAssetId);

        const cnvRate = price1 / price2;

        amount = await this.intToFloat(amount, asset);
        const converted = amount * cnvRate;
        console.log(
            "CONVERSION ",
            amount + " " + asset + " = " + converted + " " + targetAsset,
            "Conversion rate " + cnvRate,
            "Price of " + asset + " " + price1,
            "Price of " + targetAsset + " " + price2,
        );

        const p = await this.floatToInt(converted, targetAsset);
        if (isNaN(p) || p == Infinity || p < 0) {
            return 0;
        }
        return p;
    }

    async getAssetInfo(assetId) {
        await this._init();
        if (assetId === this.baseAssetId) {
            return {
                precision: this.basePrecision,
                ticker: this.baseTicker,
                name: this.baseName,
                hash: this.baseAssetId,
            };
        }
        if (this._isFiat(assetId)) {
            return {
                precision: 2,
                ticker: assetId,
                name: assetId,
                hash: assetId,
            };
        }
        let info = await this.cache.get("as:" + assetId);
        if (!info) {
            const response = await this.esplora.getAssetInfo(assetId);
            const precision = response.precision || 0;
            const ticker = response.ticker || "???";
            const name = response.name || "???";
            info = { precision, ticker, name, hash: assetId };

            await this.cache.set("as:" + assetId, info);
        }
        return info;
    }
}
