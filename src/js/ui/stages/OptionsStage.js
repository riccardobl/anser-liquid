import Html from "../Html.js";
import UIStage from "../UIStage.js";
export default class OptionsStage extends UIStage {
    constructor() {
        super("options");
    }



    onReload(containerEl, lq, ui) {
        const listEl=Html.$vlist(containerEl,"#optionsList",["main"]);


    }
}