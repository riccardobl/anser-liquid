export default class UIStage    {
    constructor(name){
        this.name=name;
    }
    getName(){
        return this.name;
    }
    onReload(containerEl,lq,ui){
        throw new Error("Not implemented");
    }
    onUnload(containerEl,lq,ui){
     
    }
}