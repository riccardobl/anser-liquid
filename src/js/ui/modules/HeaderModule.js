import UIModule from "../UIModule.js";
import Html from "../Html.js";
import Constants from "../../Constants.js";

/**
 * Show the wallet header
 */
export default class HeaderModule extends UIModule {

    constructor() {
        super("header");
    }
  
    onLoad(stage, stageContainerEl, walletEl, lq, ui) {
        const headerEl = Html.$hlist(walletEl, "#header").setPriority(-30);
        headerEl.setCover("static/icons/lwheader.png")
        // Html.$icon(headerEl, "#logo").setSrc("static/icons/lw.png")
        Html.$text(headerEl, "#title").setValue("TBD Liquid Wallet");
        if (stage.getName()!="wallet") {
            Html.$icon(headerEl, "#optionsBtn").setValue("arrow_back").setAction(() => {
                ui.setStage("wallet");
            });
        }else{
            Html.$icon(headerEl, "#optionsBtn").setValue("settings").setAction(() => {
                ui.setStage("options");
            });
        }

      
    }

}