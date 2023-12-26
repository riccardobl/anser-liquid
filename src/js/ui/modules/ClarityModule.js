import Constants from "../../Constants.js";

import UIModule from "./UIModule.js";
import Html from "../../Html.js";

export default class ClarityModule extends UIModule {

    constructor() {
        super("clarity");
    }

    onLoad(stage, stageContainerEl, walletEl, lq, ui) {
        /**
         * When (and only when!) the wallet is used with the testnet 
         * this module records usage data using microsoft clarity.
         * 
         * This tracking code is a powerful debugging tool used during the development to 
         * record and debug issues discovered during tests by external users
         * without the need of asking them to share their screen, logs or 
         * describe accurately the steps to reproduce the issue.
         * 
         * 
         * To protect the user privacy, the tracking code activation is hardcoded and it 
         * is NEVER enabled when using the liquid mainnet.
         */
        const networkName = lq.getNetworkName();
        
        if (networkName != "testnet") return; // hardcoded disable for everything but testnet

        let clarityScriptEl = document.head.querySelector("script#clarity");
        if (!clarityScriptEl) {       
            (function (window, document, clarity, script, tagId) {
                window[clarity] = window[clarity] || function () {
                    (window[clarity].q = window[clarity].q || []).push(arguments);
                };
                var scriptElement = document.createElement(script);
                scriptElement.async = 1;
                scriptElement.src = "https://www.clarity.ms/tag/" + tagId;
                scriptElement.type = "text/javascript";
                scriptElement.id = "clarity";

                var firstScript = document.getElementsByTagName(script)[0];
                firstScript.parentNode.insertBefore(scriptElement, firstScript);
            })(window, document, "clarity", "script", "kbygtg6068");
        }

    }

}

