
/**
 * Main UI class
 * A UI is composed by two logical parts:
 * - Stages: a stage is a part of the UI that is displayed in the main window, like a page in a website.
 * - Modules: a module is a global component of the ui. It can be enabled or disabled for certain stages, however it is not strictly related to a stage (eg. header, floating buttons etc..) 
 * Modules and stages must be registered before the UI is created.
 * 
 * All stages must go in
 *      ./ui/stages
 * All modules must go in
 *      ./ui/modules
 * And they should be name like this:
 *      [StageName]Stage.js
 *      [ModuleName]Module.js
 * Eg. 
 *      WalletStage.js is for the stage "wallet"
 *      HeaderModule.js is for the module "header"
 */

export default class UI{
    static STAGES=[];
    static registerStage(stageName){ 
        stageName=stageName[0].toUpperCase()+stageName.slice(1);
        this.STAGES.push(import("./stages/"+stageName+"Stage.js").then((module)=>module.default).then((Stage)=>{
            const stage = new Stage();
            return stage;
        }));
    }

    static MODULES=[];
    static registerModule(moduleName){ 
        moduleName=moduleName[0].toUpperCase()+moduleName.slice(1);
        this.MODULES.push(import("./modules/"+moduleName+"Module.js").then((module)=>module.default).then((Module)=>{
            const module = new Module();
           return module;       
        }));
    }

    exportApi(window,lq){
        if(!window.liquid.ui){
            window.liquid.ui = {};
        }        
       // TODO
    }

    constructor(stageContainerEl,walletEl,lq){
        this.stageContainerEl = stageContainerEl;
        this.walletEl = walletEl;
        this.lq=lq;
        this.stageChangeListeners=[];
    }

    addStageChangeListener(listener){
        this.stageChangeListeners.push(listener);
    }

    reload(){
        this.setStage(this.stage);
    }

    useBrowserHistory(){
        window.addEventListener("popstate", (e) => {
            if (e.state && e.state.stage) {
                this.setStage(e.state.stage);
            }
        });
        this.addStageChangeListener((stage)=>{
            window.history.pushState({ stage: stage.getName() }, stage.getName(), "#"+stage.getName());
        });
        
    }
    
    async setStage(stageName){
        const stages=await Promise.all(UI.STAGES);
        const modules = await  Promise.all(UI.MODULES);
        let stage;
        for (let i = 0; i < stages.length;i++){
            if (stages[i].getName() === stageName){
                stage = stages[i];
                break;
            }
        }

        if (!stage){            
            stage=stages[0];
            console.log(stages);
            console.error("Invalid stage", stageName, "use default stage",stage.getName());
        }

        if(this.stage){
            for(const module of modules){
                if (module.isEnabledForStage(this.stage.getName())){
                    module.onUnload(this.stage, this.stageContainerEl, this.walletEl,this.lq, this);     
                }
            }
            this.stage.onUnload(this.stageContainerEl,this.lq, this);
            this.stageContainerEl.classList.remove(this.stage.getName());
            
        }

        this.stageContainerEl.innerHTML="";
        this.stageContainerEl.classList.add("stage");
        this.stageContainerEl.classList.add(stage.getName());
        stage.onReload(this.stageContainerEl,this.lq, this); 
        for(const listener of this.stageChangeListeners){
            listener(stage);
        }
        this.stage=stage;   


        for(const module of modules){
            if (module.isEnabledForStage(stage.getName())){
                module.onLoad(stage, this.stageContainerEl, this.walletEl,this.lq, this);     
            }
        }

    }
}

UI.registerStage("wallet");
UI.registerStage("options");
UI.registerStage("send");
UI.registerStage("receive");
UI.registerModule("header");
UI.registerModule("clarity");