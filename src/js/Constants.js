/**
 * Constants. Should never change at runtime
 */
export default {
    APP_NAME: "Anser Liquid",
    FEE_GUARD: 2000, // everything above this value is rejected (should be manually increased to account for fee changes)
    HARDCODED_FEE: 0.27, // used when the fee api fails
    DEBOUNCE_CALLBACK_TIME: 500, // lower this value to make the app more responsive, but more resource intensive
    APP_ID: "lq", // The app id
    APP_VERSION: 1, // bumping this invalidates all cache and storage
    STORAGE_METHODS: ["LocalStore", "IDBStore", "MemStore"], // order matters, first is preferred
    STORAGE_METHODS_BY_SPEED: ["LocalStore", "IDBStore", "MemStore"], // order matters, first is fastest

    DISABLE_POINTER_EVENTS: false, // set to true to disable pointer for elements that are not interactive.
    // This has the side effect of messing with the dom picker of debug tools, so should be off in development
    LOCK_MODE: undefined, // Set this to lock the app to a certain mode, useful for debugging
    EXT_TX_VIEWER: {
        // external transaction viewers, currently to preserve privacy ransactions are not unblinded when shown in the external viewer
        // In future I might consider implementing the double "view confidential" / "view unconfidential" button like most wallets do
        // or unblind them client side.
        testnet: "https://liquid.network/testnet/tx/${tx_hash}",
        liquid: "https://liquid.network/tx/${tx_hash}",
    },
    DUMMY_OUT_ADDRESS: {
        // This is used only to generate dummy transactions for the UI. Should always reject when sending to these addresses.
        testnet:
            "tlq1qqf5wd5h3r2tl6tlpkag34uyg9fdkh2v6gshntur7pdkqpxp8v0mk6ke5awh2vejugcrj6gf564av8xld7nmwc477eq78r2clt",
        liquid: "lq1qqg9xdv9v8rze8f5ax7e5sfrxvvfuyjk9qwduajuuek653myfweck9s865resnaetqnvc7j5w2rn8lx6dsyntzephy9604mchf",
    },
    DEFAULT_THEME: "spacequack",

    PAYURL_PREFIX: {
        testnet: "liquidtestnet",
        liquid: "liquidnetwork",
    },

    GLOBAL_MESSAGE: undefined,

    BLOCK_TIME: {
        testnet: 60 * 1000, // 1 minute in ms
        liquid: 60 * 1000, // 1 minute in ms
    },
};
