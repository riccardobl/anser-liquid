import BrowserStore from "./BrowserStore.js";
export default class LocalStore extends BrowserStore {
    constructor(limit) {
        super(limit);     
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
        else if (valueType === "object" && value instanceof ArrayBuffer) {
            value = JSON.stringify(new Uint8Array(value));
            valueType = "ArrayBuffer"
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
        else if (valueType === "ArrayBuffer") value = JSON.parse(value).buffer;
        else value = JSON.parse(value);
        return value;
    }

    async    _store(key,value){
        if(!value)return;
        if(!key)throw new Error("Key is required");
        if(!this.typeTable){
            this.typeTable=new Map();
            const typeTable=localStorage.getItem("s:typeTable");
            if(typeTable){
                const entries=JSON.parse(typeTable);
                for(const [key,value] of entries){
                    this.typeTable.set(key,value);
                }
            }
        }
        let valueType;
        [value,valueType]=await this._serialize(value);
        if (valueType) {
            this.typeTable.set(key, valueType);
            localStorage.setItem("s:typeTable", JSON.stringify(Array.from(this.typeTable.entries())));
        }

        localStorage.setItem(key, value);
    }

    async _retrieve(key,asDataUrl=false){
        if (!key) throw new Error("Key is required");

        if(!this.typeTable){
            this.typeTable=new Map();
            const typeTable=localStorage.getItem("s:typeTable");
            if(typeTable){
                const entries=JSON.parse(typeTable);
                for(const [key,value] of entries){
                    this.typeTable.set(key,value);
                }
            }
        }
        let value=localStorage.getItem(key);
        if(!value)return value;
        const valueType = this.typeTable.get(key);

        value = await this._deserialize(value, valueType, asDataUrl);       
        return value;
        
    }

    async _delete(key){
        if (!key) throw new Error("Key is required");

        this.typeTable.delete(key);
        localStorage.removeItem(key);

    }


    async _calcSize( value) {
        if(!value)return 0;
        const valueSerialized=await this._serialize(value,typeof value);
        return valueSerialized.length;
    }


    
}