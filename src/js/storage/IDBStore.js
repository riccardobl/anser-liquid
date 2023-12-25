import BrowserStore from "./BrowserStore.js";
export default class IDBStore extends BrowserStore {
    static isSupported() {
        return false&&'indexedDB' in window;
    }
    constructor(prefix, limit) {
        super(prefix, limit);
        const request = indexedDB.open(this.prefix, 1);
        request.onupgradeneeded = function (event) {
            const db = event.target.result;
            db.createObjectStore('store');
        };
        this.dbPromise = new Promise((resolve, reject) => {
            request.onsuccess = function (event) {
                resolve(event.target.result);
            };
            request.onerror = function (event) {
                reject(event.target.error);
            };
        });
    }

    async _store(key, value) {
        if (!value) return;
        if (!key) throw new Error("Key is required");

        if (value instanceof Promise || key instanceof Promise) {
            console.trace();
            throw new Error("Promise not allowed in db");
        }
        let valueType;
        [value, valueType] = await this._serialize(value);
        


        const db = await this.dbPromise;
        const transaction = db.transaction('store', 'readwrite');
        const store = transaction.objectStore('store');
        console.log("putting", { value, valueType }, key   )
        store.put({ value, valueType }, key);
        await transaction.complete;
    }

    async _retrieve(key, asDataUrl = false) {
        if (!key) throw new Error("Key is required");

        const db = await this.dbPromise;
        const transaction = db.transaction('store');
        const store = transaction.objectStore('store');
        const { value, valueType } = await store.get(key) || {};

        if (!value) return undefined;

        return await this._deserialize(value, valueType, asDataUrl);
    }

    async _delete(key) {
        if (!key) throw new Error("Key is required");

        const db = await this.dbPromise;
        const transaction = db.transaction('store', 'readwrite');
        const store = transaction.objectStore('store');
        store.delete(key);
        await transaction.complete;
    }

    async _serialize(value) {
        let valueType = typeof value;
        if (valueType === "object") {
            if (value instanceof Map) {
                value = Array.from(value.entries());
                valueType = "Map";
            } else if (value instanceof Blob) {
                valueType = "Blob";
            } else if (value instanceof Buffer) {
                valueType = value instanceof ArrayBuffer ? "ArrayBuffer":"Buffer";
                value=value.toString('hex');
            } else {
                value = JSON.stringify(value);
            }
        }
        return [value, valueType];
    }

    async _deserialize(value, valueType, asDataUrl) {
        if (valueType === "number") {
            value = parseFloat(value);
        } else if (valueType === "boolean") {
            value = value === "true";
        } else if (valueType === "Blob" && asDataUrl) {
            value = URL.createObjectURL(value);
        } else if (valueType === "Map") {
            value = new Map(value);
        }else if (valueType === "ArrayBuffer") {
            value = new Uint8Array(Buffer.from(value, 'hex')).buffer;
        }else if(valueType === "Buffer") {
            value = Buffer.from(value, 'hex');        
        }else if (valueType !== "string" && valueType !== "number" && valueType !== "boolean" && !(value instanceof Blob) && !(value instanceof ArrayBuffer)) {
            value = JSON.parse(value);
        }
        return value;
    }
        


    async _calcSize(value) {
        if (!value) return 0;
        const valueSerialized = await this._serialize(value, typeof value);
        return valueSerialized.length;
    }



}