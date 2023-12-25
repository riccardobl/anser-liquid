import BrowserStore from "./BrowserStore.js";
export default class MemStore extends BrowserStore {
    static isSupported() {
        return true;
    }

    constructor(prefix, limit) {
        super(prefix, limit);
        this.store = {};
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
         

        this.store[key] = { value, valueType };
    }

    async _retrieve(key, asDataUrl = false) {
        if (!key) throw new Error("Key is required");

        const { value, valueType } = this.store[key] || {};

        if (!value) return value;

        return await this._deserialize(value, valueType, asDataUrl);
    }

    async _delete(key) {
        if (!key) throw new Error("Key is required");

        delete this.store[key];
    }

    async _serialize(value) {
        let valueType = typeof value;
        if (valueType === "object") {
            if (value instanceof Map) {
                // value = value;
                valueType = "Map";
            } else if (value instanceof Blob) {
                valueType = "Blob";
            } else if (value instanceof ArrayBuffer) {
                valueType = "ArrayBuffer";
            } else {
                // value = value;
            }
        }
        return [value, valueType];
    }

    async _deserialize(value, valueType, asDataUrl) {
        if (valueType === "number") {
            // value = parseFloat(value);
        } else if (valueType === "boolean") {
            // value = value === "true";
        } else if (valueType === "Blob" && asDataUrl) {
            value = URL.createObjectURL(value);
        } else if (valueType === "Map") {
            // value = new Map(value);
        } else if (valueType !== "string" && valueType !== "number" && valueType !== "boolean" && !(value instanceof Blob) && !(value instanceof ArrayBuffer)) {
            // value = value;
        }
        return value;
    }



    async _calcSize(value) {
        if (!value) return 0;
        const valueSerialized = await this._serialize(value, typeof value);
        return valueSerialized.length;
    }



}