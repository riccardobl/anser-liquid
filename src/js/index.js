if ("serviceWorker" in navigator && location.hostname !== "localhost") {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js");
    });
}

import "../less/style.less";
import LiquidWallet from "./LiquidWallet.js";
import UI from "./ui/UI.js";
import Html from "./ui/Html.js";

/**
 * The entry point for the Liquid Wallet APP
 */

async function main() {
    try {
        // Get the wallet element
        const walletEl = document.body.querySelector("#liquidwallet");
        if (!walletEl) alert("No wallet element found");

        // A container that is vertical in portrait and horizontal in landscape
        const containerEl = Html.$list(walletEl, ["p$v", "l$h", "fillw"], "container");
        containerEl.classList.add("popupContainer");

        // Create and start the wallet
        const lq = new LiquidWallet();
        await lq.start();

        // create the UI
        const ui = new UI(containerEl, walletEl, lq);
        ui.captureOutputs();
        window.dbui = ui;
        window.dblq = lq;
        try {
            ui.useBrowserHistory(); // allow ui to control the browser history (this is used to support the back button)
            ui.setStage("wallet"); // set the initial stage
            lq.addRefreshCallback(() => {
                try {
                    ui.reload();
                } catch (e) {
                    console.error(e);
                }
            }); // refresh the ui when the wallet data changes
        } catch (e) {
            console.error(e);
        }
    } catch (e) {
        console.error(e);
        if (e.cause == "liquid_not_available") {
            window.location.href = "liquidnotfound.html";
        } else {
            alert(e);
        }
    }
}

window.addEventListener("load", main);
