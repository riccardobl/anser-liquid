import UIModule from "../UIModule.js";
import Html from "../Html.js";

/**
 * Show the wallet header
 */
export default class HeaderModule extends UIModule {
    constructor() {
        super("logo");
    }

    onLoad(stage, stageContainerEl, walletEl, lq, ui) {
        const logoEl = Html.$hlist(walletEl, [], "logo").setPriority(-30);
        logoEl.setCover("static/icons/lw.png");
        setTimeout(() => {
            logoEl.style.display = "none";
        }, 2500);
    }
}
