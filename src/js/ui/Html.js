import Constants from "../Constants.js";

/**
 * A chaotic wrapper around the DOM API
 * This class is used to create the DOM required for all the UI components.
 * The peculiarity is that the elements are reused if already present in the DOM,
 * this allows to write code that is something in between to immediate mode UIs and
 * retained mode UIs getting rid of the complexity of creation vs update, while also
 * not using any big framework.
 */
export default class Html {
    static _enhance(el, classes = []) {
        if (!classes) classes = [];

        if (!el.$$$) el.$$$ = {};

        el.$$$.landScapeClasses = [];
        el.$$$.portraitClasses = [];
        for (const className of classes) {
            if (className.includes("$")) {
                const [modifier, classNamePlain] = className.split("$");
                if (modifier == "l") {
                    el.$$$.landScapeClasses.push(classNamePlain);
                } else if (modifier == "p") {
                    el.$$$.portraitClasses.push(classNamePlain);
                }
            } else {
                el.classList.add(className);
            }
        }

        if (el.$$$.landScapeClasses.length > 0 || el.$$$.portraitClasses.length > 0) {
            const classPickOnResize = () => {
                let isPortrait = false;
                if (Constants.LOCK_MODE) {
                    isPortrait = Constants.LOCK_MODE == "portrait";
                } else {
                    isPortrait = window.innerWidth < window.innerHeight;
                }
                if (!isPortrait) {
                    for (const className of el.$$$.portraitClasses) {
                        el.classList.remove(className);
                    }
                    for (const className of el.$$$.landScapeClasses) {
                        el.classList.add(className);
                    }
                } else {
                    for (const className of el.$$$.landScapeClasses) {
                        el.classList.remove(className);
                    }
                    for (const className of el.$$$.portraitClasses) {
                        el.classList.add(className);
                    }
                }
            };
            el.$$$._classPickOnResize = classPickOnResize;
            window.addEventListener("resize", classPickOnResize);
            classPickOnResize();
            // remove callback when element is removed from dom
            const observer = new MutationObserver(() => {
                if (!document.body.contains(el)) {
                    window.removeEventListener("resize", classPickOnResize);
                    observer.disconnect();
                }
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });
        }

        //

        if (Constants.DISABLE_POINTER_EVENTS) {
            el.classList.add("disablePointerEvents");
        }

        el.setPriority = (priority) => {
            el.style.order = priority;
            el.triggerRefresh();
            return el;
        };
        el.grow = (value) => {
            el.style.flexGrow = value;
            return el;
        };
        el.shrink = (value) => {
            el.style.flexShrink = value;
            el.triggerRefresh();
            return el;
        };

        el.disable = () => {
            el.classList.add("disabled");
            el.triggerRefresh();
            return el;
        };

        el.enable = () => {
            el.classList.remove("disabled");
            el.triggerRefresh();
            return el;
        };

        el.commitUpdate = () => {
            const refreshId = el.parentElement.getAttribute("refresh-id");
            el.setAttribute("refresh-id", refreshId);
            el.triggerRefresh();
            return el;
        };

        el.setValue = (value, html = false) => {
            el.classList.remove("loading");
            if (html) {
                el.innerHTML = value;
            } else {
                el.textContent = value;
            }
            el.triggerRefresh();
            return el;
        };

        el.setAction = (callback) => {
            if (el.$$$.clickCallback) {
                el.removeEventListener("click", el.$$$.clickCallback);
            }
            el.classList.remove("clickable");
            if (!callback) return;
            el.$$$.clickCallback = callback;
            el.addEventListener("click", callback);
            el.classList.add("clickable");
            el.triggerRefresh();
            return el;
        };

        el.setOnRefresh = (callback) => {
            el.$$$.onChangeCallback = callback;
            el.triggerRefresh();
            return el;
        };

        el.triggerRefresh = () => {
            if (el.$$$.onChangeCallback) {
                el.$$$.onChangeCallback();
            }
        };

        el.hide = () => {
            if (!el.$$$.previousStyleDisplay) {
                el.$$$.previousStyleDisplay = el.style.display ? el.style.display : "flex";
            }
            el.style.display = "none";
        };
        el.show = () => {
            if (el.$$$.previousStyleDisplay) {
                el.style.display = el.$$$.previousStyleDisplay;
            } else {
                el.style.display = "flex";
            }
            el.$$$.previousStyleDisplay = undefined;
        };

        el.isHidden = () => {
            return el.style.display == "none";
        };
    }

    /**
     * Destroy an element
     */
    static $0(parentEl, directSelector) {
        const el = parentEl.querySelector(directSelector);
        if (el) {
            el.remove();
        }
    }

    /**
     * Create an element
     */
    static $(parentEl, directSelector, classes = [], type = "div", prepend = false) {
        let el = parentEl ? parentEl.querySelector(directSelector) : undefined;
        if (!el) {
            el = document.createElement(type);
            if (directSelector.startsWith("#")) {
                el.id = directSelector.substr(1);
            } else if (directSelector.startsWith(".")) {
                el.classList.add(directSelector.substr(1));
            }
            if (parentEl) {
                if (parentEl.$$$ && parentEl.$$$.isList) {
                    parentEl.addItem(el, 1);
                } else {
                    if (prepend) {
                        parentEl.prepend(el);
                    } else {
                        parentEl.appendChild(el);
                    }
                }
            }
            el.classList.add("loading");
        }
        this._enhance(el, classes);

        return el;
    }
    static elById(parentEl, id, classes = [], type = "div") {
        let el = parentEl.querySelector(`#${id}`);
        if (!el) {
            el = document.createElement(type);
            el.id = id;
            parentEl.appendChild(el);
        }
        this._enhance(el);
        for (const className of classes) {
            el.classList.add(className);
        }
        return el;
    }

    static elByClass(parentEl, className, extraClasses = [], type = "div") {
        let el = parentEl.querySelector(`.${className}`);
        if (!el) {
            el = document.createElement(type);
            el.classList.add(className);
            parentEl.appendChild(el);
        }
        this._enhance(el);
        for (const extraClass of extraClasses) {
            el.classList.add(extraClass);
        }
        return el;
    }

    static enableOutScroll(el, value = true) {
        el.classList.add("outscroll");
        const resizeCallback = () => {
            if (el.scrollWidth > el.clientWidth) {
                el.classList.add("outside");
            } else {
                el.classList.remove("outside");
            }
        };
        if (!el.$$$.enableOutScrollData) {
            el.$$$.enableOutScrollData = {};
        }
        if (el.$$$.enableOutScrollData.resizeCallback) {
            window.removeEventListener("resize", el.$$$.enableOutScrollData.resizeCallback);
            el.$$$.enableOutScrollData.resizeCallback = null;
        }
        if (el.$$$.enableOutScrollData.observer) {
            el.$$$.enableOutScrollData.observer.disconnect();
            el.$$$.enableOutScrollData.observer = null;
        }
        if (el.$$$.enableOutScrollData.resizeObserver) {
            el.$$$.enableOutScrollData.resizeObserver.disconnect();
            el.$$$.enableOutScrollData.resizeObserver = null;
        }
        if (!value) return;

        const resizeObserver = new ResizeObserver(() => {
            resizeCallback();
        });
        resizeObserver.observe(el);

        window.addEventListener("resize", resizeCallback);

        const observer = new MutationObserver(() => {
            if (!document.body.contains(el)) {
                window.removeEventListener("resize", resizeCallback);
                observer.disconnect();
                resizeObserver.disconnect();
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
        el.$$$.enableOutScrollData.observer = observer;
        el.$$$.enableOutScrollData.resizeObserver = resizeObserver;
        el.$$$.enableOutScrollData.resizeCallback = resizeCallback;
        resizeCallback();
    }

    static initializeListUpdate(parentEl) {
        let refreshId = parentEl.getAttribute("refresh-id");
        if (!refreshId) {
            refreshId = "rf" + Date.now() + Math.floor(Math.random() * 1000);
            parentEl.setAttribute("refresh-id", refreshId);
        }
    }

    static commitListUpdate(parentEl) {
        const refreshId = parentEl.getAttribute("refresh-id");
        const els = parentEl.querySelectorAll(`asset:not([refresh-id="${refreshId}"])`);
        for (const el of els) {
            els.removeChild(el);
        }
        parentEl.removeAttribute("refresh-id");
    }

    static $list(parent, directSelector, classes = []) {
        const el = this.$(parent, directSelector, classes);
        el.classList.add("list");
        el.addItem = (item, priority = 1) => {
            if (priority < 0) {
                el.prepend(item);
            } else {
                el.appendChild(item);
            }
            if (item.setPriority) item.setPriority(priority);
            item.classList.add("listItem");
            el.classList.remove("loading");
        };
        el.initUpdate = () => {
            this.initializeListUpdate(el);
        };
        el.commitUpdate = () => {
            this.commitListUpdate(el);
        };
        if (!el.$$$) el.$$$ = {};
        el.$$$.isList = true;
        this._addCover(el);
        return el;
    }

    static $vlist(parent, directSelector, classes = []) {
        const l = this.$list(parent, directSelector, classes);
        l.classList.add("v");
        return l;
    }

    static $sep(parent, directSelector, classes = []) {
        const el = this.$(parent, directSelector, ["sep", ...classes], "span");
        el.classList.add("sep");
        return el;
    }

    static $vsep(parent, directSelector, classes = []) {
        const el = this.$(parent, directSelector, classes, "span");
        el.classList.add("v");
        el.classList.add("sep");

        return el;
    }

    static $hlist(parent, directSelector, classes = []) {
        const l = this.$list(parent, directSelector, classes);
        l.classList.add("h");
        return l;
    }

    static $text(parent, directSelector, classes = []) {
        const el = this.$(parent, directSelector, classes, "span");
        el.classList.add("text");
        return el;
    }

    static $title(parent, directSelector, classes = []) {
        const el = this.$(parent, directSelector, classes, "h1");
        return el;
    }

    static $img(parent, directSelector, classes = []) {
        const el = this.$(parent, directSelector, classes, "img");
        el.classList.add("img");
        el.setSrc = (src) => {
            el.src = src;
            el.classList.remove("loading");
        };
        return el;
    }

    static makeDragScrollable(el) {
        let isDown = false;
        let startX;
        let scrollLeft;
        el.addEventListener("mousedown", (e) => {
            isDown = true;
            startX = e.pageX - el.offsetLeft;
            scrollLeft = el.scrollLeft;
        });
        el.addEventListener("mouseleave", () => {
            isDown = false;
        });
        el.addEventListener("mouseup", () => {
            isDown = false;
        });
        el.addEventListener("mousemove", (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - el.offsetLeft;
            const walk = (x - startX) * 3; //scroll-fast
            el.scrollLeft = scrollLeft - walk;
        });
    }

    static _addCover(el) {
        let coverEl = el.querySelector(".cover");
        if (!coverEl) {
            coverEl = document.createElement("div");
            coverEl.classList.add("cover");
            el.appendChild(coverEl);
        }
        el.setCover = (coverUrl) => {
            coverEl.style.backgroundImage = `url(${coverUrl})`;
        };
    }

    static $cnt(parent, directSelector, classes = []) {
        const el = this.$(parent, directSelector, classes, "div");
        el.classList.add("cnt");
        this._addCover(el);
        return el;
    }

    static $icon(parent, directSelector, classes = [], prepend = false) {
        const iconCntEl = this.$(parent, directSelector, ["iconCnt", ...classes], "div", prepend);
        let materialIconEl = iconCntEl.querySelector(":scope > .mic");
        let isNew = true;
        if (!materialIconEl) {
            materialIconEl = document.createElement("div");
            materialIconEl.classList.add("icon");
            materialIconEl.classList.add("material-symbols-outlined");
            materialIconEl.classList.add("mic");
            materialIconEl.innerText = "cached";
        } else {
            isNew = false;
        }

        let iconImgEl = iconCntEl.querySelector(":scope  > .img");
        if (!iconImgEl) {
            iconImgEl = document.createElement("img");
            iconImgEl.classList.add("icon");
            iconImgEl.classList.add("img");
        } else {
            isNew = false;
        }

        if (isNew) {
            iconImgEl.remove();
            iconCntEl.appendChild(materialIconEl);
            materialIconEl.classList.add("loading");
            materialIconEl.innerText = "cached";
        }

        iconCntEl.setValue = (value) => {
            const imgEl = iconCntEl.querySelector(":scope > .img");
            if (imgEl) {
                imgEl.remove();
                // materialIconEl.remove();
                iconCntEl.appendChild(materialIconEl);
            }
            materialIconEl.classList.remove("loading");
            materialIconEl.innerText = value;
            iconCntEl.triggerRefresh();
            return iconCntEl;
        };
        iconCntEl.setSrc = (src) => {
            const materialIconEl = iconCntEl.querySelector(":scope > .material-symbols-outlined");
            if (materialIconEl) {
                materialIconEl.remove();
                // iconImgEl.remove();
                iconCntEl.appendChild(iconImgEl);
            }
            iconImgEl.classList.remove("loading");
            iconImgEl.src = src;
            iconCntEl.triggerRefresh();
            return iconCntEl;
        };
        return iconCntEl;
    }

    static $inputText(parent, directSelector, classes = []) {
        const el = this.$(parent, directSelector, classes, "input");
        el.type = "text";
        el.classList.add("clickable");

        el.setPlaceHolder = (placeholder) => {
            el.placeholder = placeholder;
            el.triggerRefresh();
            return el;
        };
        el.setAction = (callback) => {
            el.$$$.onChangeCallback = callback;
            el.triggerRefresh();
            return el;
        };
        el.setValue = (value, silent = false) => {
            if (silent) {
                // set value without triggering callback
                const cs = (ev) => {
                    ev.stopPropagation();
                    ev.preventDefault();
                };
                el.addEventListener("input", cs, { once: true });
                el.value = value;
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        el.removeEventListener("input", cs);
                    });
                });
            } else {
                el.value = value;
                if (el.$$$.onChangeCallbakWrapper) {
                    el.$$$.onChangeCallbakWrapper();
                }
            }
            el.triggerRefresh();
            return el;
        };
        el.getValue = () => {
            return el.value;
        };
        if (el.$$$.onChangeCallbakWrapper) {
            el.removeEventListener("input", el.$$$.onChangeCallbakWrapper);
        }
        el.$$$.onChangeCallbakWrapper = () => {
            if (el.$$$.onChangeCallbackScheduledTimeout) {
                clearTimeout(el.$$$.onChangeCallbackScheduledTimeout);
            }
            el.$$$.onChangeCallbackScheduledTimeout = setTimeout(() => {
                if (el.$$$.onChangeCallback) {
                    el.$$$.onChangeCallback(el.getValue());
                }
            }, Constants.DEBOUNCE_CALLBACK_TIME);
        };
        el.addEventListener("input", el.$$$.onChangeCallbakWrapper);
        return el;
    }

    static $button(parent, directSelector, classes = []) {
        const el = this.$(parent, directSelector, classes, "button");
        el.setIconValue = (value) => {
            if (!value) {
                this.$0(el, ".icon");
                el.classList.remove("withIcon");
            } else {
                const iconEl = this.$icon(el, ".buttonIcon", ["icon"], true);
                iconEl.setValue(value);
                el.classList.add("withIcon");
            }
            el.triggerRefresh();
            return el;
        };
        el.setIconSrc = (src) => {
            if (!src) {
                this.$0(el, ".icon");
                el.classList.remove("withIcon");
            } else {
                console.log("Set icon src", src);
                const iconEl = this.$icon(el, ".buttonIcon", ["icon"], true);
                iconEl.setSrc(src);
                el.classList.add("withIcon");
            }
            el.triggerRefresh();
            return el;
        };
        return el;
    }

    static $inputNumber(parent, directSelector, classes = []) {
        const el = this.$(parent, directSelector, classes, "input");
        el.type = "number";
        el.classList.add("clickable");

        el.min = 0;

        el.setPlaceHolder = (placeholder) => {
            el.placeholder = placeholder;
            el.triggerRefresh();
            return el;
        };
        el.setAction = (callback) => {
            el.$$$.onChangeCallback = (v) => {
                v = Number(v);
                callback(v);
            };
            el.triggerRefresh();
            return el;
        };
        el.setValue = (value, silent = false) => {
            if (silent) {
                // set value without triggering callback
                const cs = (ev) => {
                    ev.stopPropagation();
                    ev.preventDefault();
                };
                el.addEventListener("input", cs, { once: true });
                // el.addEventListener("change", cs, { once: true });
                el.value = value;
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        el.removeEventListener("input", cs);
                        // el.removeEventListener("change", cs);
                    });
                });
            } else {
                el.value = value;
                if (el.$$$.onChangeCallbakWrapper) {
                    el.$$$.onChangeCallbakWrapper();
                }
                el.triggerRefresh();
            }
            return el;
        };
        el.getValue = () => {
            let v = Number(el.value);
            if (isNaN(v)) {
                return 0;
            }
            return v;
        };
        if (el.$$$.onChangeCallbakWrapper) {
            el.removeEventListener("input", el.$$$.onChangeCallbakWrapper);
            // el.removeEventListener("change", el.$$$.onChangeCallbakWrapper);
        }
        el.$$$.onChangeCallbakWrapper = (ev) => {
            if (el.$$$.onChangeCallbackScheduledTimeout) {
                clearTimeout(el.$$$.onChangeCallbackScheduledTimeout);
            }
            el.$$$.onChangeCallbackScheduledTimeout = setTimeout(() => {
                if (el.$$$.onChangeCallback) {
                    el.$$$.onChangeCallback(el.getValue());
                }
            }, Constants.DEBOUNCE_CALLBACK_TIME);
        };
        el.addEventListener("input", el.$$$.onChangeCallbakWrapper);
        // el.addEventListener("change", el.$$$.onChangeCallbakWrapper);

        return el;
    }

    static $inputSelect(parent, directSelector, title, classes = [], multiSelect = false) {
        const el = this.$(parent, directSelector, ["popupSelect", ...classes], "div");
        el.classList.add("clickable");

        let popupContainerEl = el;
        while (popupContainerEl && !popupContainerEl.classList.contains("popupContainer")) {
            popupContainerEl = popupContainerEl.parentElement;
            if (!popupContainerEl) {
                popupContainerEl = document.body;
                break;
            }
        }

        if (!el.$$$.popupId) {
            el.$$$.popupId = "popupSelect" + Date.now() + Math.floor(Math.random() * 1000);
        }

        const btnEl = this.$button(el, ".selectBtn", ["fillw"]);

        el.deselectOption = (value) => {
            const optionEl = el.$$$.selectOptions[value];
            if (!optionEl) return false;
            if (el.$$$.selected === value) el.$$$.selected = undefined;
            if (el.$$$.selectedOptions && el.$$$.selectedOptions[value]) {
                el.$$$.selectedOptions[value] = false;
            }
            if (multiSelect) {
                let valueString = "";
                for (const key in el.$$$.selectOptions) {
                    const optionEl = el.$$$.selectOptions[key];
                    if (el.$$$.selectedOptions[key]) {
                        valueString += el.$$$.selectLabels[key] + ", ";
                    }
                }

                valueString = valueString.slice(0, -2);

                Html.$text(btnEl, ".label").setValue(valueString);
                Html.$text(btnEl, ".secondaryLabel").setValue("");
            }
            if (multiSelect) {
                el.$$$.selectActions[value](el.$$$.selectedOptions);
            } else {
            }
            el.triggerRefresh();
            return optionEl;
        };

        el.selectOption = (value, forceRefresh = false) => {
            if (!el.$$$.selectOptions) return;
            const optionEl = el.$$$.selectOptions[value];
            if (!optionEl) return false;
            if (multiSelect) {
                if (!el.$$$.selectedOptions) el.$$$.selectedOptions = [];
                el.$$$.selectedOptions[value] = true;
                let valueString = "";
                for (const key in el.$$$.selectOptions) {
                    const optionEl = el.$$$.selectOptions[key];
                    // const toggleEl = optionEl.querySelector(".toggle");
                    if (el.$$$.selectedOptions[key]) {
                        //     toggleEl.setValue("check_box_outline_blank");
                        // }else{
                        valueString += el.$$$.selectLabels[key] + ", ";
                        //     toggleEl.setValue("check_box");
                    }
                }

                valueString = valueString.slice(0, -2);
                Html.$text(btnEl, ".label").setValue(valueString);
                Html.$text(btnEl, ".secondaryLabel").setValue("");
            } else {
                if (el.$$$.selected === value && !forceRefresh) return;
                el.$$$.selected = value;
                optionEl.copyTo(btnEl);
            }
            this.$icon(btnEl, ".expand", []).setValue("arrow_drop_down");
            el.triggerRefresh();
            if (multiSelect) {
                el.$$$.selectActions[value](el.$$$.selectedOptions);
            } else {
                if (el.$$$.selectActions && el.$$$.selectActions[value]) {
                    el.$$$.selectActions[value](value);
                }
            }
            return optionEl;
        };

        const openPopup = () => {
            el.classList.remove("clickable");
            btnEl.classList.remove("clickable");
            const popupOptionsEl = this.$vlist(popupContainerEl, "#" + el.$$$.popupId, [
                "popup",
                "popupSelect",
                "l$landscape",
            ]);
            popupOptionsEl.classList.remove("loading");
            popupContainerEl.classList.add("popupOpen");
            this.$title(popupOptionsEl, ".title", ["center"]).setValue(title);

            if (multiSelect) {
                const confirmBtnEl = this.$button(popupOptionsEl, ".confirm", []).setValue("Confirm");
                confirmBtnEl.setIconValue("check");
                confirmBtnEl.setAction(() => {
                    closePopup();
                });
            }

            if (el.$$$.selectOptions) {
                for (const key in el.$$$.selectOptions) {
                    const btnEl = this.$button(popupOptionsEl, ".option" + key, ["option", "fillw"]);
                    el.$$$.selectOptions[key].copyTo(btnEl);
                    if (!el.$$$.selectedOptions) el.$$$.selectedOptions = {};

                    btnEl.setAction(() => {
                        let optionEl = undefined;
                        if (!el.$$$.selectedOptions[key]) {
                            optionEl = el.selectOption(key);
                        } else {
                            optionEl = el.deselectOption(key);
                        }
                        if (multiSelect) {
                            optionEl.copyTo(btnEl);
                            const toggleEl = this.$icon(btnEl, ".toggle", [], true);

                            if (!el.$$$.selectedOptions[key]) {
                                toggleEl.setValue("check_box_outline_blank");
                            } else {
                                // checked
                                toggleEl.setValue("check_box");
                            }
                        } else {
                            closePopup();
                        }
                    });
                    if (multiSelect) {
                        const toggleEl = this.$icon(btnEl, ".toggle", [], true);

                        if (!el.$$$.selectedOptions[key]) {
                            toggleEl.setValue("check_box_outline_blank");
                        } else {
                            console.log("selected ", key);
                            toggleEl.setValue("check_box");
                        }
                    }
                }
            }

            // close if clicked outside
            const clickOutsideCallback = (e) => {
                // const closeAction = () => {
                //     if (
                //         e.target != popupOptionsEl
                //         && !popupOptionsEl.contains(e.target)
                //         && e.target != btnEl
                //     ) {
                //         return true;
                //     }
                //     return false;
                // }
                if (e.target == btnEl) return;
                if (e.target == popupOptionsEl) return;

                const pX = popupOptionsEl.getBoundingClientRect().left;
                const pY = popupOptionsEl.getBoundingClientRect().top;
                const pW = popupOptionsEl.getBoundingClientRect().width;
                const pH = popupOptionsEl.getBoundingClientRect().height;
                if (e.clientX > pX && e.clientX < pX + pW && e.clientY > pY && e.clientY < pY + pH) {
                    return;
                }

                closePopup();
            };
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    if (el.$$$.selectClickOutsideCallback) {
                        window.removeEventListener("click", el.$$$.selectClickOutsideCallback);
                        el.$$$.selectClickOutsideCallback = undefined;
                    }
                    el.$$$.selectClickOutsideCallback = clickOutsideCallback;
                    window.addEventListener("click", clickOutsideCallback);
                });
            });
        };

        const closePopup = () => {
            if (el.$$$.selectClickOutsideCallback) {
                window.removeEventListener("click", el.$$$.selectClickOutsideCallback);
                el.$$$.selectClickOutsideCallback = undefined;
            }
            btnEl.classList.add("clickable");

            el.classList.add("clickable");
            this.$0(popupContainerEl, "#" + el.$$$.popupId);
        };

        const _selectPreferred = () => {
            if (el.$$$.preferredValues) {
                for (const value of el.$$$.preferredValues) {
                    if (el.selectOption(value)) {
                        if (!multiSelect) {
                            break;
                        }
                    }
                }
            }

            // select first one
            if (!multiSelect) {
                if (!el.$$$.selected || !el.$$$.selectOptions[el.$$$.selected]) {
                    for (const key in el.$$$.selectOptions) {
                        el.selectOption(key);
                        break;
                    }
                }
            }
        };

        el.addOption = (value, label, action = () => {}, selected = false) => {
            const optionEl = this.$button(undefined, ".option" + value, ["option", "fillw"]);
            let toggleEl;
            if (multiSelect) {
                toggleEl = this.$icon(optionEl, ".toggle", [], true);
                toggleEl.setPriority(-20);
                toggleEl.setValue(selected ? "check_box" : "check_box_outline_blank");
            }
            const label1El = Html.$text(optionEl, ".label").setValue(label);
            const label2El = Html.$text(optionEl, ".secondaryLabel").setValue("");
            optionEl.setValue = (v, html = false) => {
                label1El.setValue(v, html);
            };
            optionEl.setValue2 = (v, html = false) => {
                label2El.setValue(v, html);
            };
            if (!el.$$$.selectActions) {
                el.$$$.selectActions = {};
            }
            if (!el.$$$.selectLabels) {
                el.$$$.selectLabels = {};
            }
            el.$$$.selectLabels[value] = label;

            // if (multiSelect){
            //     if (!el.$$$.selectedOptions)el.$$$.selectedOptions={};
            //     el.$$$.selectActions[value] = ()=>{
            //         el.$$$.selectedOptions[value]=!el.$$$.selectedOptions[value];
            //         if (el.$$$.selectedOptions[value]){
            //             toggleEl.setValue("check_box");
            //         }else{
            //             toggleEl.setValue("check_box_outline_blank");
            //         }
            //         action(el.$$$.selectedOptions);
            //     }
            // }else{
            el.$$$.selectActions[value] = action;
            // }

            optionEl.setOnRefresh(() => {
                if (el.$$$.selected === value) {
                    el.selectOption(value, true);
                }
            });

            if (!el.$$$.selectOptions) {
                el.$$$.selectOptions = {};
            }

            optionEl.copyTo = (target) => {
                const clone = optionEl.cloneNode(true);
                while (target.firstChild) {
                    target.removeChild(target.firstChild);
                }
                while (clone.firstChild) {
                    target.appendChild(clone.firstChild);
                }
            };
            el.$$$.selectOptions[value] = optionEl;
            _selectPreferred();
            el.triggerRefresh();
            return optionEl;
        };

        el.removeOption = (value) => {
            if (!el.$$$.selectOptions) return;
            el.$$$.selectOptions[value] = undefined;
            l.$$$.selectedOptions[value] = undefined;
            if (el.$$$.selected === value) {
                _selectPreferred();
            }
            el.triggerRefresh();
        };

        el.clearOptions = () => {
            if (!el.$$$.selectOptions) return;
            el.$$$.selectOptions = {};
            l.$$$.selectedOptions = {};
            _selectPreferred();
            el.triggerRefresh();
        };

        el.setAction(() => {
            openPopup();
            el.triggerRefresh();
        });

        el.setPreferredValues = (values) => {
            el.$$$.preferredValues = values;
            _selectPreferred();
            el.triggerRefresh();
            return el;
        };

        return el;
    }

    static $inputSlide(parentEl, directSelector, classes = []) {
        const el = this.$(parentEl, directSelector, classes, "div");
        el.classList.add("inputSlide");

        const sliderEl = this.$(el, ".slider", ["fillw"], "input");
        sliderEl.type = "range";
        sliderEl.min = 0;
        sliderEl.max = 10;
        sliderEl.value = 0;

        const debounce = Constants.DEBOUNCE_CALLBACK_TIME;
        let lastValue = 0;

        sliderEl.addEventListener("input", () => {
            if (el.$$$.slideAction) {
                lastValue = Number(sliderEl.value) / 10;
                if (el.$$$.slideActionScheduledTimeout) {
                    clearTimeout(el.$$$.slideActionScheduledTimeout);
                }
                el.$$$.slideActionScheduledTimeout = setTimeout(() => {
                    el.$$$.slideActionScheduledTimeout = undefined;
                    el.$$$.slideAction(lastValue);
                }, debounce);
            }
        });

        el.setValue = (value, silent = false) => {
            if (silent) {
                // set value without triggering callback
                const cs = (ev) => {
                    ev.stopPropagation();
                    ev.preventDefault();
                };
                el.addEventListener("input", cs, { once: true });
                sliderEl.value = value * 10;
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        el.removeEventListener("input", cs);
                    });
                });
            } else {
                sliderEl.value = value * 10;
            }
            return el;
        };
        el.setAction = (callback) => {
            el.$$$.slideAction = callback;
            return el;
        };

        return el;
    }

    static $newPopup(parentEl, directSelector, title, classes = []) {
        let popupContainerEl = parentEl;
        while (popupContainerEl && !popupContainerEl.classList.contains("popupContainer")) {
            popupContainerEl = popupContainerEl.parentElement;
            if (!popupContainerEl) {
                popupContainerEl = document.body;
                break;
            }
        }
        const el = this.$vlist(popupContainerEl, directSelector, ["popup", "l$landscape", ...classes]);
        el.classList.add("clickable");

        this.$title(el, ".title", ["center"]).setValue(title);

        el.hide();
        // const clickOutsideCallback = (e) => {
        //     if(el.isHidden())return;
        //     if (e.target == btnEl) return;
        //     if (e.target == el)
        //         return;

        //     const pX = el.getBoundingClientRect().left;
        //     const pY = el.getBoundingClientRect().top;
        //     const pW = el.getBoundingClientRect().width;
        //     const pH = el.getBoundingClientRect().height;
        //     if (e.clientX > pX && e.clientX < pX + pW && e.clientY > pY && e.clientY < pY + pH) {
        //         return;
        //     }

        //     closePopup();
        // };

        return el;
    }
}
