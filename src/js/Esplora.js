import Constants from "./Constants.js";
import fetch from "./utils/fetch-timeout.js";

/**
 * A wrapper around the blockstream ESPLORA API
 * Used to get fee estimates and asset info
 */
export default class Esplora {
    constructor(cache, store, esploraHttps) {
        this.esploraHttps = esploraHttps;
        this.cache = cache;
        this.store = store;
    }

    async query(action, params = {}, method = "GET") {
        let url = this.esploraHttps;
        if (!url.endsWith("/")) url += "/";
        url += action;

        if (method === "GET") {
            const urlObj = new URL(url);
            for (let key in params) {
                urlObj.searchParams.set(key, params[key]);
            }
            url = urlObj.toString();
        }
        const response = await fetch(url, {
            method: method,
            body: method === "GET" ? undefined : JSON.stringify(params),
        }).then((r) => r.json());

        return response;
    }

    async getFee(priority = 1) {
        priority = Math.floor(priority * 10) / 10;
        priority = 1.0 - priority;
        if (priority < 0) priority = 0;
        if (priority > 1) priority = 1;

        let out = await this.cache.get("fee" + priority);
        if (!out) {
            const response = await this.query("fee-estimates");
            const keys = Object.keys(response);
            keys.sort((a, b) => parseInt(a) - parseInt(b));
            const n = keys.length;

            priority = Math.floor(priority * n);
            if (priority >= n) priority = n - 1;

            const selectedKey = keys[priority];
            out = {
                blocks: Number(selectedKey),
                feeRate: Number(response[selectedKey]),
            };

            if (!out.feeRate) {
                console.log("Can't estimate fee, use hardcoded value " + Constants.HARDCODED_FEE);
                out.feeRate = Constants.HARDCODED_FEE;
            }
            if (!out.blocks) {
                out.blocks = 60;
            }

            await this.cache.set("fee" + priority, out, 3000);
        }
        return out;
    }

    async getAssetInfo(assetId) {
        return await this.query("asset/" + assetId);
    }

    async getTxInfo(txId) {
        const info = await this.cache.get("txExtra:" + txId, false, async () => {
            let info = await this.query("tx/" + txId);
            if (info.status.confirmed) {
                return [info, 0];
            } else {
                return [info, 60 * 1000];
            }
        });
        return info;
    }
}
