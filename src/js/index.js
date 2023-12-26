
import LiquidProvider from "./LiquidWallet.js";
import UI from "./ui/UI.js";
import Html from "./Html.js";



async function main() {
    const walletEl = document.body.querySelector("#liquidwallet");
    if (!walletEl) alert("No wallet element found")
    const containerEl = Html.$list(walletEl, "#container",["p$v","l$h","fillw"]);
    containerEl.id = "container";
    walletEl.appendChild(containerEl);

    const lq = new LiquidProvider();
    await lq.start();
    lq.exportApi(window);

    const ui = new UI(containerEl, walletEl, lq);
    lq.addRefreshCallback(ui.reload);
    ui.setStage("send");
    ui.useBrowserHistory();

    window.lq = lq;
}


window.addEventListener("load", main);