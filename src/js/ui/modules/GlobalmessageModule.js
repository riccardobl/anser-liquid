import UIModule from "../UIModule.js";
import Html from "../Html.js";
import Constants from "../../Constants.js";

/**
 * Show the wallet header
 */
export default class HeaderModule extends UIModule {
    constructor() {
        super("globalmessage");
    }

    onLoad(stage, stageContainerEl, walletEl, lq, ui) {
        if (Constants.GLOBAL_MESSAGE) {
            const globalMessageEl = Html.$hlist(walletEl, "#globalMessage", []);
            globalMessageEl.setValue(Constants.GLOBAL_MESSAGE);
        }
    }
}
