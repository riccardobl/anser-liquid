import BrowserStore from "./BrowserStore.js";
import Constants from "../Constants.js";
/**
 * A backend to store to IndexedDB.
 * Should be slower but has larger storage limit.
 */
export default class IDBStore extends BrowserStore {
    static isSupported() {
        return "indexedDB" in window;
    }
    constructor(prefix, limit) {
        super(prefix, limit);

        const request = indexedDB.open(this.prefix, parseInt(Constants.APP_VERSION));
        request.onupgradeneeded = function (event) {
            const db = event.target.result;
            db.createObjectStore(prefix);
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
            throw new Error("Promise not allowed in db");
        }
        let valueType;
        [value, valueType] = await this._serialize(value);

        const db = await this.dbPromise;
        const transaction = db.transaction(this.prefix, "readwrite");
        const store = transaction.objectStore(this.prefix);
        store.put({ value, valueType }, key);

        await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = reject;
        });
    }

    async _retrieve(key, asDataUrl = false) {
        if (!key) throw new Error("Key is required");

        const db = await this.dbPromise;
        const transaction = db.transaction(this.prefix);
        const store = transaction.objectStore(this.prefix);
        const request = store.get(key);
        const result = await new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = reject;
        });
        const { value, valueType } = result || {};

        if (!value) return undefined;

        return await this._deserialize(value, valueType, asDataUrl);
    }

    async _delete(key) {
        if (!key) throw new Error("Key is required");

        const db = await this.dbPromise;
        const transaction = db.transaction(this.prefix, "readwrite");
        const store = transaction.objectStore(this.prefix);
        store.delete(key);
        await new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = reject;
        });
    }

    async _serialize(value) {
        let valueType = typeof value;
        if (value === undefined || value === null) {
            value = "";
            valueType = "undefined";
        } else if (value instanceof Map) {
            value = Array.from(value.entries());
            value = JSON.stringify(value);
            valueType = "Map";
        } else if (value instanceof Blob) {
            valueType = "Blob";
        } else if (value instanceof Buffer) {
            valueType = value instanceof ArrayBuffer ? "ArrayBuffer" : "Buffer";
            value = value.toString("hex");
        } else if (value instanceof Uint8Array) {
            valueType = "Uint8Array";
            value = JSON.stringify(Array.from(value));
        } else if (valueType == "object") {
            // is array
            if (Array.isArray(value)) {
                const serializedValue = [];
                for (let i = 0; i < value.length; i++) {
                    serializedValue[i] = await this._serialize(value[i], true);
                }
                value = serializedValue;
                valueType = "[]";
            } else {
                const serializedValue = {};
                for (const [key, val] of Object.entries(value)) {
                    serializedValue[key] = await this._serialize(val, true);
                }
                value = serializedValue;
                valueType = "{}";
            }

            value = JSON.stringify(value);
        }

        return [value, valueType];
    }

    async _deserialize(value, valueType, asDataUrl) {
        if (valueType === "undefined") {
            value = undefined;
        } else if (valueType === "number") {
            value = parseFloat(value);
        } else if (valueType === "Blob" && asDataUrl) {
            value = URL.createObjectURL(value);
        } else if (valueType === "Map") {
            value = new Map(JSON.parse(value));
        } else if (valueType === "ArrayBuffer") {
            value = new Uint8Array(Buffer.from(value, "hex")).buffer;
        } else if (valueType === "Buffer") {
            value = Buffer.from(value, "hex");
        } else if (valueType === "Uint8Array") {
            value = new Uint8Array(JSON.parse(value));
        } else if (valueType == "{}") {
            value = JSON.parse(value);
            // if (valueType === "{}") {
            const deserializedValue = {};
            for (const [key, valType] of Object.entries(value)) {
                const [val, type] = valType;
                deserializedValue[key] = await this._deserialize(val, type, true);
            }
            value = deserializedValue;
            // }
        } else if (valueType == "[]") {
            value = JSON.parse(value);
            // if (valueType === "[]") {
            const deserializedValue = [];
            for (let i = 0; i < value.length; i++) {
                const [val, type] = value[i];
                deserializedValue[i] = await this._deserialize(val, type, true);
            }
            value = deserializedValue;
            // }
        }
        return value;
    }

    async _calcSize(value) {
        if (!value) return 0;
        const valueSerialized = await this._serialize(value, typeof value);
        return valueSerialized.length;
    }
}
