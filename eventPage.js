try {


  function trackEvent(arg) {
    if (arg.value !== undefined) {
      _gaq.push(['_trackEvent', arg.category, arg.action, arg.label, arg.value]);
    }
    else {
      _gaq.push(['_trackEvent', arg.category, arg.action, arg.label]);
    }
  }


  // Manifest info object
  chrome.manifest = (function () {

    var manifestObject = "";
    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {
      if (xhr.readyState == 4) {
        manifestObject = JSON.parse(xhr.responseText);
      }
    };
    xhr.open("GET", chrome.extension.getURL('/manifest.json'), false);

    try {
      xhr.send();
    } catch (e) {
      console.log('Couldn\'t load manifest.json');
    }

    return manifestObject;
  })();

  function performHTTPGETRequest(url, auth, callback) {
    var http = new window.XMLHttpRequest();
    http.onreadystatechange = function () {
      if (http.readyState == 4) {
        if (http.status == 200) {
          callback({success:true, value:http.responseText});
        }
        else {
          console.log("Failure (" + http.status + "): " + url);
          callback({success:false, value:http.status});
        }
      }
    };
    http.open('GET', url, true);

    if (auth !== null && auth !== "") {
      http.setRequestHeader('Authorization', auth);
    }

    http.send();
  }

  function getURL(pageType, title) {
    return "http://myanimelist.net/api/" + pageType + "/search.xml?q=" + encodeURIComponent(title);
  }

  function searchMAL(pageType, title, callback) {
    var auth = "Basic QW5pbWVSYXRpbmdzOkNocm9tZQ==";
    var url = getURL(pageType, title);
    performHTTPGETRequest(url, auth, function (response) {
      callback(response);
    });
  }

  function setLocalStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    }
    catch (exc) {
      console.log("Setting localStorage failed. Reason: " + exc);
      console.log("Clearing localStorage.");
      localStorage.clear();
    }
  }

  function getMalQueryInfo(callback) {
    var url = "http://stacked-crooked.googlecode.com/svn/trunk/Playground/AnimeRatings/ChromePlugin/config/malQuery.json";
    var key = JSON.stringify({
      name:"MalQueryInfo",
      week:getWeekCounter(),
      version:chrome.manifest.version
    });
    var value = localStorage.getItem(key);
    if (value === null) {
      console.log("Key '" + key + "' not in cache => perform API call.");
      performHTTPGETRequest(url, "", function (response) {
        setLocalStorage(key, JSON.stringify(response));
        callback(response);
      });
    }
    else {
      callback(JSON.parse(value));
    }
  }

  function getInnerText(node) {
    if (node.childNodes.length === 0) {
      return "";
    }
    return node.childNodes[0].nodeValue;
  }

  function getEpochSeconds() {
    return Math.floor(new Date().getTime() / 1000);
  }

  function getFirstUseEpoch() {
    var result = localStorage.getItem("epoch_first_use");
    if (result === null) {
      result = getEpochSeconds();
      setLocalStorage("epoch_first_use", result);
    }
    return result;
  }

  function getWeekCounter() {
    return Math.floor(getEpochSeconds() / (7 * 24 * 3600));
  }

  function getCacheKey(pageType, title) {
    return "version: " + chrome.manifest.version + ", age: " + getWeekCounter() + ", page_type: " + pageType + ", title: " + title;
  }

  function getMalInfo(arg, callback) {

    var cacheValue = localStorage.getItem(getCacheKey(arg.pageType, arg.title));
    if (cacheValue !== null) {
      var result = JSON.parse(cacheValue);
      callback(result);
      return;
    }

    searchMAL(arg.pageType, arg.title, function (response) {

      var result = {
        success:false,
        entries:[]
      };

      if (response.success === false) {
        callback(result);
        return;
      }

      var parser = new DOMParser();
      var xmlText = response.value;
      xmlText = xmlText.replace(/&/g, "%26");
      var doc = parser.parseFromString(xmlText, "text/xml");
      var entries = doc.getElementsByTagName("entry");

      for (var i = 0; i < entries.length; ++i) {
        var node = entries[i];

        // Get english title or original title.
        var titles = node.getElementsByTagName("english");

        // If there is no english title, use the original title.
        if (titles.length === 0 || getInnerText(titles[0]).replace(/ /g, "") === "") {
          titles = node.getElementsByTagName("title");
        }

        var scores = node.getElementsByTagName("score");
        var ids = node.getElementsByTagName("id");
        var start_dates = node.getElementsByTagName("start_date");
        var end_dates = node.getElementsByTagName("end_date");
        var types = node.getElementsByTagName("type");

        if (titles.length === 1 && scores.length === 1 && ids.length === 1 &&
          start_dates.length === 1 && end_dates.length === 1 && types.length === 1) {

          var entry = {
            pageType:arg.pageType,
            title:getInnerText(titles[0]).replace(/%26/g, "&"),
            score:getInnerText(scores[0]),
            id:getInnerText(ids[0]),
            start_date:getInnerText(start_dates[0]),
            end_date:getInnerText(end_dates[0]),
            type:getInnerText(types[0])
          };

          result.entries.push(entry);
        }
        else {
          console.log(arg.title + ": failed to parse xml!");
          console.log(xmlText);
        }
      }

      if (result.entries.length !== 0) {
        result.success = true;
      }
      else {
        result.reason = "Failed to parse XML response.";
        result.success = false;
      }

      setLocalStorage(getCacheKey(arg.pageType, arg.title), JSON.stringify(result));
      callback(result);
    });
  }

  chrome.extension.onMessage.addListener(function (request, sender, callback) {

    if (request.action === "log") {
      console.log(request.arg);
    }
    else if (request.action === "getMalQueryInfo") {
      getMalQueryInfo(callback);
    }
    else if (request.action === "getMalInfo") {
      getMalInfo(request.arg, callback);
    }
    else if (request.action === "trackEvent") {
      console.log("Tracking event: " + JSON.stringify(request.arg));
      trackEvent(request.arg);
    }
    else {
      return false;
    }
    return true;
  });

} catch (exc) {
  console.log(exc);
}