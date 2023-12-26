

export default class UIModule{
    constructor(name,stageWhitelist){
        this.name=name;
        this.stageWhitelist=stageWhitelist;
    }

    isEnabledForStage(stageName){
        return this.stageWhitelist?this.stageWhitelist.includes(stageName):true;
    }

    onUnload(stage, stageContainerEl, walletEl, lq, ui) {
    }

    onLoad(stage,containerEl,lq,ui){
        throw new Error("Not implemented");
    }
}