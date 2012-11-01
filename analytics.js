var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-25154311-1']);
_gaq.push(['_trackPageview']);


(function () {
  "use strict";
  var ga = document.createElement('script');
  ga.type = 'text/javascript';
  ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0];
  s.parentNode.insertBefore(ga, s);
}());

function trackEvent(arg) {
  "use strict";
  if (arg.value !== undefined) {
    _gaq.push(['_trackEvent', arg.category, arg.action, arg.label, arg.value]);
  } else {
    _gaq.push(['_trackEvent', arg.category, arg.action, arg.label]);
  }
}