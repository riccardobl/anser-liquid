
import LiquidProvider from "./LiquidWallet.js";
import Html from "./Html.js";



async function renderAssets(parentEl, lq,filter){
    const assetsEl = Html.$hlist(parentEl, "#assets")
    Html.enableOutScroll(assetsEl);
    assetsEl.setPriority(-10);
    assetsEl.initUpdate();
    const balance = await lq.getBalance();
    // const assetsEl = Html.elById(parentEl, "assets",["list"]);
    // assetsEl.setPriority(-10);
    

    await Promise.all(balance.map(asset => {
      
        const id = "asset" + asset.hash.substr(0, 8) + asset.hash.substr(-8);

        const assetEl=Html.$vlist(assetsEl,"#"+id,["asset"]);        
        const labelCntEl = Html.$vlist(assetEl, ".labelCnt");
        const iconEl = Html.$icon(assetEl, ".icon", ["big"]);

        const balanceCntEl=Html.$vlist(assetEl,".balanceCnt");


        const balanceEl = Html.$text(balanceCntEl, ".balance");
        const balanceAltCntEl=Html.$hlist(balanceCntEl,".balanceAltCnt");

        //>iconCnt< >labelCnt<           >balanceCnt<
        // IC ###  NAME  ## ###########   BALANCE     #
        // ON ### ticker ## ########### bprim / bsec  #
        //                              >balanceAltCnt<
        
        const tickerEl=Html.$text(labelCntEl,".ticker",["title"]);
        const nameEl = Html.$text(labelCntEl, ".name", ["sub","smaller"]);


        const balancePrimaryEl = Html.$text(balanceAltCntEl, ".balancePrimary");
        const sepEl=Html.$text(balanceAltCntEl,".sep");
        sepEl.setValue("/");
        const balanceSecondaryEl = Html.$text(balanceAltCntEl, ".balanceSecondary",["sub"]);
 
        const loadInfoPromise=Promise.resolve(asset.info).then((info)=>{
            console.log("Info ",info);
            try {

                if (filter) {
                    if (!filter(asset.hash, true) && !filter(info.ticker)&&!filter(info.name)) {
                        assetEl.remove();
                        return;
                    }                    
                }

                tickerEl.setValue(info.ticker);

                nameEl.setValue(info.name);

                // const floatValue = asset.value ? (asset.value / 10 ** info.precision).toFixed(info.precision) : 0;
                lq.v(asset).human().then((value)=>{
                    balanceEl.setValue(value);
                });
                // lq.convertAsString(asset.value, asset.hash, asset.hash).then((price) => {
                //     balanceEl.setValue(price);
                // });
                // balanceEl.setValue(floatValue);


                // if (floatValue){
                lq.v(asset).human(lq.getBaseAsset()).then((price)=>{
                // lq.convertAsString(asset.value, asset.hash, lq.getBaseAsset()).then((price)=>{
                        if (price){
                            balancePrimaryEl.setValue(price);
                            assetEl.setPriority(-Math.floor(Number(price.split(" ")[0])*100000));
                        }else{
                            assetEl.setPriority(0);
                            balancePrimaryEl.setValue("-");
                        }
                    });
                    // lq.exchange.getPrice(floatValue, asset.hash, undefined).then((price) => {
                    //     balancePrimaryEl.setValue(price);
                    //     assetEl.setPriority(-price);
                    // });
                // }else{
                // }
    
                lq.v(asset).human("USD").then((price) => {

                // lq.convertAsString(asset.value, asset.hash, "USD").then((price) => {
                    if (price) {
                        balanceSecondaryEl.setValue(price);
                    } else {
                        balanceSecondaryEl.setValue("-");
                    }
                });

                // const balanceSecondaryEl=Html.elByClass(assetEl,"balance-secondary","span");
                // balanceSecondaryEl.setValue(asset.balanceSecondary);              
            } catch (e) {
                console.error(e);
            }
        });
        console.log("Asset ",asset);
        const loadIconPromise=Promise.resolve(asset.icon).then((icon)=>{
            console.info("Loading icon",icon,asset)
            try {                 
                iconEl.setSrc( icon);
                assetEl.setCover(icon);                
            } catch (e) {
                console.error(e);
            }
        });
        return Promise.all([loadInfoPromise,loadIconPromise]);
    }));
    assetsEl.commitUpdate();

}


async function renderHistoryPanel(parentEl, lq, filter, limit = 20, page = 0) {
    const historyEl = Html.$vlist(parentEl, "#history", ["list"]);
        
    const history = (await lq.getHistory()).slice(page * limit, page * limit + limit);

    historyEl.initUpdate();
    for (const tx of history) {
        const id = "history" + (tx.tx_hash.substr(0, 8) + tx.tx_hash.substr(-8));
        const txElCnt = Html.$vlist(historyEl, "#" + id, []);
        const txElCnt2 = Html.$hlist(txElCnt, ".tx", ["fill"]);

        /*
        DIRECTION   # SYMBOL                 # STATUS TXHASH
               ICON # AMOUNT ( AMOUNT ALT )  # BLOCKTIME
         View on block explorer
        */

        const c1El = Html.$vlist(txElCnt2,".c1");

        const txDirectionEl = Html.$icon(c1El,".direction");
        const txAssetIconEl = Html.$icon(c1El, ".txAssetIcon");

        const txSymbolEl = Html.$text(txElCnt2, ".txSymbol");
        const txAmountCntEl = Html.$hlist(txElCnt2, ".txAmount");
        const txAmountEl = Html.$text(txAmountCntEl, ".txAmount",["sub"]);
        // Html.$text(txAmountCntEl, ".sep1").setValue("(");
        // const txAmountAltPrimaryEl = Html.$text(txAmountCntEl, ".txAmountAltPrimary");
        // const txAmountAltSecondaryEl = Html.$text(txAmountCntEl, ".txAmountAltSecondary");
        // Html.$text(txAmountCntEl, ".sep2").setValue(")");

        const statusTxHashCntEl = Html.$hlist(txElCnt,".statusTxHash");
        const txHashEl = Html.$text(statusTxHashCntEl, ".txHash", ["toolong"]);

        const txStatusEl = Html.$icon(statusTxHashCntEl, ".txStatus");
        const blockTimeEl = Html.$text(txElCnt, ".blockTime");


        txStatusEl.setValue(tx.confirmed ? "done" : "cached");
        if(!tx.confirmed)txStatusEl.classList.add("loading");
        else txStatusEl.classList.remove("loading");
        txElCnt.classList.toggle("confirmed", tx.confirmed);
        txElCnt.classList.toggle("unconfirmed", !tx.confirmed);
        txElCnt.setPriority(-tx.height);

        txHashEl.setValue(tx.tx_hash.substr(0,16)+"...");

        lq.getTxInfo(tx.tx_hash,true,true).then((txInfo)=>{
            if (!txInfo.valid){
                txDirectionEl.setValue("receipt_log");
            }else{
            
                if (txInfo.isIncoming) {
                    // if(typeof res!="undefined" ){
                    //     if(res){
                    txDirectionEl.setValue("arrow_downward");
                    txDirectionEl.classList.add("incoming");
                    txInfo.inAssetIcon.then((icon) => {
                        txAssetIconEl.setSrc(icon);
                    });

                    txInfo.inAssetInfo.then(info => {
                        if (filter) {
                            if (!filter(info.hash, true) && !filter(info.ticker) && !filter(info.name) && !filter(tx.tx_hash, true)) {
                                txElCnt.remove();
                                return;
                            }
                        }

                        txSymbolEl.setValue(info.ticker);
                    });

                    lq.v(txInfo.inAmount, txInfo.inAsset).human().then((value) => {
                        // lq.convertAsString(txInfo.outAmount, txInfo.outAsset, txInfo.outAsset).then((value)=>{
                        txAmountEl.setValue(value);
                    });
                } else {
                    txDirectionEl.setValue("arrow_upward");
                    txDirectionEl.classList.add("outgoing");
                    txInfo.outAssetIcon.then((icon) => {
                        txAssetIconEl.setSrc(icon);
                    });

                    txInfo.outAssetInfo.then(info => {
                        if (filter) {
                            if (!filter(info.hash, true) && !filter(info.ticker) && !filter(info.name) && !filter(tx.tx_hash, true)) {
                                txElCnt.remove();
                                return;
                            }
                        }

                        txSymbolEl.setValue(info.ticker);
                    });

                    lq.v(txInfo.outAmount,txInfo.outAsset).human().then((value) => {
                        // lq.convertAsString(txInfo.outAmount, txInfo.outAsset, txInfo.outAsset).then((value)=>{
                        txAmountEl.setValue(value);
                    });
                }
            }
            //     }else{
            //         txDirectionEl.setValue("receipt_log");
            //         txDirectionEl.classList.add("unknown");
            //     }
            // });

            txInfo.blockTime().then((timestamp)=>{
                const  date=new Date(timestamp*1000);
                blockTimeEl.setValue(date.toLocaleString());
            });
             

            // if (txInfo.outAmount){
            //     txInfo.getOutValue(undefined,true,true).then((value)=>{
            //         txAmountAltPrimaryEl.setValue(value);
            //     });
            //     txInfo.getOutValue("USD",true,true).then((value)=>{
            //         txAmountAltSecondaryEl.setValue(value);
            //     });

            // }else{
            //     txAmountAltPrimaryEl.setValue("-");
            //     txAmountAltSecondaryEl.setValue("-");
            // }

           
            console.log("TxInfo",txInfo);
        });
        
    }
    Html.commitListUpdate(historyEl);

}

async function renderBalance(parentEl, lq) {
    
    const balanceSumCntEl=Html.$cnt(parentEl,"#balanceSumCnt",[]);
    const balanceSumEl=Html.$text(balanceSumCntEl,".balanceSum",[]);
    const balanceSumSecondaryEl =Html.$hlist(balanceSumCntEl,".balanceSumAltCnt",["sub"]);
    
   
    balanceSumCntEl.setPriority(-20); 

    let sumPrimary=0;
    let sumSecondary=0;
    let primarySymbol="";
    let secondarySymbol="";
    lq.getBalance().then((assets)=>{
        for(const asset of assets){
            lq.v(asset).human(lq.getBaseAsset()).then((value)=>{
            // lq.convertAsString(asset.value ,asset.hash, lq.getBaseAsset()).then((value)=>{
                [value,primarySymbol]=value.split(" ");
                sumPrimary+=Number(value);
                balanceSumEl.setValue(sumPrimary + " " + primarySymbol);
            });
            lq.v(asset).human("USD").then((value)=>{
            // lq.convertAsString(asset.value, asset.hash ,"USD").then((value)=>{
                [value,secondarySymbol]=value.split(" ");
                sumSecondary+=Number(value);
                balanceSumSecondaryEl.setValue(sumSecondary + " " + secondarySymbol);
            });
        }
    });




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
            const words = lastValue.toLowerCase().split(" ").filter(w=>w.trim().length>0);
            render((str,partial)=>{
                str=str.toLowerCase().trim();
                if(words.length===0)return true;
                for(const word of words){
                    if(str.includes(word)){
                        console.log("Match",str,word);
                        return true;
                    }
                }
                return false;


            });
        },1000);
    });
    
}


const STAGES={
    "home": (walletEl,lq)=>{
        const render = (filter) => {

            renderAssets(walletEl, lq, filter);
            renderHistoryPanel(walletEl, lq, filter);
            renderBalance(walletEl, lq);
            renderSendReceive(walletEl, lq, filter);
        };
        renderSearchBar(walletEl, lq, render);
        render("");
    },
    "options": (walletEl,lq)=>{

    },
    "receive": (walletEl,lq)=>{
       
        renderReceive(walletEl,lq);

    },
    "send": (walletEl,lq)=>{
        renderSend(walletEl,lq);
    }

}

async function renderSend(walletEl,lq){
    let ASSET_HASH=await lq.getBaseAsset();
    let ASSET_INFO=await lq.getBaseAssetInfo();
    let INPUT_AMOUNT=0;

    let INPUT_CURRENCY = "USD";
    let INPUT_INFO = "USD";

    let TO_ADDR ="";

    const sendCntEl = Html.$vlist(walletEl, "#send");

    const sendAssetCnt=Html.$hlist(sendCntEl,"#sendAssetCnt",["fill"]);
    const sendAssetLabelEl=Html.$text(sendAssetCnt,".label");
    sendAssetLabelEl.setValue("Asset");
    const sendAssetEl=Html.$inputSelect(sendAssetCnt,".asset");
    sendAssetEl.setPreferredValues([ASSET_HASH]);
    lq.getPinnedAssets().then((assets) => {
        for (const asset of assets) {
            asset.info.then(info => {
                sendAssetEl.addOption(asset.hash, info.ticker, (value) => {
                    ASSET_HASH = value;
                    ASSET_INFO = info;
                });
            });
        }
    });

    const sendEl = Html.$hlist(sendCntEl, "#sendEl", ["fill"]);
    const labelValueEl=Html.$text(sendEl,".label");
    labelValueEl.setValue("Amount");
    const valueEl=Html.$inputNumber(sendEl,".value");
    valueEl.setPlaceHolder("0.00");
    valueEl.setAction((value)=>{
        INPUT_AMOUNT=value;
    });

    const currencyEl=Html.$inputSelect(sendEl,".currency");
    currencyEl.setPreferredValues([await lq.getBaseAsset(), "USD"]);
    lq.getPinnedAssets().then((assets) => {
        for (const asset of assets) {
            asset.info.then(info => {
                currencyEl.addOption(asset.hash, info.ticker, (value) => {
                    INPUT_CURRENCY = value;
                    INPUT_INFO = info;
                });
            });
        }
    });

    const addrCntEl=Html.$hlist(sendCntEl,"#addCnt",["fill"]);
    const addrLabelEl=Html.$text(addrCntEl,".label");
    addrLabelEl.setValue("To");
    const addrEl=Html.$inputText(addrCntEl,".addr");
    addrEl.setPlaceHolder("Address");
    addrEl.setAction((value)=>{
        TO_ADDR=value;
    });

    const sendBtnEl=Html.$button(sendCntEl,"#sendBtn",["fill","button"]);
    sendBtnEl.setValue("Confirm and sign");
    sendBtnEl.setAction(async ()=>{
        let amount = await lq.v(INPUT_AMOUNT, INPUT_CURRENCY).int(ASSET_HASH);
        const asset=ASSET_HASH;
        const to=TO_ADDR;
        let tx=await lq.prepareTransaction(amount,asset,to);
        
        console.info(tx);
        tx=await tx.broadcast();
        console.info(tx);

    });


}

async function renderReceive(walletEl,lq){
    let INPUT_AMOUNT=0;
    let ASSET_HASH=await lq.getBaseAsset();
    let ASSET_INFO=await lq.getBaseAssetInfo();
    let INPUT_CURRENCY="USD";
    const invoiceEl = Html.$vlist(walletEl, "#invoice");
    const updateInvoice = async () => {
        if (!ASSET_HASH||!ASSET_INFO) return;
        // const amount = await lq.convertAsFloat(AMOUNT, INFO_CURRENCY, ASSET_HASH);
        let amount = await lq.v(INPUT_AMOUNT, INPUT_CURRENCY).int(ASSET_HASH);
        const { addr, qr } = await lq.receive(amount, ASSET_HASH);
        Html.$img(invoiceEl, ".qr",["invoiceQr"]).setSrc(qr);
        Html.$text(invoiceEl, ".addr").setValue(addr);
        // render(addr, qr);
    }

    const inputsEl=Html.$vlist(walletEl,"#receiveInputs");
    const assetCntEl = Html.$hlist(inputsEl, "#assetCnt", ["left"]);

    Html.$text(assetCntEl,".label").setValue("Asset: ");
    const assetSelectionEl=Html.$inputSelect(assetCntEl,".assetSelect");
    assetSelectionEl.setPreferredValues([ASSET_HASH]);

    lq.getPinnedAssets().then((assets) => {
        for (const asset of assets) {
            asset.info.then(info => {
                assetSelectionEl.addOption(asset.hash, info.ticker,(value)=>{
                    ASSET_HASH=value;
                    ASSET_INFO=info;
                    updateInvoice();                
                });
            });
        }
    });

    //  const assetSelectoEl=Html.$select(assetCntEl,".assetSelect");
    const amountCntEl = Html.$hlist(inputsEl, "#amountCnt", ["left"]);
    Html.$text(amountCntEl,".label").setValue("Request amount: ");
    const amountInputEl=Html.$inputNumber(amountCntEl,".amountInput");
    amountInputEl.setPlaceHolder("0.00");
    amountInputEl.setAction((value)=>{
        INPUT_AMOUNT=value;        
        updateInvoice();
    });

    const currencySelector=Html.$inputSelect(amountCntEl,".currencySelect");
    currencySelector.setPreferredValues([ASSET_HASH,"L-BTC","USD"]);

    lq.getAvailableCurrencies().then((assets)=>{
        for(const asset of assets){
            asset.info.then(info=>{
                currencySelector.addOption(asset.hash, info.ticker,(value)=>{
                    INPUT_CURRENCY=value;
                    updateInvoice();                
                });
            });
        }
    });

    const infoEl=Html.$vlist(inputsEl,"#conversionCnt",["left"]);
    Html.$text(infoEl, ".network").setValue("Network: " + lq.getNetworkName());

    
    updateInvoice();
    
    

}

async function refreshUI(walletEl,lq) {
    STAGES["home"](walletEl,lq);
    

}


async function main() {
   

    // import('./LiquidProvider.js').then(async ({ default: LiquidProvider }) => {
        const lq = new LiquidProvider();
    const walletEl = document.body.querySelector("liquidWallet");
    if (!walletEl) alert("No wallet element found")
    const containerEl = document.createElement("div");
    containerEl.id = "container";
    walletEl.appendChild(containerEl);

        lq.addRefreshCallback(()=>{
        refreshUI(containerEl,lq);
        });   
    await lq.start();
    renderHeader(walletEl, lq);

   

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