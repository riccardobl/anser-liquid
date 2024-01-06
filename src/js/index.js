if ("serviceWorker" in navigator && location.hostname !== "localhost") {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js");
    });
}

import "../less/style.less";
import LiquidWallet from "./LiquidWallet.js";
import UI from "./ui/UI.js";
import Html from "./ui/Html.js";
import LinkOpener from "./utils/LinkOpener.js";

/**
 * The entry point for the Liquid Wallet APP
 */

async function versionCheck(ui) {
    try {
        const currentVersion = await fetch("version.txt").then((r) => r.text());
        const latestGithubReleaseData = await fetch(
            "https://api.github.com/repos/riccardobl/anser-liquid/releases/latest",
        ).then((r) => r.json());
        if (!latestGithubReleaseData.tag_name) throw new Error("Cannot get latest version from github");
        const latestVersion = latestGithubReleaseData.tag_name;
        if (currentVersion != latestVersion) {
            const alertEl = ui.info(
                "New version available: " + latestVersion + ". Click here to visit the release page.",
            );
            alertEl.addEventListener("click", () => {
                LinkOpener.navigate(latestGithubReleaseData.html_url);
            });
        }
    } catch (e) {
        console.log(e);
    }
}

async function main() {
    try {
        // Get the wallet element
        const walletEl = document.body.querySelector("#liquidwallet");
        if (!walletEl) alert("No wallet element found");

        // A container that is vertical in portrait and horizontal in landscape
        const containerEl = Html.$list(walletEl, ["p$v", "l$h"], "container");
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
        versionCheck(ui);
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
