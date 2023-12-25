import BrowserStore from "./BrowserStore.js";
export default class LocalStore extends BrowserStore {
    static isSupported() {
        return 'localStorage' in window;
    }

    constructor(prefix,limit) {
        super(prefix,limit);     
    }

    async _serialize(value){
        let valueType = typeof value;
        if (valueType === "string") value = value;
        else if (valueType === "number") value = value.toString();
        else if (valueType === "boolean") value = value.toString();
        else if (valueType === "object" && value instanceof Blob) {
            const blobType = value.type;
            const reader = new FileReader();
            reader.readAsDataURL(value);
            const blobData = await new Promise((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
            });
            valueType="Blob";
            value = JSON.stringify({ blobType, blobData });
        }
        else if (valueType === "object" && value instanceof Map) {
            value = JSON.stringify(Array.from(value.entries()));
            valueType = "Map"
        }
        else if (valueType === "object" && value instanceof Buffer) {
            value = value.toString("hex");
            const isArrayBuffer = value instanceof ArrayBuffer;
            valueType = isArrayBuffer?"ArrayBuffer":"Buffer";
        }else if (valueType === "object" && value instanceof Uint8Array) {
            value = JSON.stringify(value);
            valueType = "Uint8Array";
        }
        else value = JSON.stringify(value);
        return [value,valueType];
    }

    async _deserialize(value, valueType, asDataUrl){
        if (valueType === "string") value = value;
        else if (valueType === "number") value = parseFloat(value);
        else if (valueType === "boolean") value = value === "true";
        else if (valueType === "Blob") {
            value = JSON.parse(value);
            const blobType = value.blobType;
            const blobData = value.blobData;

            // Convert base64 to Blob
            const byteCharacters = atob(blobData.split(',')[1]);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: blobType });

            if (asDataUrl) {
                return URL.createObjectURL(blob);
            } else {
                return blob;
            }
        }
        else if (valueType === "Map") value = new Map(JSON.parse(value));
        else if (valueType === "ArrayBuffer") {
            value = Buffer.from(value,"hex");
            value = new Uint8Array(value).buffer;
        }else if(valueType === "Buffer") value = Buffer.from(value,"hex");
        else if (valueType === "Uint8Array") value = new Uint8Array(JSON.parse(value));
        else value = JSON.parse(value);
        return value;
    }

    async    _store(key,value){
        if(!value)return;
        if(!key)throw new Error("Key is required");
        if(!this.typeTable){
            this.typeTable=new Map();
            const typeTable = localStorage.getItem(`${this.prefix}:s:typeTable`);
            if(typeTable){
                const entries=JSON.parse(typeTable);
                for(const [key,value] of entries){
                    this.typeTable.set(key,value);
                }
            }
        }
        if (value instanceof Promise || key instanceof Promise) {
            console.trace();
            throw new Error("Promise not allowed in db");
        }

        let valueType;
        [value,valueType]=await this._serialize(value);
        

        if (valueType) {
            this.typeTable.set(key, valueType);
            localStorage.setItem(`${this.prefix}:s:typeTable`, JSON.stringify(Array.from(this.typeTable.entries())));
        }

        localStorage.setItem(`${this.prefix}:${key}`, value);
    }

    async _retrieve(key,asDataUrl=false){
        if (!key) throw new Error("Key is required");

        if(!this.typeTable){
            this.typeTable=new Map();
            const typeTable = localStorage.getItem(`${this.prefix}:s:typeTable`);
            if(typeTable){
                const entries=JSON.parse(typeTable);
                for(const [key,value] of entries){
                    this.typeTable.set(key,value);
                }
            }
        }
        let value = localStorage.getItem(`${this.prefix}:${key}`);
        if(!value)return value;
        const valueType = this.typeTable.get(key);

        value = await this._deserialize(value, valueType, asDataUrl);       
        return value;
        
    }

    async _delete(key){
        if (!key) throw new Error("Key is required");

        this.typeTable.delete(key);
        localStorage.removeItem(`${this.prefix}:${key}`);

    }


    async _calcSize( value) {
        if(!value)return 0;
        const valueSerialized=await this._serialize(value,typeof value);
        return valueSerialized.length;
    }


    
}