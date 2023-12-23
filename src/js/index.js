
import LiquidProvider from "./LiquidProvider.js";
import Html from "./Html.js";



async function renderAssets(parentEl, lq){
    const balance = await lq.getBalance();
    const assetsEl = Html.elById(parentEl, "assets",["list"]);
    assetsEl.setPriority(-10);

    Html.initializeListUpdate(assetsEl);
    await Promise.all(balance.map(asset => {
        const id = "asset" + asset.hash.substr(0, 8) + asset.hash.substr(-8);
        const assetEl = Html.elById(assetsEl, id,["asset","listItem"]);
        const coverEl = Html.elByClass(assetEl, "cover", [], "div");

        //>iconCnt< >labelCnt<           >balanceCnt<
        // IC ###  NAME  ## ###########   BALANCE     #
        // ON ### ticker ## ########### bprim / bsec  #
        //                              >balanceAltCnt<

        const iconCntEl=Html.elByClass(assetEl,"iconCnt",[]);
        const labelCntEl=Html.elByClass(assetEl,"labelCnt",[]);
        const balanceCntEl=Html.elByClass(assetEl,"balanceCnt",[]);

        const iconEl = Html.elByClass(iconCntEl, "icon", [], "img");

        const tickerEl = Html.elByClass(labelCntEl, "ticker", [], "span");
        const nameEl = Html.elByClass(labelCntEl, "name", ["sub"], "span");
        const balanceEl=Html.elByClass(balanceCntEl,"balance",[],"span");

        const balanceAltCntEl = Html.elByClass(balanceCntEl, "balanceAltCnt", ["sub"]);

        const balancePrimaryEl = Html.elByClass(balanceAltCntEl, "balancePrimary", [], "span");
        const sepEl=Html.elByClass(balanceAltCntEl,"sep",[],"span");
        sepEl.setValue("/");
        const balanceSecondaryEl = Html.elByClass(balanceAltCntEl, "balanceSecondary", [], "span");

        const loadInfoPromise=Promise.resolve(asset.info).then((info)=>{
            try {

                tickerEl.setValue(info.ticker);

                nameEl.setValue(info.name);

                const floatValue = asset.value ? (asset.value / 10 ** info.precision).toFixed(info.precision) : 0;

                balanceEl.setValue(floatValue);

                if (floatValue){
                    lq.exchange.getPrice(floatValue, asset.hash, undefined).then((price) => {
                        balancePrimaryEl.setValue(price);
                        assetEl.setPriority(-price);
                    });
                }else{
                    assetEl.setPriority(0);
                }
                if (floatValue) {
                    lq.exchange.getPrice(floatValue, asset.hash, "USD").then((price) => {
                        balanceSecondaryEl.setValue(price.toFixed(2));
                    });
                }  
                // const balanceSecondaryEl=Html.elByClass(assetEl,"balance-secondary","span");
                // balanceSecondaryEl.setValue(asset.balanceSecondary);              
            } catch (e) {
                console.error(e);
            }
        });

        const loadIconPromise=Promise.resolve(asset.icon).then((icon)=>{
            try {                 
                iconEl.src = icon;
                coverEl.style.backgroundImage = `url(${icon})`;
            } catch (e) {
                console.error(e);
            }
        });
        return Promise.all([loadInfoPromise,loadIconPromise]);
    }));
    Html.commitListUpdate(assetsEl);

}


async function renderHistoryPanel(parentEl, lq, filter, limit = 20, page = 0) {
    const historyEl = Html.elById(parentEl, "history",["list"]);
    
    let history = (await lq.getHistory()).slice(page * limit, page * limit + limit);
    
    Html.initializeListUpdate(historyEl);
    for (const tx of history) {
        const id = "history" + (tx.tx_hash.substr(0, 8) + tx.tx_hash.substr(-8));
        const txEl = Html.elById(historyEl, id, ["list", "historyEntry", "listItem"], "div" );
        const txHashEl = Html.elByClass(txEl, "tx-hash", [], "span");
        txHashEl.setValue(tx.tx_hash);

        const isConfirmed = tx.confirmed;
        const txStatusEl = Html.elByClass(txEl, "tx-status", [],"span");
        txStatusEl.setValue(isConfirmed ? "confirmed" : "unconfirmed");
        txEl.classList.toggle("confirmed", isConfirmed);
        txEl.classList.toggle("unconfirmed", !isConfirmed);

        txEl.setPriority(-tx.height);
        lq.getTxInfo(tx,true,true).then((txInfo)=>{
            console.log(txInfo);
        });
        
    }
    Html.commitListUpdate(historyEl);

}

async function renderBalance(parentEl, lq) {
    const balanceSumCntEl = Html.elById(parentEl, "balanceSumCnt",[]);
    const balanceSumEl=Html.elByClass(balanceSumCntEl,"balanceSum",[],"span");
    const balanceSumAltCntEl = Html.elByClass(balanceSumCntEl, "balanceSumAltCnt", ["sub"]);
    const balanceSumPrimaryEl = Html.elByClass(balanceSumAltCntEl, "balanceSumPrimary", [], "span");
    const sepEl = Html.elByClass(balanceSumAltCntEl, "sep", [], "span");
    sepEl.setValue("/");
    const balanceSumSecondaryEl = Html.elByClass(balanceSumAltCntEl, "balanceSumSecondary", [], "span");
    
    balanceSumEl.setValue("0.22");
    balanceSumPrimaryEl.setValue("0.22");
    balanceSumSecondaryEl.setValue("0.22");

    balanceSumCntEl.setPriority(-20); 


}

async function renderSendReceive(parentEl, lq){
    const sendReceiveCntEl=Html.elById(parentEl,"sendReceiveCnt",["buttons"]);
    const sendEl=Html.elByClass(sendReceiveCntEl,"send",["button","send"]);
    const receiveEl=Html.elByClass(sendReceiveCntEl,"receive",["button","receive"]);
    sendReceiveCntEl.setPriority(-15);

    sendEl.setValue(`
    <span class="icon material-symbols-outlined">arrow_upward</span>
    <span>Send</span>
    `,true);

    receiveEl.setValue(`
    <span class="icon material-symbols-outlined">arrow_downward</span>
    <span>Receive</span>
    `,true);


}


async function renderHeader(walletEl,lq){
    const headerEl=Html.elById(walletEl,"header",["header"]);
    const iconEl = Html.elByClass(headerEl, "icon", ["icon"]);
    iconEl.classList.add("material-symbols-outlined");
    iconEl.setValue("wallet");
    
    const titleEl=Html.elByClass(headerEl,"title",["title"]);
    titleEl.setValue("TBD Liquid Wallet");
    const optionsBtnEl=Html.elByClass(headerEl,"optionsBtn",["button","options"]);
    optionsBtnEl.setValue(`
   <span class="icon material-symbols-outlined">
settings
</span>
    `,true);
    headerEl.setPriority(-30); 

}

async function renderSearchBar(walletEl,lq,render){
    const searchBarEl=Html.elById(walletEl,"searchBar",["searchBar","list"]);
    const searchInputEl=Html.elByClass(searchBarEl,"searchInput",["input","listItem"],"input");
    searchInputEl.setAttribute("placeholder","Search");
    searchInputEl.setAttribute("type","text");
    searchInputEl.setAttribute("autocomplete","off");
    searchInputEl.setAttribute("autocorrect","off");
    searchInputEl.setAttribute("autocapitalize","off");
    searchInputEl.setAttribute("spellcheck","false");
    searchBarEl.setPriority(-10);
    let lastValue="";
    let scheduledTimeout=undefined;
    searchInputEl.addEventListener("input",()=>{
        const value=searchInputEl.value;
        if(value===lastValue)return;
        lastValue=value;
        if(scheduledTimeout)clearTimeout(scheduledTimeout);
        scheduledTimeout=setTimeout(()=>{
            render(value);
        },100);
    });
    
}

async function refreshUI(lq) {
    const walletEl=document.body.querySelector("liquidWallet");
    if(!walletEl) alert("No wallet element found")
    const render=(filter)=>{
        renderAssets(walletEl, lq, filter);
        renderHistoryPanel(walletEl, lq, filter);
        renderBalance(walletEl, lq);
        renderSendReceive(walletEl, lq, filter);
        renderHeader(walletEl,lq);
    };
    renderSearchBar(walletEl,lq,render);
    render("");

}


async function main() {
    // import('./LiquidProvider.js').then(async ({ default: LiquidProvider }) => {
        const lq = new LiquidProvider();
        lq.addRefreshCallback(()=>{
        refreshUI(lq);
        });   
    await lq.start();

        window.lq = lq;
    // });
   
}


window.debugShow=function (dataUrl){
    let imgEl=document.querySelector("#debugImg");
    if(!imgEl){
        imgEl=document.createElement("img");
        imgEl.id="debugImg";
        document.body.appendChild(imgEl);
    }
    imgEl.style.display="block";
    
    imgEl.src=dataUrl;


}
window.addEventListener("load", main);