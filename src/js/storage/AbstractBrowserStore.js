import Constants from "../Constants.js";
/**
 * A browser storage class that supports several backend.
 * It can track memory usage, expiration and delete old entries.
 * Supports all serializable objects, Map, Buffer, Uint8Array, ArrayBuffer, Blob, undefined, null and primitive types.
 */
export default class AbstractBrowserStore {
    // default limit = 100 mb
    constructor(prefix, limit) {
        this.limit = limit;
        this.prefix = prefix;
    }

    async _init() {
        while (this.starting) {
            console.log("Waiting...");
            await new Promise((res) => setTimeout(res, 100));
        }
        if (this.ready) return;
        try {
            this.starting = true;

            this.accessTable = await this._retrieve("s:accessTable");

            this.expirationTable = await this._retrieve("s:expirationTable");
            this.sizeTable = await this._retrieve("s:sizeTable");
            if (!this.accessTable) {
                this.accessTable = new Map();
            }
            if (!this.expirationTable) {
                this.expirationTable = new Map();
            }
            if (!this.sizeTable) {
                this.sizeTable = new Map();
            }
            this.ready = true;
            this.starting = false;
        } catch (e) {
            alert(e);
            console.error(e);
        } finally {
            this.ready = true;
            this.starting = false;
        }
    }

    async _store(key, value) {
        throw new Error("Not implemented");
    }

    async _retrieve(key, asDataUrl = false) {
        throw new Error("Not implemented");
    }

    async _delete(key) {
        throw new Error("Not implemented");
    }

    async _calcSize(key, value) {
        throw new Error("Not implemented");
    }

    async getUsedMemory() {
        await this._init();
        let size = 0;
        for (let [key, value] of this.sizeTable) {
            size += value;
        }
        return size;
    }

    async set(key, value, expiration = 0) {
        await this._init();

        if (key.startsWith("s:")) throw new Error("Key cannot start with s:");
        if (!value) {
            console.log("Setting " + key + " to null");
            console.trace();
        }

        if (!value) {
            await this._delete(key);
            this.accessTable.delete(key);
            this.expirationTable.delete(key);
            this.sizeTable.delete(key);
        } else {
            const entrySize = await this._calcSize(key, value);
            if (this.limit) {
                while ((await this.getUsedMemory()) + entrySize > this.limit) {
                    await this.deleteOldestAccess();
                }
            }
            await this._store(key, value);
            // localStorage.setItem(key, JSON.stringify(value));
            this.accessTable.set(key, Date.now());
            if (expiration) this.expirationTable.set(key, Date.now() + expiration);
            else this.expirationTable.delete(key);
            this.sizeTable.set(key, entrySize);
        }
        this._store("s:accessTable", this.accessTable);
        this._store("s:expirationTable", this.expirationTable);
        this._store("s:sizeTable", this.sizeTable);
        // localStorage.setItem('accessTable', JSON.stringify(Array.from(this.accessTable.entries())));
        // localStorage.setItem('expirationTable', JSON.stringify(Array.from(this.expirationTable.entries())));
        // localStorage.setItem('sizeTable', JSON.stringify(Array.from(this.sizeTable.entries())));
    }

    async clear() {
        await this._init();

        const keys = this.accessTable.keys();
        console.log(keys);

        for (const key of keys) {
            if (key.startsWith("s:")) continue;
            console.log("Clearing " + key);
            await this.set(key, null);
        }
    }

    async get(key, asDataUrl = false, refreshCallback = undefined, waitForRefresh = undefined) {
        await this._init();

        if (key.startsWith("s:")) throw new Error("Key cannot start with s:");

        let value = await this._retrieve(key, asDataUrl);

        if (value) {
            this.accessTable.set(key, Date.now());
            this._store("s:accessTable", this.accessTable);
        }

        const expire = this.expirationTable.get(key);
        if (!value || (expire && expire < Date.now())) {
            if (refreshCallback) {
                let refreshed = Promise.resolve(refreshCallback());
                refreshed = refreshed.then(async (data) => {
                    if (!data) return undefined;
                    const [value, expire] = data;
                    if (value) {
                        await this.set(key, value, expire);
                    } else {
                        await this.set(key, null);
                    }
                    return value;
                });
                if (!value || waitForRefresh) {
                    value = await refreshed;
                    value = await this._retrieve(key, asDataUrl);
                }
            } else {
                if (!value) await this.set(key, null);
                value = null;
            }
        }
        // localStorage.setItem('accessTable', JSON.stringify(Array.from(this.accessTable.entries())));
        return value;
    }

    async deleteOldestAccess() {
        await this._init();
        let oldestKey = null;
        let oldestAccess = Infinity;
        for (let [key, access] of this.accessTable) {
            if (key.startsWith("s:")) continue;
            if (access < oldestAccess) {
                oldestAccess = access;
                oldestKey = key;
            }
        }
        await this.set(oldestKey, null);
    }
}
