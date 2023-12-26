import Constants from "../Constants.js";

/**
 * A chaotic wrapper around the DOM API
 * This class is used to create the DOM required for all the UI components.
 * The peculiarity is that the elements are reused if already present in the DOM,
 * this allows to write code that is something in between to immediate mode UIs and
 * retained mode UIs getting rid of the complexity of creation vs update, while also
 * not using any big framework.
 */
export default class Html{
    static _enhance(el, classes=[]){
        if (!classes) classes=[];
       

        if (!el.$$$) el.$$$ = {};

        el.$$$.landScapeClasses=[];
        el.$$$.portraitClasses=[];
        for (const className of classes) {
            if(className.includes("$")){
                const [modifier, classNamePlain]=className.split("$");
                if(modifier=="l"){
                    el.$$$.landScapeClasses.push(classNamePlain);
                }else if(modifier=="p"){
                    el.$$$.portraitClasses.push(classNamePlain);
                }                
            }else{
                el.classList.add(className);
            }
        }

        if (el.$$$.landScapeClasses.length>0||el.$$$.portraitClasses.length>0){
            const classPickOnResize=()=>{
                let isPortrait=false;
                if (Constants.LOCK_MODE){
                    isPortrait=Constants.LOCK_MODE=="portrait";
                }else{
                    isPortrait=window.innerWidth<window.innerHeight;
                }
                if (!isPortrait){
                    for(const className of el.$$$.portraitClasses){
                        el.classList.remove(className);
                    }
                    for(const className of el.$$$.landScapeClasses){
                        el.classList.add(className);
                    }
                }else{
                    for(const className of el.$$$.landScapeClasses){
                        el.classList.remove(className);
                    }
                    for(const className of el.$$$.portraitClasses){
                        el.classList.add(className);
                    }
                }
            };
            el.$$$._classPickOnResize=classPickOnResize;
            window.addEventListener("resize",classPickOnResize);
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
                subtree: true
            });
        }

        // 

        if(Constants.DISABLE_POINTER_EVENTS){
            el.classList.add("disablePointerEvents");
        }

        el.setPriority=(priority)=>{
            el.style.order=priority;
            return el;
        }
        el.grow=(value)=>{
            el.style.flexGrow=value;
            return el;
        }
        el.shrink=(value)=>{
            el.style.flexShrink=value;
            return el;
        };

        el.commitUpdate=()=>{
            const refreshId=el.parentElement.getAttribute("refresh-id");
            el.setAttribute("refresh-id", refreshId);
            return el;
        }

        el.setValue=(value,html=false)=>{
            el.classList.remove("loading");
            if(html){
                el.innerHTML=value;
            }else{
                el.textContent=value;
            }
            return el;
        }
        
        el.setAction=(callback)=>{
            if(el.$$$.clickCallback){
                el.removeEventListener("click",el.$$$.clickCallback);
            }
            el.classList.remove("clickable");
            if(!callback)return;
            el.$$$.clickCallback = callback;
            el.addEventListener("click",callback);
            el.classList.add("clickable");

            return el;
        }





        
    }



    /**
     * Destroy an element
     */
    static $0(parentEl, directSelector){
        const el=parentEl.querySelector(directSelector);
        if(el){
            el.remove();
        }                
    }

    /**
     * Create an element
     */
    static $(parentEl, directSelector, classes = [], type = "div", prepend=false){
        
        let el = parentEl.querySelector(directSelector);
        if(!el){
            el=document.createElement(type);
            if(directSelector.startsWith("#")){
                el.id=directSelector.substr(1);
            }else if(directSelector.startsWith(".")){
                el.classList.add(directSelector.substr(1));
            }
            if(parentEl.$$$&&parentEl.$$$.isList){
                parentEl.addItem(el,1);
            }else{
                if(prepend){
                    parentEl.prepend(el);
                }else{
                    parentEl.appendChild(el);
                }
            }
            el.classList.add("loading");

        }
        this._enhance(el, classes);
        
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

    static $list(parent,directSelector,classes=[]){
        const el = this.$(parent, directSelector, classes);
        el.classList.add("list");
        el.addItem=(item,priority=1)=>{
            if (priority<0){
                el.prepend(item);
            }else{
                el.appendChild(item);
            }
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
    
    static $vlist(parent, directSelector, classes = []) {
        const l = this.$list(parent, directSelector, classes);
        l.classList.add("v");
        return l;
    }

    static $sep(parent,directSelector,classes=[]){
        return this.$(parent, directSelector , classes, "span");
    }


    static $hlist(parent,directSelector,classes=[]){
        const l=this.$list(parent,directSelector,classes);       
        l.classList.add("h");
        return l;
    }

    static $text(parent,directSelector,classes=[]){
        const el = this.$(parent, directSelector , classes, "span");
        el.classList.add("text");
        return el;
    }

    static $title(parent,directSelector,classes=[]){
        const el = this.$(parent, directSelector , classes, "h1");
        return el;
    }

    static $img(parent,directSelector,classes=[]){
        const el = this.$(parent, directSelector , classes, "img");
        el.classList.add("img");
        el.setSrc=(src)=>{
            el.src=src;
            el.classList.remove("loading");
        }
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
        return el;
    }

    static $icon(parent,directSelector,classes=[],prepend=false){
        const iconCntEl=this.$(parent,directSelector,["iconCnt",...classes],"div",prepend);
        let materialIconEl = iconCntEl.querySelector(".material-symbols-outlined");
        if(!materialIconEl){
            materialIconEl = document.createElement("div");
            materialIconEl.classList.add("icon");
            materialIconEl.classList.add("material-symbols-outlined");
            materialIconEl.innerText="cached";
        }

        let iconImgEl = iconCntEl.querySelector(".img");
        if(!iconImgEl){
            iconImgEl = document.createElement("img");
            iconImgEl.classList.add("icon");
            iconImgEl.classList.add("img");
        }

        materialIconEl.classList.add("loading");
        iconImgEl.remove();
        iconCntEl.appendChild(materialIconEl);
        materialIconEl.innerText = "cached";

        iconCntEl.setValue=(value)=>{
            const imgEl=iconCntEl.querySelector(".img");
            if(imgEl){
                iconCntEl.removeChild(imgEl);
                iconCntEl.appendChild(materialIconEl);
            }            
            materialIconEl.classList.remove("loading");
            materialIconEl.innerText=value;
            return iconCntEl;
        }
        iconCntEl.setSrc=(src)=>{
            const materialIconEl=iconCntEl.querySelector(".material-symbols-outlined");
            if(materialIconEl){
                iconCntEl.removeChild(materialIconEl);
                iconCntEl.appendChild(iconImgEl);
            }
            iconImgEl.classList.remove("loading");
            iconImgEl.src=src;
            return iconCntEl;
        }
        return iconCntEl;
    }

    static $inputText(parent,directSelector,classes=[]){
        const el = this.$(parent, directSelector , classes, "input");
        el.type="text";
        el.classList.add("clickable");

        el.setPlaceHolder = (placeholder) => {
            el.placeholder = placeholder;
            return el;
        };
        el.setAction = (callback) => {
            el.$$$.onChangeCallback = callback;
             
            return el;
        };
        el.setValue = (value) => {
            el.value = value;
            return el;
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
        el.setIconValue=(value)=>{
            if(!value){
                this.$0(el,".icon");
                el.classList.remove("withIcon");
            }else{
                const iconEl=this.$icon(el,".icon",["buttonIcon"],true);
                iconEl.setValue(value);
                el.classList.add("withIcon");
            }
            return el;
        };
        el.setIconSrc=(src)=>{
            if(!src){
                this.$0(el,".icon");
                el.classList.remove("withIcon");
            }else{
                const iconEl=this.$icon(el,".icon",["buttonIcon"],true);
                iconEl.setSrc(src);
                el.classList.add("withIcon");
            }
            return el;
        };
        return el;

    }

    static $inputNumber(parent, directSelector,classes=[]){
        const el = this.$(parent, directSelector , classes, "input");
        el.type="number";
        el.classList.add("clickable");

        el.setPlaceHolder = (placeholder) => {
            el.placeholder = placeholder;
            return el;
        };
        el.setAction = (callback) => {
            el.$$$.onChangeCallback = callback;
           
            return el;
        };
        el.setValue = (value) => {
            el.value = value;
            return el;
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
        el.classList.add("clickable");

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
            return el;
        }
        el.removeOption=(value)=>{
            let optionEl=el.querySelector(`option[value="${value}"]`);
            if(optionEl){
                el.removeChild(optionEl);
            }
            _selectPreferred();
            return el;
        }
        el.clearOptions=()=>{
            for(const optionEl of el.querySelectorAll("option")){
                el.removeChild(optionEl);
            }
            return el;
        }
        
        el.setPreferredValues=(values)=>{
            el.$$$.preferredValues=values;
            el.$$$.preferredValueSelected=false;
            _selectPreferred();
            return el;
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