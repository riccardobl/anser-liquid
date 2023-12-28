import Constants from "../Constants.js";
import IDBStore from "./IDBStore.js";
import MemStore from "./MemStore.js";
import LocalStore from "./LocalStore.js";
/**
 * A browser storage class that supports several backend.
 * It can track memory usage, expiration and delete old entries.
 * Supports all serializable objects, Map, Buffer, Uint8Array, ArrayBuffer, Blob, undefined, null and primitive types.
 */
export default class BrowserStore {
    static async best(prefix = "", limit = 100 * 1024 * 1024, byspeed = false) {
        const methods = {
            IDBStore: IDBStore,
            MemStore: MemStore,
            LocalStore: LocalStore,
        };
        for (const storageMethod of byspeed
            ? Constants.STORAGE_METHODS_BY_SPEED
            : Constants.STORAGE_METHODS) {
            try {
                const StorageMethod = methods[storageMethod];
                if (StorageMethod && StorageMethod.isSupported()) {
                    return new StorageMethod(prefix, limit);
                }
            } catch (e) {
                console.error(e);
            }
        }
        console.error("No storage methods available");
        const s = methods["MemStore"];
        return new s(prefix, limit);
    }

    static async fast(prefix = "", limit = 100 * 1024 * 1024) {
        return this.best(prefix, limit, true);
    }
}
