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
            if(html){
                el.innerHTML=value;
                return;
            }
            el.textContent=value;
        }

        
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


}