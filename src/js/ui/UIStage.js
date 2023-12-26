export default class UIStage    {
    constructor(name){
        this.name=name;
    }
    getName(){
        return this.name;
    }
    
    /**
     * On stage load or reload.
     * Stages should be able to reload without losing state.
     * @param {*} containerEl 
     * @param {*} lq 
     * @param {*} ui 
     */
    onReload(containerEl,lq,ui){
        throw new Error("Not implemented");
    }
    /**
     * On stage unload.
     * This is used if the stage needs to clean after itself.
     * Normally this is not needed for simple DOM output, since the DOM is automatically
     * cleared when the stage is unloaded.
     * @param {*} containerEl 
     * @param {*} lq 
     * @param {*} ui 
     */
    onUnload(containerEl,lq,ui){
     
    }
}