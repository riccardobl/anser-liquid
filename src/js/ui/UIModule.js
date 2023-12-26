

export default class UIModule{
    constructor(name,stageWhitelist){
        this.name=name;
        this.stageWhitelist=stageWhitelist;
    }

    getName(){
        return this.name;
    }

    /**
     * Check if the module can be enabled when a stage is loaded.
     * @param {*} stageName 
     * @returns 
     */
    isEnabledForStage(stageName){
        return this.stageWhitelist?this.stageWhitelist.includes(stageName):true;
    }

    /**
     * Unload the module
     * @param {*} stage 
     * @param {*} stageContainerEl 
     * @param {*} walletEl 
     * @param {*} lq 
     * @param {*} ui 
     */
    onUnload(stage, stageContainerEl, walletEl, lq, ui) {
    }

    /**
     * Load the module
     * @param {*} stage 
     * @param {*} containerEl 
     * @param {*} lq 
     * @param {*} ui 
     */
    onLoad(stage,containerEl,lq,ui){
        throw new Error("Not implemented");
    }
}