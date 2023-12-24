import Constants from "./Constants.js";
export default class Html{
    static _enhance(el){
        el.setPriority=(priority)=>{
            el.style.order=priority;
        }

        el.commitUpdate=()=>{
            const refreshId=el.parentElement.getAttribute("refresh-id");
            el.setAttribute("refresh-id", refreshId);
        }

        el.setValue=(value,html=false)=>{
            el.classList.remove("loading");
            if(html){
                el.innerHTML=value;
            }else{
                el.textContent=value;
            }
        }

        if(!el.$$$)el.$$$={};

        
    }


    static $(parentEl, directSelector, classes = [], type = "div"){
        
        let el = parentEl.querySelector(directSelector);
        if(!el){
            el=document.createElement(type);
            if(directSelector.startsWith("#")){
                el.id=directSelector.substr(1);
            }else if(directSelector.startsWith(".")){
                el.classList.add(directSelector.substr(1));
            }
            if(parentEl.$$$&&parentEl.$$$.isList){
                parentEl.addItem(el);
            }else{
                parentEl.appendChild(el);
            }
            el.classList.add("loading");

        }
        this._enhance(el);
        for(const className of classes){
            el.classList.add(className);
        }
        return el;
    }
    static elById(parentEl, id, classes = [], type = "div"){
        let el=parentEl.querySelector(`#${id}`);
        if(!el){
            el=document.createElement(type);
            el.id=id;
            parentEl.appendChild(el);
        }
        this._enhance(el);
        for(const className of classes){
            el.classList.add(className);
        }
        return el;
    }

    static elByType(parentEl, type,classes=[]){
        let el=parentEl.querySelector(`${type}`);
        if(!el){
            el=document.createElement(type);
            parentEl.appendChild(el);
        }
        this._enhance(el);
        for(const className of classes){
            el.classList.add(className);
        }

        return el;

    }

    static elByClass(parentEl, className, extraClasses=[], type="div"){
        let el=parentEl.querySelector(`.${className}`);
        if(!el){
            el=document.createElement(type);
            el.classList.add(className);
            parentEl.appendChild(el);
        }
        this._enhance(el);
        for(const extraClass of extraClasses){
            el.classList.add(extraClass);
        }
        return el;
    }

    static enableOutScroll(el,value=true){
        el.classList.add("outscroll");
        const resizeCallback=()=>{             
            if (el.scrollWidth > el.clientWidth) {
                el.classList.add("outside");                
            } else {
                el.classList.remove("outside");
            }
        }
        if(!el.$$$.enableOutScrollData){
            el.$$$.enableOutScrollData={};
        }
        if (el.$$$.enableOutScrollData.resizeCallback) {
            window.removeEventListener("resize", el.$$$.enableOutScrollData.resizeCallback);
            el.$$$.enableOutScrollData.resizeCallback = null;
        }
        if(el.$$$.enableOutScrollData.observer){
            el.$$$.enableOutScrollData.observer.disconnect();
            el.$$$.enableOutScrollData.observer = null;
        }
        if(el.$$$.enableOutScrollData.resizeObserver){
            el.$$$.enableOutScrollData.resizeObserver.disconnect();
            el.$$$.enableOutScrollData.resizeObserver=null;
        }
        if (!value)return;

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
            subtree: true
        });
        el.$$$.enableOutScrollData.observer=observer;
        el.$$$.enableOutScrollData.resizeObserver=resizeObserver;
        el.$$$.enableOutScrollData.resizeCallback=resizeCallback;
        resizeCallback();
    }

    static initializeListUpdate(parentEl){
        let refreshId = parentEl.getAttribute("refresh-id");
        if(!refreshId){
            refreshId = "rf"+Date.now() + Math.floor(Math.random() * 1000);
            parentEl.setAttribute("refresh-id", refreshId);        
        }
        
    }

    static commitListUpdate(parentEl){
        const refreshId = parentEl.getAttribute("refresh-id");
        const els = parentEl.querySelectorAll(`asset:not([refresh-id="${refreshId}"])`);
        for (const el of els) {
            els.removeChild(el);
        }
        parentEl.removeAttribute("refresh-id");
    }

    static $vlist(parent,directSelector,classes=[]){
        const el = this.$(parent, directSelector, classes);
        el.classList.add("list");
        el.classList.add("v");
        this._enhance(el);
        el.addItem=(item,priority=0)=>{
            el.appendChild(item);
            if (item.setPriority)item.setPriority(priority);
            item.classList.add("listItem");
            el.classList.remove("loading");
        };
        el.initUpdate=()=>{
            this.initializeListUpdate(el);
        };
        el.commitUpdate=()=>{
            this.commitListUpdate(el);
        };
        if(!el.$$$)el.$$$={};
        el.$$$.isList=true;
        this._addCover(el);
        return el;
    }

    static $hlist(parent,directSelector,classes=[]){
        const l=this.$vlist(parent,directSelector,classes);
        l.classList.remove("v");
        

        l.classList.add("h");
        return l;
    }

    static $text(parent,directSelector,classes=[]){
        const el = this.$(parent, directSelector , classes, "span");
        el.classList.add("text");
        this._enhance(el);
        return el;
    }

    static $img(parent,directSelector,classes=[]){
        const el = this.$(parent, directSelector , classes, "img");
        el.classList.add("img");
        el.setSrc=(src)=>{
            el.src=src;
            el.classList.remove("loading");
        }
        this._enhance(el);
        return el;
    }

    static makeDragScrollable(el){
        let isDown = false;
        let startX;
        let scrollLeft;
        el.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - el.offsetLeft;
            scrollLeft = el.scrollLeft;
        });
        el.addEventListener('mouseleave', () => {
            isDown = false;
        });
        el.addEventListener('mouseup', () => {
            isDown = false;
        });
        el.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - el.offsetLeft;
            const walk = (x - startX) * 3; //scroll-fast
            el.scrollLeft = scrollLeft - walk;
        });
    }

    static _addCover(el){
        let coverEl = el.querySelector(".cover");
        if (!coverEl) {
            coverEl = document.createElement("div");
            coverEl.classList.add("cover");
            el.appendChild(coverEl);
        }
        el.setCover = (coverUrl) => {
            coverEl.style.backgroundImage = `url(${coverUrl})`;
        }
    }

    static $cnt(parent,directSelector,classes=[]){
        const el = this.$(parent, directSelector , classes, "div");
        el.classList.add("cnt");
       this._addCover(el);
        this._enhance(el);
        return el;
    }

    static $icon(parent,directSelector,classes=[]){
        const iconCntEl=this.$(parent,directSelector,["iconCnt",...classes],"div");
        const materialIconEl = document.createElement("div");
        materialIconEl.classList.add("icon");
        materialIconEl.classList.add("material-symbols-outlined");
        materialIconEl.innerText="cached";
        iconCntEl.appendChild(materialIconEl);

        const iconImgEl = document.createElement("img");
        iconImgEl.classList.add("icon");
        iconImgEl.classList.add("img");
        materialIconEl.classList.add("loading");

        this._enhance(iconCntEl);
        iconCntEl.setValue=(value)=>{
            const imgEl=iconCntEl.querySelector(".img");
            if(imgEl){
                iconCntEl.removeChild(imgEl);
                iconCntEl.appendChild(materialIconEl);
            }            
            materialIconEl.classList.remove("loading");

            materialIconEl.innerText=value;
        }
        iconCntEl.setSrc=(src)=>{
            const materialIconEl=iconCntEl.querySelector(".material-symbols-outlined");
            if(materialIconEl){
                iconCntEl.removeChild(materialIconEl);
                iconCntEl.appendChild(iconImgEl);
            }
            iconImgEl.classList.remove("loading");

            iconImgEl.src=src;
        }
        return iconCntEl;
    }

    static $inputText(parent,directSelector,classes=[]){
        const el = this.$(parent, directSelector , classes, "input");
        el.type="text";
        this._enhance(el);
        el.setPlaceHolder = (placeholder) => {
            el.placeholder = placeholder;
        };
        el.setAction = (callback) => {
            el.$$$.onChangeCallback = callback;
        };
        el.setValue = (value) => {
            el.value = value;
        };
        el.getValue = () => {
            return el.value;
        };
        if (el.$$$.onChangeCallbakWrapper) {
            el.removeEventListener("change", el.$$$.onChangeCallbakWrapper);
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

    static $button(parent,directSelector,classes=[]){
        const el = this.$(parent, directSelector , classes, "button");
        this._enhance(el);
        el.setAction = (callback) => {
            el.$$$.onClickCallback = callback;
        };
        el.setValue = (value) => {
            el.textContent = value;
        };
        el.getValue = () => {
            return el.textContent;
        };
        if (el.$$$.onClickCallbakWrapper) {
            el.removeEventListener("click", el.$$$.onClickCallbakWrapper);
        }
        el.$$$.onClickCallbakWrapper = () => {
            if (el.$$$.onClickCallback) {
                el.$$$.onClickCallback(el.getValue());
            }
        };
        el.addEventListener("click", el.$$$.onClickCallbakWrapper);
        return el;

    }

    static $inputNumber(parent, directSelector,classes=[]){
        const el = this.$(parent, directSelector , classes, "input");
        el.type="number";
        this._enhance(el);
        el.setPlaceHolder = (placeholder) => {
            el.placeholder = placeholder;
        };
        el.setAction = (callback) => {
            el.$$$.onChangeCallback = callback;
        };
        el.setValue = (value) => {
            el.value = value;
        };
        el.getValue = () => {
            let v= Number(el.value);
            if(isNaN(v)) return 0;
            return v;
        };
        if (el.$$$.onChangeCallbakWrapper) {
            el.removeEventListener("change", el.$$$.onChangeCallbakWrapper);
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


    static $inputSelect(parent,directSelector,classes=[]){
        const el = this.$(parent, directSelector , classes, "select");
        this._enhance(el);

        const _selectPreferred=()=>{
            if (!el.$$$.preferredValues)return;
            for(const value of el.$$$.preferredValues){
                
                const optionEl=el.querySelector(`option[value="${value}"]`);
                if (optionEl){
                    optionEl.selected=true;
                    optionEl.setAttribute("preferred",true);
                    el.value=value; 
                    
                    if (el.$$$.onChangeCallbacks&&el.$$$.onChangeCallbacks[value])el.$$$.onChangeCallbacks[value](value);


                    break;
                }
            }
        }
        el.addOption=(value, label, action=()=>{})=>{
            let optionEl=el.querySelector(`option[value="${value}"]`);
            if(!optionEl){
                optionEl=document.createElement("option");
                optionEl.value=value;
                el.appendChild(optionEl);
            }
            optionEl.textContent=label;
            if (!el.$$$.onChangeCallbacks){
                el.$$$.onChangeCallbacks = {};
            }
            el.$$$.onChangeCallbacks[value]=action;
            _selectPreferred();
            if (el.value ==value)action(el.value);
        }
        el.removeOption=(value)=>{
            let optionEl=el.querySelector(`option[value="${value}"]`);
            if(optionEl){
                el.removeChild(optionEl);
            }
            _selectPreferred();
        }
        el.clearOptions=()=>{
            for(const optionEl of el.querySelectorAll("option")){
                el.removeChild(optionEl);
            }
        }
        
        el.setPreferredValues=(values)=>{
            el.$$$.preferredValues=values;
            el.$$$.preferredValueSelected=false;
            _selectPreferred();
        }

        if (el.$$$.onChangeCallbakWrapper) {
            el.removeEventListener("change", el.$$$.onChangeCallbakWrapper);
        }
        el.$$$.onChangeCallbakWrapper = ()=>{
            
            if (el.$$$.onChangeCallbackScheduledTimeout) {
                clearTimeout(el.$$$.onChangeCallbackScheduledTimeout);
            }
            el.$$$.onChangeCallbackScheduledTimeout = setTimeout(() => {
                if (el.$$$.onChangeCallbacks) {
                    const value=el.value;
                    
                    if (el.$$$.onChangeCallbacks[value])el.$$$.onChangeCallbacks[value](value);
                }
            }, Constants.DEBOUNCE_CALLBACK_TIME);
        };
        
        el.addEventListener("change", el.$$$.onChangeCallbakWrapper);
        return el;
    }

}