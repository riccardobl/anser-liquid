
/**
 * TODO: this should be used to send nice alerts
 */
export default class Alert{
    static error(...args){
        console.log(...args);
        alert(...args);

    }
    static fatal(...args) {
        console.log(...args);
        alert(...args);

    }
}