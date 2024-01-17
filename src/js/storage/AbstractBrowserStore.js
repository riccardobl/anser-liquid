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
        this.locks = {};
    }

    async lock(key) {
        let t = 1;
        while (this.locks[key]) {
            await new Promise((resolve) => setTimeout(resolve, t));
            t *= 2;
            if (t > 100) t = 100;
        }
        this.locks[key] = true;
    }

    unlock(key) {
        delete this.locks[key];
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
        }

        if (!value) {
            await this._delete(key);
            await this._setAccessTime(key, undefined);
            await this._setExpiration(key, undefined);
            await this._setSize(key, undefined);
        } else {
            const entrySize = await this._calcSize(key, value);
            if (this.limit) {
                while ((await this.getUsedMemory()) + entrySize > this.limit) {
                    await this.deleteOldestAccess();
                }
            }
            await this._store(key, value);
            await this._setAccessTime(key, Date.now());
            await this._setExpiration(key, expiration ? Date.now() + expiration : undefined);
            await this._setSize(key, entrySize);
        }
    }

    async _setAccessTime(key, time) {
        await this._init();
        await this.lock("s:");
        try {
            if (time) this.accessTable.set(key, time);
            else this.accessTable.delete(key);
            await this._store("s:accessTable", this.accessTable);
        } finally {
            this.unlock("s:");
        }
    }

    async _setExpiration(key, time) {
        await this._init();
        await this.lock("s:");
        try {
            if (time) this.expirationTable.set(key, time);
            else this.expirationTable.delete(key);
            await this._store("s:expirationTable", this.expirationTable);
        } finally {
            this.unlock("s:");
        }
    }

    async _setSize(key, size) {
        await this._init();
        await this.lock("s:");
        try {
            if (size) this.sizeTable.set(key, size);
            else this.sizeTable.delete(key);
            await this._store("s:sizeTable", this.sizeTable);
        } finally {
            this.unlock("s:");
        }
    }

    async clear() {
        await this._init();
        const keys = this.accessTable.keys();
        for (const key of keys) {
            if (key.startsWith("s:")) continue;
            console.log("Clearing " + key);
            await this.set(key, null);
        }
    }

    async get(key, asDataUrl = false, refreshCallback = undefined, waitForRefresh = undefined) {
        await this._init();

        if (key.startsWith("s:")) throw new Error("Key cannot start with s:");

        let value;
        let exists = this.accessTable.has(key) && this.sizeTable.has(key);
        if (!exists) {
            await this.set(key, undefined);
            value = undefined;
        } else {
            value = await this._retrieve(key, asDataUrl);
        }

        if (value) {
            await this._setAccessTime(key, Date.now());
        }

        const expire = this.expirationTable.get(key);
        if (!value || (expire && expire < Date.now())) {
            console.log("Refreshing " + key);
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
