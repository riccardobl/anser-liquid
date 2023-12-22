
// import LiquidProvider from "./LiquidProvider.js";

// async function refreshUI(lq){
//     const assetsEl=document.querySelector("assets");

//     const balance=await lq.getBalance();

//     let refreshId=Date.now()+Math.floor(Math.random()*1000);

//     const waitList=[];
    
//     for(const asset of balance){
//         waitList.push(asset.info.then(info=>{
//             const hash = info.hash;
//             // TODO: sanity check
//             let assetEl=assetsEl.querySelector(`#${hash}`);
//             if(!assetEl){
//                 assetEl=document.createElement("asset");
//                 assetEl.id=hash;
//                 assetsEl.appendChild(assetEl);
//             }

//             assetEl.setAttribute("refresh-id",refreshId);

//             let tickerEl=assetEl.querySelector(".ticker");
//             if (!tickerEl){
//                 tickerEl =document.createElement("span");
//                 tickerEl.classList.add("ticker");
//                 assetEl.appendChild(tickerEl);
//             }

//             let nameEl=assetEl.querySelector(".name");
//             if (!nameEl){
//                 nameEl =document.createElement("span");
//                 nameEl.classList.add("name");
//                 assetEl.appendChild(nameEl);
//             }

//             let balanceEl=assetEl.querySelector(".balance");
//             if (!balanceEl){
//                 balanceEl =document.createElement("span");
//                 balanceEl.classList.add("balance");
//                 assetEl.appendChild(balanceEl);
//             }

//             let balanceSecondaryEl=assetEl.querySelector(".balance-secondary");
//             if (!balanceSecondaryEl){
//                 balanceSecondaryEl =document.createElement("span");
//                 balanceSecondaryEl.classList.add("balance-secondary");
//                 assetEl.appendChild(balanceSecondaryEl);
//             }

//             let iconEl=assetEl.querySelector(".icon");
//             if (!iconEl){
//                 iconEl =document.createElement("img");
//                 iconEl.classList.add("icon");
//                 assetEl.appendChild(iconEl);
//             }


//             tickerEl.textContent=info.ticker;
//             nameEl.textContent=info.name;
//             balanceEl.textContent=asset.balance.toFixed(info.precision);

//             const secondaryBalance=0;
//             // use flex layout order to sort element based on secondary balance (higher first)
//             assetEl.style.order=-secondaryBalance;

//             // balanceSecondaryEl.textContent=asset.balanceSecondary.toFixed(8);
//         }));
//     }

//      Promise.all(waitList).then(()=>{
//          // delete all assets that have refresh-id different from the current one
//          const assetsToDelete = assetsEl.querySelectorAll(`asset:not([refresh-id="${refreshId}"])`);
//          for (const asset of assetsToDelete) {
//              assetsEl.removeChild(asset);
//          }
//      })
    
// }


async function main() {
    import('./LiquidProvider.js').then(async ({ default: LiquidProvider }) => {
        const lq = new LiquidProvider();
        await lq.start();
        // lq.addRefreshCallback(()=>{
        // refreshUI(lq);
        // });   
        window.lq = lq;
    });
   
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