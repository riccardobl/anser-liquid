import Constants from "../Constants.js";

/**
 * A chaotic wrapper around the DOM API
 * This class is used to create the DOM required for all the UI components.
 * The peculiarity is that the elements are reused if already present in the DOM,
 * this allows to write code that is something in between to immediate mode UIs and
 * retained mode UIs getting rid of the complexity of creation vs update, while also
 * not using any big framework.
 */
class Html {
    static _enhance(el, classes = []) {
        if (!classes) classes = [];

        if (!el.$$$) el.$$$ = {};

        // handle landscape and portrait classes
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
            if (el.$$$._classPickOnResize) {
                window.removeEventListener("resize", el.$$$._classPickOnResize);
            }
            if (el.$$$._classPickObserver) {
                el.$$$._classPickObserver.disconnect();
            }
            el.$$$._classPickOnResize = () => {
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
            window.addEventListener("resize", el.$$$._classPickOnResize);
            el.$$$._classPickOnResize();

            el.$$$._classPickObserver = new MutationObserver(() => {
                if (!document.body.contains(el)) {
                    window.removeEventListener("resize", el.$$$._classPickOnResize);
                    el.$$$._classPickObserver.disconnect();
                }
            });

            el.$$$._classPickObserver.observe(document.body, {
                childList: true,
                subtree: true,
            });
        }

        if (Constants.DISABLE_POINTER_EVENTS) {
            el.classList.add("disablePointerEvents");
        }

        el.fill = (v = true) => {
            if (v) {
                el.classList.add("fill");
            } else {
                el.classList.remove("fill");
            }
            return el;
        };

        el.addClass = (cls, mode = "all") => {
            if (mode == "landscape") {
                el.$$$.landScapeClasses.push(cls);
            } else if (mode == "portrait") {
                el.$$$.portraitClasses.push(cls);
            } else {
                el.classList.add(cls);
            }
            el.triggerRefresh();
            return el;
        };

        el.removeClass = (cls) => {
            el.$$$.landScapeClasses = el.$$$.landScapeClasses.filter((c) => c != cls);
            el.$$$.portraitClasses = el.$$$.portraitClasses.filter((c) => c != cls);
            el.classList.remove(cls);
            el.triggerRefresh();
            return el;
        };

        el.setPriority = (priority) => {
            el.style.order = priority;
            el.triggerRefresh();
            return el;
        };

        el.grow = (value) => {
            el.style.flexGrow = value;
            el.triggerRefresh();
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

        el.reset = () => {
            el.resetState();
            el.innerHTML = "";
            return el;
        };

        el.resetState = () => {
            el.$$$.itemCount = {};
            return el;
        };

        el.setOnRefresh = (callback) => {
            el.$$$.onRefreshCallback = callback;
            el.triggerRefresh();
            return el;
        };

        el.triggerRefresh = () => {
            if (el.$$$.onRefreshCallback) {
                el.$$$.onRefreshCallback();
            }
            return el;
        };

        el.hide = () => {
            if (!el.$$$.previousStyleDisplay) {
                el.$$$.previousStyleDisplay = el.style.display ? el.style.display : "flex";
            }
            el.style.display = "none";
            el.triggerRefresh();
            return el;
        };

        el.show = () => {
            if (el.$$$.previousStyleDisplay) {
                el.style.display = el.$$$.previousStyleDisplay;
            } else {
                el.style.display = "flex";
            }
            el.$$$.previousStyleDisplay = undefined;
            el.triggerRefresh();
            return el;
        };

        el.isHidden = () => {
            return el.style.display == "none";
        };

        el.makeScrollable = (value = true, momentumScroll = false) => {
            if (value) {
                el.classList.add("outscroll");
                if (momentumScroll) {
                    if (!el.getAttribute("momentumScroll")) {
                        this.enableMomentumScroll(el);
                        el.setAttribute("momentumScroll", true);
                    }
                } else {
                    // TODO
                    // this.disableMomentumScroll(el);
                }
            } else {
                el.classList.remove("outscroll");
                TODO;
                // this.disableMomentumScroll(el);
            }
            return el;
        };

        el.setCover = (coverUrl) => {
            let coverEl = el.querySelector(".cover");
            if (coverUrl) {
                if (!coverEl) {
                    coverEl = document.createElement("div");
                    coverEl.classList.add("cover");
                    el.appendChild(coverEl);
                }
                el.classList.add("withCover");
                coverEl.style.backgroundImage = `url(${coverUrl})`;
            } else {
                el.classList.remove("withCover");
                if (coverEl) {
                    coverEl.remove();
                }
            }
            return el;
        };

        el.setEditable = (v) => {
            if (el.tagName == "INPUT") {
                el.readOnly = !v;
            } else {
                el.setAttribute("contenteditable", v);
            }
            return el;
        };
    }

    /**
     * Destroy an element
     */
    static $0(parentEl, directSelector) {
        const el = parentEl.querySelector(directSelector);
        if (el) {
            this._getReal(el).remove();
        }
    }

    /**
     * Create an element
     */
    static $(parentEl, directSelector, classes = [], type = "div", prepend = false) {
        if (directSelector) {
            directSelector = "#" + directSelector;
        }
        parentEl = parentEl ? this._getReal(parentEl) : parentEl;
        if (!directSelector) {
            if (!parentEl.$$$) parentEl.$$$ = {};
            if (!parentEl.$$$.itemCount) parentEl.$$$.itemCount = {};
            if (!parentEl.$$$.itemCount[type]) parentEl.$$$.itemCount[type] = 0;
            directSelector = "#" + type + parentEl.$$$.itemCount[type]++;
        }
        let el = parentEl ? parentEl.querySelector(":scope > " + directSelector) : undefined;
        if (!el) {
            el = document.createElement(type);
            if (directSelector.startsWith("#")) {
                el.id = directSelector.substr(1);
            } else if (directSelector.startsWith(".")) {
                el.classList.add(directSelector.substr(1));
            } else {
                throw new Error("Invalid selector " + directSelector);
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
        el.resetState();

        let varName = "";
        let isClass = false;
        if (directSelector.startsWith("#")) {
            varName = directSelector.substr(1);
        } else if (directSelector.startsWith(".")) {
            varName = directSelector.substr(1);
            isClass = true;
        }
        if (varName && parentEl) {
            if (!isClass) {
                if (!parentEl.$$$) parentEl.$$$ = {};
                parentEl.$$$[varName] = el;
            }
        }

        return el;
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

    static $list(parent, classes = [], id) {
        const el = this.$(parent, id, classes);
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
        return el;
    }

    static $vlist(parent, classes = [], id) {
        const l = this.$list(parent, classes, id);
        l.classList.add("v");
        return l;
    }

    static $sep(parent, classes = [], id) {
        const el = this.$(parent, id, ["sep", ...classes], "span");
        el.classList.add("sep");
        return el;
    }

    static $vsep(parent, classes = [], id) {
        const el = this.$(parent, id, classes, "span");
        el.classList.add("v");
        el.classList.add("sep");

        return el;
    }

    static $hlist(parent, classes = [], id) {
        const l = this.$list(parent, classes, id);
        l.classList.add("h");
        return l;
    }

    static $text(parent, classes = [], id) {
        const el = this.$(parent, id, classes, "span");
        el.classList.add("text");
        return el;
    }

    static $title(parent, classes = [], id) {
        const el = this.$(parent, id, classes, "h1");
        return el;
    }

    static $img(parent, classes = [], id) {
        const el = this.$(parent, id, classes, "img");
        el.classList.add("img");
        el.setSrc = (src) => {
            el.src = src;
            el.classList.remove("loading");
        };
        return el;
    }

    static enableMomentumScroll(el) {
        let isDown = false;
        let startX, startY;
        let scrollLeft, scrollTop;
        let velX = 0,
            velY = 0;
        let momentumID;

        function beginMomentumTracking() {
            cancelMomentumTracking();
            momentumID = requestAnimationFrame(momentumLoop);
        }

        function cancelMomentumTracking() {
            cancelAnimationFrame(momentumID);
        }

        function momentumLoop() {
            if (el.scrollWidth > el.clientWidth) {
                el.scrollLeft += velX;
                velX *= 0.95;
            }
            if (el.scrollHeight > el.clientHeight) {
                el.scrollTop += velY;
                velY *= 0.95;
            }
            if (Math.abs(velX) > 0.5 || Math.abs(velY) > 0.5) {
                momentumID = requestAnimationFrame(momentumLoop);
            }
        }

        el.addEventListener("mousedown", (e) => {
            el.classList.add("no-snap");

            isDown = true;
            startX = e.pageX - el.offsetLeft;
            startY = e.pageY - el.offsetTop;
            scrollLeft = el.scrollLeft;
            scrollTop = el.scrollTop;
            cancelMomentumTracking();
        });

        el.addEventListener("mouseleave", () => {
            isDown = false;
        });

        el.addEventListener("mouseup", () => {
            el.classList.remove("no-snap");

            isDown = false;
            beginMomentumTracking();
        });

        el.addEventListener("mousemove", (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - el.offsetLeft;
            const y = e.pageY - el.offsetTop;
            const walkX = (x - startX) * 3;
            const walkY = (y - startY) * 3;
            let prevScrollLeft = el.scrollLeft;
            let prevScrollTop = el.scrollTop;
            if (el.scrollWidth > el.clientWidth) {
                el.scrollLeft = scrollLeft - walkX;
                velX = el.scrollLeft - prevScrollLeft;
            }
            if (el.scrollHeight > el.clientHeight) {
                el.scrollTop = scrollTop - walkY;
                velY = el.scrollTop - prevScrollTop;
            }
        });

        el.addEventListener("wheel", () => {
            cancelMomentumTracking();
        });
    }

    // static $cnt(parent, directSelector, classes = []) {
    //     const el = this.$(parent, directSelector, classes, "div");
    //     el.classList.add("cnt");
    //     return el;
    // }

    static _getReal(el) {
        const elParent = el.parentElement;
        if (elParent && elParent.classList.contains("proxyParentCnt")) {
            return elParent;
        }
        return el;
    }

    static $icon(parent, classes = [], id, prepend = false) {
        const iconCntEl = this.$(parent, id, ["iconCnt", ...classes], "div", prepend);
        iconCntEl.classList.remove("loading");
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
                iconCntEl.appendChild(iconImgEl);
            }
            iconImgEl.classList.remove("loading");
            iconImgEl.src = src;
            iconCntEl.triggerRefresh();
            return iconCntEl;
        };
        return iconCntEl;
    }

    static $inputText(parent, classes = []) {
        if (!parent.$$$) parent.$$$ = {};
        if (!parent.$$$.itemCount) parent.$$$.itemCount = {};
        if (!parent.$$$.itemCount.inputProxy) parent.$$$.itemCount.inputProxy = 0;
        const parentEl = this.$hlist(
            parent,
            ["proxyParentCnt", "input", "text", ...classes],
            "proxyParentCnt" + parent.$$$.itemCount.inputProxy,
        );
        parent.$$$.itemCount.inputProxy++;
        const el = this.$(parentEl, undefined, [], "input");
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

    static $button(parent, classes = [], id = undefined) {
        const el = this.$(parent, id, classes, "button");
        el.setIconValue = (value) => {
            if (!value) {
                this.$0(el, "#buttonIcon");
                el.classList.remove("withIcon");
            } else {
                const iconEl = this.$icon(el, ["buttonIcon", "icon"], "buttonIcon", true);
                iconEl.setValue(value);
                el.classList.add("withIcon");
            }
            el.triggerRefresh();
            return el;
        };
        el.setIconSrc = (src) => {
            if (!src) {
                this.$0(el, "#buttonIcon");
                el.classList.remove("withIcon");
            } else {
                console.log("Set icon src", src);
                const iconEl = this.$icon(el, ["buttonIcon", "icon"], "buttonIcon", true);
                iconEl.setSrc(src);
                el.classList.add("withIcon");
            }
            el.triggerRefresh();
            return el;
        };
        return el;
    }

    static $inputNumber(parent, classes = []) {
        const el = this.$inputText(parent, classes);
        el.type = "number";

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

        return el;
    }

    static $inputSelect(parent, title, classes = [], multiSelect = false) {
        const el = this.$(parent, undefined, ["popupSelect", ...classes], "div");
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

        const btnEl = this.$button(el, ["selectBtn", "fillw"], "selectBtn");

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

                this.$text(btnEl, ["label"], "label").setValue(valueString);
                this.$text(btnEl, ["secondaryLabel"], "secondaryLabel").setValue("");
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
                    if (el.$$$.selectedOptions[key]) {
                        valueString += el.$$$.selectLabels[key] + ", ";
                    }
                }
                valueString = valueString.slice(0, -2);
                this.$text(btnEl, ["label"], "label").setValue(valueString);
                this.$text(btnEl, ["secondaryLabel"], "secondaryLabel").setValue("");
            } else {
                if (el.$$$.selected === value && !forceRefresh) return;
                el.$$$.selected = value;
                optionEl.copyTo(btnEl);
            }
            this.$icon(btnEl, ["expand"], "expand").setValue("arrow_drop_down");
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
            const popupOptionsEl = this.$vlist(
                popupContainerEl,
                ["popup", "popupSelect", "l$landscape"],
                el.$$$.popupId,
            );
            popupOptionsEl.classList.remove("loading");
            popupContainerEl.classList.add("popupOpen");
            this.$title(popupOptionsEl, ["center"], "title").setValue(title);

            if (multiSelect) {
                const confirmBtnEl = this.$button(popupOptionsEl, ["confirm"], "confirm").setValue("Confirm");
                confirmBtnEl.setIconValue("check");
                confirmBtnEl.setAction(() => {
                    closePopup();
                });
            }

            if (el.$$$.selectOptions) {
                for (const key in el.$$$.selectOptions) {
                    const btnEl = this.$button(
                        popupOptionsEl,
                        ["option" + key, "option", "fillw"],
                        "option" + key,
                    );
                    el.$$$.selectOptions[key].copyTo(btnEl);
                    if (!el.$$$.selectedOptions) el.$$$.selectedOptions = {};

                    if (multiSelect) {
                        const toggleEl = this.$icon(btnEl, ["toggle"], "toggle", true);

                        if (!el.$$$.selectedOptions[key]) {
                            toggleEl.setValue("check_box_outline_blank");
                        } else {
                            toggleEl.setValue("check_box");
                        }
                    }

                    btnEl.setAction(() => {
                        let optionEl = undefined;
                        if (!el.$$$.selectedOptions[key]) {
                            optionEl = el.selectOption(key);
                        } else {
                            optionEl = el.deselectOption(key);
                        }
                        if (multiSelect) {
                            optionEl.copyTo(btnEl);
                            const toggleEl = this.$icon(btnEl, ["toggle"], "toggle", true);
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
                }
            }

            const clickOutsideCallback = (e) => {
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
            const optionEl = this.$button(undefined, ["option" + value, "option", "fillw"], "option" + value);
            let toggleEl;
            if (multiSelect) {
                toggleEl = this.$icon(optionEl, ["toggle"], "toggle", true);
                toggleEl.setPriority(-20);
                toggleEl.setValue(selected ? "check_box" : "check_box_outline_blank");
            }
            const label1El = this.$text(optionEl, ["label"], "label").setValue(label);
            const label2El = this.$text(optionEl, ["secondaryLabel"], "secondaryLabel").setValue("");
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

            el.$$$.selectActions[value] = action;

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
            el.$$$.selectedOptions = {};
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

    static $inputSlide(parentEl, classes = []) {
        const el = this.$(parentEl, undefined, classes, "div");
        el.classList.add("inputSlide");
        el.classList.add("clickable");
        const sliderEl = this.$(el, "slider", ["slider"], "input");
        sliderEl.classList.add("clickable");
        const max = 10;
        sliderEl.type = "range";
        sliderEl.min = 0;
        sliderEl.max = max;
        sliderEl.value = 0;

        el.setLabel = (pos, label) => {
            const posSel = pos.toString().replace(".", "_");
            if (!label) {
                this.$0(el, "#label" + posSel);
                return;
            }
            const labelEl = this.$text(el, ["label"], "label" + posSel).setValue(label);
            labelEl.style.left = `${pos * 100}%`;
            return el;
        };

        const debounce = Constants.DEBOUNCE_CALLBACK_TIME;
        let lastValue = 0;

        sliderEl.addEventListener("input", () => {
            if (el.$$$.slideAction) {
                lastValue = Number(sliderEl.value) / max;
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
                sliderEl.value = value * max;
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        el.removeEventListener("input", cs);
                    });
                });
            } else {
                sliderEl.value = value * max;
            }
            return el;
        };
        el.setAction = (callback) => {
            el.$$$.slideAction = callback;
            return el;
        };

        return el;
    }

    static $newPopup(parentEl, title, classes = [], id) {
        let popupContainerEl = parentEl;
        while (popupContainerEl && !popupContainerEl.classList.contains("popupContainer")) {
            popupContainerEl = popupContainerEl.parentElement;
            if (!popupContainerEl) {
                popupContainerEl = document.body;
                break;
            }
        }
        const el = this.$vlist(popupContainerEl, ["popup", "l$landscape", ...classes], id);
        el.classList.add("clickable");
        this.$title(el, ["center"], "title").setValue(title);
        el.hide();
        return el;
    }
}

export default Html;
export const $vlist = Html.$vlist.bind(Html);
export const $hlist = Html.$hlist.bind(Html);
export const $text = Html.$text.bind(Html);
export const $title = Html.$title.bind(Html);
export const $list = Html.$list.bind(Html);
export const $vsep = Html.$vsep.bind(Html);
export const $hsep = Html.$sep.bind(Html);
export const $img = Html.$img.bind(Html);
export const $icon = Html.$icon.bind(Html);
export const $button = Html.$button.bind(Html);
export const $inputText = Html.$inputText.bind(Html);
export const $inputNumber = Html.$inputNumber.bind(Html);
export const $inputSelect = Html.$inputSelect.bind(Html);
export const $inputSlide = Html.$inputSlide.bind(Html);
export const $newPopup = Html.$newPopup.bind(Html);
