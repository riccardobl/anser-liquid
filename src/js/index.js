import "../less/style.less";
import LiquidWallet from "./LiquidWallet.js";
import UI from "./ui/UI.js";
import Html from "./ui/Html.js";

/**
 * The entry point for the Liquid Wallet APP
 */

async function main() {
    // Get the wallet element
    const walletEl = document.body.querySelector("#liquidwallet");
    if (!walletEl) alert("No wallet element found");

    // A container that is vertical in portrait and horizontal in landscape
    const containerEl = Html.$list(walletEl, "#container", ["p$v", "l$h", "fillw"]);
    containerEl.classList.add("popupContainer");

    // Create and start the wallet
    const lq = new LiquidWallet();
    await lq.start();

    // export the window.liquid apis
    // actually, this is not needed here, just showing how to do it
    lq.exportApi(window);

    // create the UI
    const ui = new UI(containerEl, walletEl, lq);
    ui.useBrowserHistory(); // allow ui to control the browser history (this is used to support the back button)
    ui.setStage("wallet"); // set the initial stage
    lq.addRefreshCallback(() => {
        ui.reload();
    }); // refresh the ui when the wallet data changes

    window.lq = lq; // debug api export, you can use this in the browser console
    window.lqui = ui; // debug api export, you can use this in the browser console
    window.setStage = (stage) => {
        // debug api export, you can use this in the browser console
        ui.setStage(stage);
    };
}

window.addEventListener("load", main);
