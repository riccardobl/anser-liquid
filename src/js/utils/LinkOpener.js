/**
 * A way to open a link that can be extended later
 */

export default class LinkOpener {
    static navigate(url) {
        window.open(url, "_blank");
    }
}
