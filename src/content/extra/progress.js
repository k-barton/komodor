
var korProgressBar = function(title = "R progress bar", label = "",
    min = 0, max = 1,
    initial = 0, width = 300) {

    var range = max - min;
    var _opts = {title: title, label: label, max: 100, initial: initial};

    var w = window.openDialog("chrome://komodor/content/extra/progress.xul",
        "_blank", "chrome,titlebar,centerscreen,width=" + width + ",height=64",
        _opts);
    return {
        get window() w,
        get value() w.progressMeter.value,
        set value(v) {
            v = Math.max(min, Math.min(max, v));
            w.progressMeter.setAttribute("value", Math.round((v - min) / range * 100));
        },
        close() {
            w.close();
        }
    }
};