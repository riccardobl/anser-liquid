import UIModule from "../UIModule.js";
import Html from "../Html.js";

/**
 * Show the wallet header
 */
export default class HeaderModule extends UIModule {

    constructor() {
        super("header");
    }
  
    onLoad(stage, stageContainerEl, walletEl, lq, ui) {
        const headerEl = Html.$(walletEl, "#header").setPriority(-30);
        Html.$icon(headerEl, "#logo").setValue("wallet")
        Html.$text(headerEl, "#title").setValue("TBD Liquid Wallet");
        Html.$icon(headerEl, "#optionsBtn").setValue("settings").setAction(() => {
            ui.setStage("options");
        });
    }

}