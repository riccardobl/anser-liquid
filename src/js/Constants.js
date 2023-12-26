export default {
    FEE_GUARD: 2000,
    HARDCODED_FEE: 0.27, // used when the fee api fails
    DEBOUNCE_CALLBACK_TIME:100,
    APP_ID:"lq",
    APP_VERSION:1,
    STORAGE_METHODS: ["IDBStore","LocalStore","MemStore"],
    DISABLE_POINTER_EVENTS:false,
    LOCK_MODE:"landscape",
    EXT_TX_VIEWER:{
        "testnet":"https://liquid.network/testnet/tx/${tx_hash}",
        "liquid":"https://liquid.network/tx/${tx_hash}"
    },
    DUMMY_OUT_ADDRESS:{
        "testnet":"tlq1qqf5wd5h3r2tl6tlpkag34uyg9fdkh2v6gshntur7pdkqpxp8v0mk6ke5awh2vejugcrj6gf564av8xld7nmwc477eq78r2clt",
        "liquid":""
    },
   
}