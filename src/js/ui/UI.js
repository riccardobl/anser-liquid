/**
 * Main UI class
 * A UI is composed by two logical parts:
 * - Stages: a stage is a part of the UI that is displayed in the main window, like a page in a website.
 * - Modules: a module is a global component of the ui. It can be enabled or disabled for certain stages, however it is not strictly related to a stage (eg. header, floating buttons etc..)
 * Modules and stages must be registered before the UI is created.
 *
 * All stages must go in
 *      ./ui/stages
 * All modules must go in
 *      ./ui/modules
 * And they should be name like this:
 *      [StageName]Stage.js
 *      [ModuleName]Module.js
 * Eg.
 *      WalletStage.js is for the stage "wallet"
 *      HeaderModule.js is for the module "header"
 */

import Constants from "../Constants.js";
import BrowserStore from "../storage/BrowserStore.js";
export default class UI {
    static STAGES = [];
    static registerStage(stageName) {
        stageName = stageName[0].toUpperCase() + stageName.slice(1);
        this.STAGES.push(
            import("./stages/" + stageName + "Stage.js")
                .then((module) => module.default)
                .then((Stage) => {
                    const stage = new Stage();
                    return stage;
                }),
        );
    }

    static THEMES = {};
    static registerTheme(themeName) {
        const fullPath = "static/theme/" + themeName + ".css";
        UI.THEMES[themeName] = fullPath;
    }

    static MODULES = [];
    static registerModule(moduleName) {
        moduleName = moduleName[0].toUpperCase() + moduleName.slice(1);
        this.MODULES.push(
            import("./modules/" + moduleName + "Module.js")
                .then((module) => module.default)
                .then((Module) => {
                    const module = new Module();
                    return module;
                }),
        );
    }

    async storage() {
        if (!this.store) {
            this.store = await BrowserStore.fast("preferences");
        }
        return this.store;
    }

    exportApi(window, lq) {
        if (!window.liquid.ui) {
            window.liquid.ui = {};
        }
        // TODO
    }

    constructor(stageContainerEl, walletEl, lq) {
        this.stageContainerEl = stageContainerEl;
        this.walletEl = walletEl;
        this.lq = lq;
        this.stageChangeListeners = [];
    }

    addStageChangeListener(listener) {
        this.stageChangeListeners.push(listener);
    }

    reload() {
        this.setStage(this.stage.getName());
    }

    useBrowserHistory() {
        window.addEventListener("popstate", (e) => {
            if (e.state && e.state.stage) {
                this.setStage(e.state.stage);
            }
        });
        this.addStageChangeListener((stage) => {
            window.history.pushState({ stage: stage.getName() }, stage.getName(), "#" + stage.getName());
        });
    }

    async _reloadTheme() {
        let themePath = await this.getCurrentTheme();
        themePath = UI.THEMES[themePath];
        if (!themePath) themePath = UI.THEMES[Constants.DEFAULT_THEME];
        let cssEl = document.head.querySelector("link#liquidwalletTheme");
        if (!cssEl) {
            cssEl = document.createElement("link");
            cssEl.id = "liquidwalletTheme";
            cssEl.rel = "stylesheet";
            cssEl.type = "text/css";
            document.head.appendChild(cssEl);
        }
        if (cssEl.href !== themePath) {
            cssEl.href = themePath;
        }
    }

    listThemes() {
        return Object.keys(UI.THEMES);
    }

    async getCurrentTheme() {
        return (await (await this.storage()).get("theme")) || Constants.DEFAULT_THEME;
    }

    async setTheme(themeName) {
        if (UI.THEMES[themeName]) {
            await (await this.storage()).set("theme", themeName);
        }
        await this._reloadTheme();
    }

    async setStage(stageName) {
        // ensure smooth transition
        this.stageContainerEl.classList.remove("fadeIn");
        this.stageContainerEl.classList.add("fadeOut");
        await new Promise((resolve) => setTimeout(resolve, 100));

        await this._reloadTheme();

        const reload = this.stage && this.stage.getName() === stageName;
        console.log(reload ? "Reload" : "Load ", stageName);

        const stages = await Promise.all(UI.STAGES);
        const modules = await Promise.all(UI.MODULES);
        let stage;
        for (let i = 0; i < stages.length; i++) {
            if (stages[i].getName() === stageName) {
                stage = stages[i];
                break;
            }
        }

        if (!stage) {
            stage = stages[0];
            console.log(stages);
            console.error("Invalid stage", stageName, "use default stage", stage.getName());
        }

        if (!reload) {
            if (this.stage) {
                for (const module of modules) {
                    if (module.isEnabledForStage(this.stage.getName())) {
                        module.onUnload(this.stage, this.stageContainerEl, this.walletEl, this.lq, this);
                    }
                }
                this.stage.onUnload(this.stageContainerEl, this.lq, this);
                this.stageContainerEl.classList.remove(this.stage.getName());
            }

            this.stageContainerEl.innerHTML = "";
            this.stageContainerEl.classList.add("stage");
            this.stageContainerEl.classList.add(stage.getName());
        }
        stage.onReload(this.stageContainerEl, this.lq, this);
        for (const listener of this.stageChangeListeners) {
            listener(stage);
        }
        this.stage = stage;

        if (!reload) {
            for (const module of modules) {
                if (module.isEnabledForStage(stage.getName())) {
                    module.onLoad(stage, this.stageContainerEl, this.walletEl, this.lq, this);
                }
            }
        }

        await new Promise((resolve) => setTimeout(resolve, 100));

        this.stageContainerEl.classList.remove("fadeOut");
        this.stageContainerEl.classList.add("fadeIn");
    }

    captureOutputs() {
        if (this.infoOut || this.errorOut) throw new Error("Already capturing outputs");
        this.infoOut = console.info;
        this.errorOut = console.error;

        console.info = (...args) => {
            this.info(...args);
            this.infoOut(...args);
        };

        console.error = (...args) => {
            this.error(...args);
            this.errorOut(...args);
        };
    }

    error(...args) {
        this.showAlert("error", this.walletEl, ...args);
    }

    fatal(...args) {
        this.showAlert("fatal", this.walletEl, ...args);
    }

    info(...args) {
        this.showAlert("alert", this.walletEl, ...args);
    }

    showAlert(type, containerElement, ...args) {
        let alertContainerEl = containerElement.querySelector(".alertContainer");
        if (!alertContainerEl) {
            alertContainerEl = document.createElement("div");
            alertContainerEl.className = "alertContainer";
            containerElement.appendChild(alertContainerEl);
        }

        const alertBox = document.createElement("div");
        alertBox.className = `alert ${type}`;
        alertBox.textContent = args.join(" ").trim();

        alertContainerEl.appendChild(alertBox);
        // scroll to bottom
        alertContainerEl.scrollTop = alertContainerEl.scrollHeight;

        let time = 5000;
        if (type === "error") time = 10000;
        if (type === "fatal") time = 60000;
        setTimeout(() => {
            alertContainerEl.removeChild(alertBox);
        }, time);
    }
}

UI.registerStage("wallet");
UI.registerStage("options");
UI.registerStage("send");
UI.registerStage("receive");
UI.registerModule("header");
UI.registerModule("clarity");
UI.registerModule("logo");
UI.registerModule("globalmessage");

UI.registerTheme("streamgoose");
UI.registerTheme("deepoceanduck");
UI.registerTheme("spacequack");
UI.registerTheme("satoshilegacy");
UI.registerTheme("minimalsats");
