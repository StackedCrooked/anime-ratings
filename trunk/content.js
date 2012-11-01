
function AnimeRatings() {
}

var app = new AnimeRatings();
app.highlightTreshold  = 8;
app.visibilityTreshold = 6;
app.annLinks = [];

/**
 * downloadURL performs simple blocking HTTP GET request and returns the result.
 */
function downloadURL(url) {
  var hiddenIFrameID = 'hiddenDownloader';
  var iframe = document.getElementById(hiddenIFrameID);
  if (iframe === null) {
    iframe = document.createElement('iframe');
    iframe.id = hiddenIFrameID;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
  }
  iframe.src = url;
}


app.sendMessage = function(arg, callback) {

    chrome.extension.sendMessage(arg, function(response) {
        callback(response);
    });
};


app.log = function(message) {
    this.sendMessage(
        {action: "log", arg: message},
        function() {}
    );
};


//! @param arg example is { category: 'Configuration', action: 'Changed', label: "Visibility treshold" , value: app.visibilityTreshold }
app.trackEvent = function (args) {
    this.sendMessage({action:"trackEvent", arg:args});
};


app.setLocalStorage = function (key, value) {
    try {
        localStorage.setItem(key, value);
    }
    catch (exc) {
        app.log("Setting localStorage failed. Reason: " + exc);
        app.log("Clearing localStorage.");
        localStorage.clear();
    }
};


app.getMALInfo = function(pageType, title, callback) {
    var linkInfo = {};
    linkInfo.title = title;
    linkInfo.pageType = pageType;
    this.sendMessage(
        {action: "getMalInfo", arg: linkInfo},
        function(linkInfo) {
            callback(linkInfo);
        }
    );
};


app.getMalQueryInfo = function(callback) {
    this.sendMessage({action: "getMalQueryInfo", arg: {}}, callback);
};


app.getMWPages = function() {
    var divs = document.getElementsByTagName("div");
    for (var i = 0; i < divs.length; ++i) {
        if (divs[i].id == "mw-pages") {
            return divs[i];
        }
    }
    throw "MW Pages not found";
};


app.debugLink = "";
app.excludeLink = "";


app.getLinks = function() {
    var result = [];
    try {
        var lis = this.getMWPages().getElementsByTagName("li");
        for (var i = 0; i < lis.length; ++i) {
            var links = lis[i].getElementsByTagName("a");
            if (links.length > 0) {
                var linkNode = links[0];
                if (linkNode.title.search(app.debugLink) !== -1 &&
                    linkNode.title.search(app.excludeLink === -1)) {
                    result.push(linkNode);
                }
            }
        }
    }
    catch (exc) {
        // MW pages not found on this page.
        // This can happen for summary pages like "Category:Anime_of_the_2000s"
    }
    return result;
};


/**
 * Make the text "innerHTML"-compatible.
 */
app.encodeResult = function(text) {

    var result = text;
    var keys = [];
    var values = [];
    keys.push(/&Atilde;&copy;/g); values.push("&eacute;");
    keys.push(/&Atilde;&uml;/g); values.push("&egrave;");
    keys.push(/&Atilde;&ordf;/g); values.push("&ecirc;");
    keys.push(/&Atilde;&laquo;/g); values.push("&euml;");
    keys.push(/&Atilde;&nbsp;/g); values.push("&agrave;");
    keys.push(/&Atilde;&curren;/g); values.push("&auml;");
    keys.push(/&Atilde;&cent;/g); values.push("&acirc;");
    keys.push(/&Atilde;&sup1;/g); values.push("&ugrave;");
    keys.push(/&Atilde;&raquo;/g); values.push("&ucirc;");
    keys.push(/&Atilde;&frac14;/g); values.push("&uuml;");
    keys.push(/&Atilde;&acute;/g); values.push("&ocirc;");
    keys.push(/&Atilde;&para;/g); values.push("&ouml;");
    keys.push(/&Atilde;&reg;/g); values.push("&icirc;");
    keys.push(/&Atilde;&macr;/g); values.push("&iuml;");
    keys.push(/&Atilde;&sect;/g); values.push("&ccedil;");
    keys.push(/&amp;/g); values.push("&amp;");

    keys.push(/&nbsp;/g); values.push(" ");
    keys.push(/&auml;/g); values.push("ä");
    keys.push(/&uuml;/g); values.push("ü");

    for (var i = 0; i < keys.length; ++i) {
        result = result.replace(keys[i], values[i]);
    }
    return result;
};


/**
 * Decodes HTML entities. For example it converts "&lt;" back into "<".
 * @param input
 */
app.htmlDecode = function(input) {
    var e = document.createElement('div');
    e.innerHTML = input;
    return e.childNodes.length === 0 ? "" : e.childNodes[0].nodeValue;
};


app.findAndReplace = function(input, mapping) {
    var result = input;
    for (var key in mapping) {
        if (!mapping.hasOwnProperty(key)) {
            continue;
        }
        var value = mapping[key];
        var count = 0;
        while (result.search(key) !== -1) {
            result = result.replace(key, value);
            if (count++ > 20) {
                this.log("Problematic replacement key: " + key);
                break;
            }
        }
    }
    return result;
};

/**
 * For some reason the unicode in the xml response
 * is wrong. Either I am doing something wrong, or
 * MAL wrongly encodes the response.
 *
 * This code is a workaround that provides fixes
 * for common cases.
 */
app.fixUnicode = function(input) {
    var result = input;

    // First apply a mapping of composed keys
    result = this.findAndReplace(result, {
        "&acirc;��&acirc;��&acirc;��"   : "☆☆☆",
        "&Atilde;�&Atilde;�&Atilde;�"   :"xxx",
        "&acirc;��"                     : "-"
    });

    // Then map remaining individual keys
    result = this.findAndReplace(result, {
        "&Atilde;&copy;"    : "é",
        "&acirc;�&ordf;"    : "♪",
        "&acirc;�"          : "†",
        "&Aring;�"          : "ō"
    });
    return result;
};


app.getYear = function() {
    var categorySplit = document.URL.split("Category:");
    if (categorySplit.length < 2) {
        return "";
    }

    var categoryName = categorySplit[1];
    var yearSplit = categoryName.split("_");
    if (yearSplit.length < 2) {
        return "";
    }

    var yearString = yearSplit[0];
    var year = parseInt(yearString, 10); // could be NaN
    return "" + year;
};


/**
 * @pattern  String  "{Year} {Title} {Score}"
 */
app.addEntryToDOM = function(parent, entry, pattern) {

    parent = parent.create("li");

    parent.setAttribute("score", entry.score);
    app.malLinks.push(parent);

    parent = parent.create("a");
    parent.setAttribute("href", "http://myanimelist.net/" + this.getPageType() + "/" + entry.id);

    var result = pattern;
    result = result.replace("{BeginYear}",  parseInt(entry.start_date.split("-")[0], 10));
    result = result.replace("{EndYear}",  parseInt(entry.end_date.split("-")[0], 10));
    result = result.replace("{Title}", entry.title);
    result = result.replace("{Score}", entry.score !== "0.00" ? entry.score : "no rating");
    parent.createText(this.htmlDecode(this.fixUnicode(this.encodeResult(result))));

    app.updateScore();
};


app.informFailure = function(node, linkItem) {
    var reason = (linkItem.reason === undefined ? "No results returned." : linkItem.reason);
    var parent = node.parentNode;
    var li = parent.createEntryList().create("li");
    li.createText(reason);
    app.failedLis.push(li);
};


app.addEntriesToDOM = function(node, linkItem) {
    var parent = node.parentNode;


    var entries = linkItem.entries;
    app.sortEntriesByDate(entries);

    if (parent.getElementsByTagName("ul").length === 0) {
        parent = parent.createEntryList();
        parent.style.listStyle = "square outside none";
    }

    for (var i = 0; i < entries.length; ++i) {
        try {
            var entry = entries[i];

            // Skip specials
            if (entry.type === "Special" || entry.type == "One Shot") {
                continue;
            }

            // Skip if year doesn't match
            var startYear = parseInt(entry.start_date.split("-")[0], 10);
            var endYear = parseInt(entry.end_date.split("-")[0], 10);
            if (endYear === 0) {
                endYear = this.getYear();
            }
            var year = this.getYear();

            // If the year is not in the required interval
            if (year < startYear || year > endYear) {
                parent.setAttribute("private_year_is_wrong", true);
                continue;
            }

            // Insert title entry
            this.addEntryToDOM(parent,
                               entry,
                               "{Title} ({Score})");
        }
        catch (exc) {
            app.log(exc);
        }
    }

    if (parent.hasAttribute("private_year_is_wrong") &&
        parent.getElementsByTagName("li").length === 0) {
        parent.create("li").createText("No " + app.getPageType() + " titles returned from " + year + ".");
    }
};


/**
 * Workaround: improves search results
 */
app.improveTitle = function(title) {

    var result = title;

    for (var replace_key in app.malQueryInfo.replace) {
            if (!app.malQueryInfo.replace.hasOwnProperty(replace_key)) {
                continue;
            }
        if (result.search(replace_key) !== -1) {
            result = app.malQueryInfo.replace[replace_key];
            break;
        }
    }

    for (var fragment_key in app.malQueryInfo.improve) {
            if (!app.malQueryInfo.improve.hasOwnProperty(fragment_key)) {
                continue;
            }
        var fragment = app.malQueryInfo.improve[fragment_key];
        var count = 0;
        while (result.search(fragment_key) !== -1 && count < 10) {
            result = result.replace(fragment_key, fragment);
            count++;
        }
        if (count >= 10) {
            this.log("Problematic replacement: " + result + ", with key: " + fragment_key);
        }
    }

    // Trim
    result = result.replace(/^\s+|\s+$/g, "");

    return result;
};


Element.prototype.toggle = function() {
	if (this.style.display != 'none' ) {
		this.style.display = 'none';
	}
	else {
		this.style.display = '';
	}
};


Element.prototype.createText = function(text) {
	this.appendChild(document.createTextNode(text));
};


Element.prototype.createNBSP = function() {
	this.appendChild(document.createTextNode("\u00a0"));
};


Element.prototype.create = function(tagNamePath) {
    var result = this;
    var tagNames = tagNamePath.split("/");
    for (var i = 0; i < tagNames.length; ++i) {
        var child = document.createElement(tagNames[i]);
        result.appendChild(child);
        result = child;
    }
    return result;
};


Element.prototype.createEntryList = function() {
    var result = this.create("small/ul");
    result.style.listStyle = "square outside none";
    return result;
};


app.printFailedTitles = function() {
    // Show all failed titles.
    var allFailedTitles = "";
    for (var i = 0; i < app.failedTitles.length; i++)
    {
        if (i > 0)
        {
            allFailedTitles += "\n";
        }
        allFailedTitles += i + ": " + app.failedTitles[i];
    }
    app.log(allFailedTitles);
};


app.getNext = function() {
    if (app.links.length === 0) {
        app.updateScore();
        //app.printFailedTitles();
        return;
    }

    var linkNode = app.links.pop();

    var title = app.improveTitle(linkNode.title);
    if (app.linkNodes[title] === undefined) {
        app.linkNodes[title] = linkNode;
        this.getMALInfo(this.getPageType(), title, function(linkInfo) {
            var node = app.linkNodes[title];
            if (linkInfo.success === true) {
                app.addEntriesToDOM(node, linkInfo);
            }
            else {
                app.failedTitles.push(title);
                app.informFailure(node, linkInfo);
            }
            app.getNext();
        });
    }
    else {
        app.log("Title already being processed: " + title);
    }
};


app.isYearList = function() {
    return app.getPageType() === "anime" ||
           app.getPageType() === "manga";
};


app.getAnimeTitleFromPage = function() {
    var titles = document.getElementsByTagName("title");
    if (titles.length === 0) {
        throw "No title tag found in page. Can't deduce page title.";
    }

    if (typeof(titles[0].nodeValue) === "string") {
        return titles[0].nodeValue.split(" -")[0];
    }

    if (typeof(titles[0].innerHTML) === "string") {
        return titles[0].innerHTML.split(" -")[0];
    }

    throw "Failed to get Wikipedia page title";
};


/**
 * Get the link to www.animenewsnetwork.com.
 * Returns null if not found.
 */
app.getANNLinks = function() {
    var result = [];
    var links = document.getElementsByTagName("a");
    for (var i = 0; i < links.length; ++i) {
        var link = links[i];
        var href = link.href;
        if (href.search("http://www.animenewsnetwork.com/encyclopedia/manga") !== -1 ||
            href.search("http://www.animenewsnetwork.com/encyclopedia/anime") !== -1) {
            result.push(href);
        }
    }
    return result;
};


app.getPageTypeFromInfoBox = function() {
    var foundAnime = false;
    var foundManga = false;
    var tables = document.getElementsByTagName("table");
    for (var i = 0; i < tables.length; ++i) {
        var table = tables[i];
        if (table.getAttribute("class") === "infobox") {
            var tds = table.getElementsByTagName("td");
            for (var j = 0; j < tds.length; ++j) {
                var td = tds[j];
                if (td.childNodes.length === 0) {
                    continue;
                }

                if (td.childNodes[0].nodeValue === null) {
                    continue;
                }

                var value = td.childNodes[0].nodeValue;

                if (value.search(/TV anime/) !== -1 ||
                    value.search(/Original video animation/) !== -1) {
                    foundAnime = true;
                }

                if (value.search(/Manga/) !== -1) {
                    foundManga = true;
                }
            }
        }
    }

    if (foundAnime && foundManga) {
        return "anime|manga";
    }

    if (foundAnime) {
        return "anime";
    }

    if (foundManga) {
        return "manga";
    }

    return "";
};


app.getPageTypeFromANNLinks = function() {
    app.annLinks = app.getANNLinks();

    var foundAnime = false;
    var foundManga = false;

    for (var i = 0; i < annLinks.length; ++i) {
        var annLink = annLinks[i];
        if (annLink.search(/anime\.php/) !== -1) {
            foundAnime = true;
        }

        if (annLink.search(/manga\.php/) !== -1) {
            foundManga = true;
        }

        if (foundAnime === true && foundManga === true) {
            break;
        }
    }

    if (foundAnime && foundManga) {
        return "anime|manga";
    }

    if (foundAnime) {
        return "anime";
    }

    if (foundManga) {
        return "manga";
    }

    return "";
};


app.getPageType = function() {
    if (document.URL.toLowerCase().search(/category:.*anime/) !== -1) {
        return "anime";
    }
    else if (document.URL.toLowerCase().search(/category:.*manga/) !== -1) {
        return "manga";
    }
    else {
        return "";
    }
};

app.workerCount = 5;
app.idleWorkers = 0;

app.insertRatingsIntoList = function() {
    for (var i = 0; i < app.workerCount; ++i) {
        app.getNext(app.links);
    }
};


app.addMALRatingsIntoAnimePageDOM = function() {
    var title = app.improveTitle(app.getAnimeTitleFromPage());
    this.getMALInfo("anime", title, function(linkInfo) {
        app.linkInfo = linkInfo;
        app.getMALInfo("manga", title, function(linkInfo) {
            app.linkInfo.success = app.linkInfo || linkInfo.success;
            if (!app.linkInfo.success) {
                app.log("Failed to get neither anime nor manga info for: " + title);
                return;
            }
            for (var i = 0; i < linkInfo.entries.length; ++i) {
                app.linkInfo.entries.push(linkInfo.entries[i]);
            }
            app.addRatingIntoAnimePageDOM(app.linkInfo);
        });
    });
};


app.insertRatingsIntoPage = function() {
    app.addMALRatingsIntoAnimePageDOM();
};


app.getFirstChildByTagName = function(node, tagName) {
    for (var i = 0; i < node.childNodes.length; ++i) {
        var childNode = node.childNodes[i];
        if (childNode.tagName === tagName) {
            return childNode;
        }
    }
    return null;
};


app.sortEntriesByDate = function(entries) {
    entries.sort(function(lhs, rhs) {
        if (lhs.start_date < rhs.start_date) {
            return -1;
        }
        else if (lhs.start_date == rhs.start_date) {
            return 0;
        }
        return 1;
    });
};


app.getNextSibling = function(node) {
    var result = node.nextSibling;
    while (result.nodeType !== 1) {
        result = result.nextSibling;
    }
    return result;
};


app.getInfoBox = function(bodyContent) {
    if (bodyContent === null) {
        throw "bodyContent not found";
    }

    var tables = bodyContent.getElementsByTagName("table");
    for (var i = 0; i < tables.length; ++i) {
        var table = tables[i];

        if (table.getAttribute("class") === "infobox") {
            return table;
        }
    }
    return null;
};


app.getFirstParagraph = function() {
    var bodyContent = document.getElementById("bodyContent");

    // Get first paragraph *after* the infobox.
    var infoBox = app.getInfoBox(bodyContent);
    if (infoBox !== null) {
        return app.getNextSibling(infoBox);
    }

    // If there is no infobox, the simply return the first paragraph.
    var paragraphs = bodyContent.getElementsByTagName("p");
    if (paragraphs.length === 0) {
        throw "No paragraphs found in bodyContent";
    }
    return paragraphs[0];
};


app.addRatingIntoAnimePageDOM = function(linkInfo) {

    // Don't show the the info box if on entries were found.
    if (linkInfo.entries.length === 0) {
        app.log("No entries for " + JSON.stringify(linkInfo));
        return;
    }

    app.sortEntriesByDate(linkInfo.entries);

    var firstParagraph = app.getFirstParagraph();

    var node = firstParagraph.parentNode.insertBefore(document.createElement("div"), firstParagraph);
    node = node.create("table");
    node.setAttribute("style", "margin: 0.5em 0 0.5em 1em; padding: 0.2em;");
    node.setAttribute("class", "toc");

    var td = node.create("tr/td");
    td.setAttribute("style", "text-align: center;");
    var table_title = td.create("a");
    table_title.href = "http://chrome.google.com/webstore/detail/aneeljmnclggefejjbbbbploekjpfejc";
    table_title.create("strong").createText("Anime Ratings");

    td.createNBSP();
    td.createNBSP();
    td = td.create("span");
    td.setAttribute("class", "toctoggle");
    td.createText("[");
    app.hideButton = td.create("a");
    app.hideButton.href = '#';
    td.createText("]");
    app.hideButton.innerText = "hide";
    app.hideButton.onclick = function() {
        app.malInfoBox.toggle();
        app.hideButton.innerText = app.malInfoBox.style.display === "none" ? "show" : "hide";
    };

    var table = node.create("table");
    app.malInfoBox = table;

    tr = table.create("tr");

    tr.setAttribute("style", "text-align: center;");
    td = tr.create("td").create("b");
    td.createText("Year");

    td = tr.create("td").create("b");
    td.createText("Title");

    td = tr.create("td").create("b");
    td.createText("Type");

    td = tr.create("td");
    td.create("b").createText("Rating");

    for (var i = 0; i < linkInfo.entries.length; ++i) {

        var entry = linkInfo.entries[i];

        // Skip specials
        if (entry.type === "Special" || entry.type == "One Shot") {
            continue;
        }

        // Year
        var startYear = parseInt(entry.start_date.split("-")[0], 10);

        var endYear = parseInt(entry.end_date.split("-")[0], 10);
        if (endYear === 0) {
            endYear = "ongoing";
        }

        tr = table.create("tr");
        var td_year = tr.create("td");
        td_year.setAttribute("style", "text-align: center;");
        var year = startYear;

        if (startYear === 0) {
            year = "Unknown";
        }
        else if (startYear !== endYear) {
            year += " - " + endYear;
        }
        td_year.createText(year);

        // Title
        var td_title = tr.create("td/i/a");
        td_title.setAttribute("style", "text-align: left;");
        td_title.setAttribute("href", "http://myanimelist.net/" + entry.pageType + "/" + entry.id);
        td_title.createText(this.htmlDecode(this.fixUnicode(this.encodeResult(entry.title))));

        // Type
        var td_type = tr.create("td");
        td_type.setAttribute("style", "text-align: center;");
        td_type.createText(entry.type);

        // Score
        var td_score = tr.create("td");
        td_score.setAttribute("style", "text-align: center;");
        if (parseFloat(entry.score, 10) >= 8) {
            td_score = td_score.create("strong");
        }
        td_score.createText(entry.score !== "0.00" ? entry.score : "(none)");

    }
};


app.insertSettingsBox = function() {
    var table = document.createElement("table");
    table.className = "toc";
    table.setAttribute("style", "float:none;");

    var mwPages = app.getMWPages();
    mwPages.insertBefore(table, mwPages.firstChild.nextSibling.nextSibling.nextSibling.nextSibling);

    table = table.create("tbody");

    var tr = table.create("tr");

    var td_head = tr.create("td");
    td_head.setAttribute("style", "text-align: center;");

    var title_link = td_head.create("a");
    title_link.create("strong").createText("Anime Ratings");
    title_link.href = "http://chrome.google.com/webstore/detail/aneeljmnclggefejjbbbbploekjpfejc";

    td_head.createNBSP();
    td_head.createNBSP();
    td_head = td_head.create("span");
    td_head.setAttribute("class", "toctoggle");
    td_head.createText("[");
    app.hideButton = td_head.create("a");
    app.hideButton.href = '#';
    td_head.createText("]");
    app.hideButton.innerText = "hide";
    app.hideButton.onclick = function() {
        app.malInfoBox.toggle();
        app.hideButton.innerText = app.malInfoBox.style.display === "none" ? "show" : "hide";
    };

    table = table.create("table");
    app.malInfoBox = table;

    tr = table.create("tr");
    var td = tr.create("td");
    td.setAttribute("style", "vertical-align:middle;");
    td.createText("Visibility treshold: ");

    var spinButtonWidth = "40px";

    td = tr.create("td");
    app.visibilitySpinButton = td.create("input");
    app.visibilitySpinButton.name = "VisibilityTreshold";
    app.visibilitySpinButton.type = "number";
    app.visibilitySpinButton.min = "0";
    app.visibilitySpinButton.max = "10";
    app.visibilitySpinButton.step = "0.1";
    app.visibilitySpinButton.setAttribute("style", "width:" + spinButtonWidth + ";");

    var visibilityTreshold = localStorage["visibilityTreshold"];
    app.setVisibilityTreshold((visibilityTreshold !== undefined) ? visibilityTreshold : app.visibilityTreshold);

    tr = table.create("tr");
    td = tr.create("td");
    td.setAttribute("style", "vertical-align:middle;");
    td.createText("Highlight treshold: ");

    td = tr.create("td");
    app.highlightSpinButton = td.create("input");
    app.highlightSpinButton.name = "HighlightTreshold";
    app.highlightSpinButton.type = "number";
    app.highlightSpinButton.min = "0";
    app.highlightSpinButton.max = "10";
    app.highlightSpinButton.step = "0.1";
    app.highlightSpinButton.setAttribute("style", "width:" + spinButtonWidth + ";");

    var highlightTreshold = localStorage["highlightTreshold"];
    app.setHighlightTreshold((highlightTreshold !== undefined) ? highlightTreshold : app.highlightTreshold);

};


app.string2float = function(value, defaultValue) {
    var result = parseFloat(value, 10);
    if (isNaN(result)) {
        result = defaultValue;
    }
    return result;
};


app.getVisibilityTreshold = function() {
    var result = app.string2float(app.visibilitySpinButton.value, app.visibilityTreshold);
    if (result < 0 || result > 10) {
        result = app.visibilityTreshold;
        app.visibilitySpinButton.value = result;
    }
    return result;
};


app.getHighlightTreshold = function() {
    var result = app.string2float(app.highlightSpinButton.value, app.highlightTreshold);
    if (result < 0 || result > 10) {
        result = app.highlightTreshold;
        app.highlightSpinButton.value = result;
    }
    return result;
};


app.setVisibilityTreshold = function(visibilityTreshold) {
    app.visibilitySpinButton.value = visibilityTreshold;
};


app.setHighlightTreshold = function(highlightTreshold) {
    app.highlightSpinButton.value = highlightTreshold;
};


app.isVisibilityTresholdChanged = function() {
    if (app.visibilityTreshold !== app.getVisibilityTreshold()) {
        app.visibilityTreshold = app.getVisibilityTreshold();
        app.setLocalStorage("visibilityTreshold", app.visibilityTreshold);
        app.trackEvent({ category: 'Configuration', action: 'Changed', label: "Visibility treshold", value: app.visibilityTreshold });
        return true;
    }

    return false;
};


app.isHighlightTresholdChanged = function() {
    if (app.highlightTreshold !== app.getHighlightTreshold()) {
        app.highlightTreshold = app.getHighlightTreshold();
        app.setLocalStorage("highlightTreshold", app.highlightTreshold);
        app.trackEvent({ category: 'Configuration', action: 'Changed', label: "Highlight treshold", value: app.highlightTreshold });
        return true;
    }

    return false;
};


app.getMALLinkScore = function(malLink) {
  return parseFloat(malLink.getAttribute("score"), 10);
};


app.updateScoreLoopIsRunning = false;
app.forceUpdateScore = false;


app.updateScore = function() {
    app.forceUpdateScore = true;

    if (app.updateScoreLoopIsRunning === false) {
        app.updateScoreLoopIsRunning = true;
        app.updateScoreImpl();
    }
};


app.updateScoreImpl = function() {
    if (app.forceUpdateScore === true ||
        app.isHighlightTresholdChanged() ||
        app.isVisibilityTresholdChanged())
    {
        app.forceUpdateScore = false;

        // Toggle visibility of entries depending on the visibility and highlight tresholds.
        for (var linkIndex = 0; linkIndex < app.malLinks.length; ++linkIndex) {
            var malLink = app.malLinks[linkIndex];
            var linkScore = app.getMALLinkScore(malLink);

            if (linkScore >= app.getHighlightTreshold()) {
                malLink.firstChild.style.fontWeight = "bold";
                malLink.firstChild.style.backgroundColor = "yellow";
            }
            else {
                malLink.firstChild.style.fontWeight = "normal";
                malLink.firstChild.style.backgroundColor = "inherit";
            }

            // Score of zero means that the show has not yet received
            // enough ratings to calculate a weighted average.
            if (linkScore === 0 || linkScore >= app.getVisibilityTreshold()) {
                malLink.style.display = "list-item";
            }
            else {
                malLink.style.display = "none";
            }
        }
    }
    window.setTimeout(app.updateScoreImpl, 500);
};


//
// Application Entry Point
//
try {

app.malLinks = [];
app.failedLis = []; // 'li' elements that are used for error messages
app.failedTitles = [];
app.linkNodes = {};
app.links = app.getLinks().reverse();


if (app.malQueryInfo === undefined) {

    app.defaultMalQueryInfo = {
        "replace" : {
            "11eyes: Tsumi to Batsu to Aganai no Shōjo" : "11eyes",
            "A Channel" : "A-Channel",
            "Aki Sora" : "Aki-Sora",
            "Ano Hi Mita Hana" : "Ano Hi Mita Hana",
            "Cardfight Vanguard" : "Cardfight!! Vanguard",
            "Chibi Devi!" : "Chibi Devi",
            "Doraemon" : "Doraemon",
            "Dungeon Fighter Online" : "Arad Senki: Slap Up Party",
            "Everyday Mum" : "Mainichi Kaasan",
            "Fresh Pretty Cure" : "Fresh Precure!",
            "GA Geijutsuka Art Design Class" : "GA: Geijutsuka Art Design Class",
            "Hayate the Combat Butler!" : "Hayate",
            "Heaven's Lost Property" : "Heaven's Lost Property",
            "Hetalia: Axis Powers" : "Hetalia Axis Powers",
            "Higurashi When They Cry" : "Higurashi no Naku Koro ni",
            "Horizon in the Middle of Nowhere" :  "Kyoukai Senjou no Horizon",
            "Hyakka Ryōran Samurai Girls" : "Hyakka Ryouran: Samurai Girls",
            "Infinite Stratos" : "Infinite Stratos",
            "Koishinasai" : "Koi Shinasai",
            "Kon'nichiwa Anne" : "Konnichiwa Anne",
            "Kyō, Koi o Hajimemasu" : "Kyou, Koi wo Hajimemasu",
            "List of Kemono no Souja Erin episodes" : "Kemono no Souja Eri",
            "Lupin the 3rd vs Detective Conan" : "Lupin III vs. Detective Conan",
            "Mai Mai Miracle": "Mai Mai Shinko to Sennen no Mahou",
            "Maid Sama!" : "Kaichou wa Maid-sama!",
            "Mawaru-Penguindrum" : "Mawaru Penguindrum",
            "Mazinkaizer" : "Mazinkaiser",
            "Naruto Shippuden The Movie: The Lost Tower" : "Naruto: Shippuuden Movie 4 - The Lost Tower",
            "Naruto Shippuuden The Movie: Inheritors of the Will of Fire" : "Naruto: Shippuuden Movie 3",
            "Negima! Magister Negi Magi" : "Negima",
            "Oh My Goddess" : "My Goddess",
            "One Piece Film: Strong World" : "One Piece: Strong World",
            "Ore no Imōto ga Konna ni Kawaii Wake ga Nai" : "Ore no Imouto ga Konnani Kawaii Wake ga Nai",
            "Pandane to tamago hime" : "Pandane to Tamago-hime",
            "Phantom of Inferno" : "Phantom: Requiem for the Phantom",
            "Phi Brain: Puzzle of God" : "Phi Brain: Kami no Puzzle",
            "Poppy Hill" : "Kokurikozaka Kara",
            "Pretty Cure All Stars DX2: Light of Hope – Protect the Rainbow Jewel!" : "Eiga Precure All Stars DX2: Kibou no Hikari - Rainbow Jewel wo Mamore!",
            "Psychiatrist Irabu series" : "Kuuchuu Buranko",
            "Queen's Blade Rebellion" : "Queen's Blade: Rebellion",
            "Samurai Harem: Asu no Yoichi" : "Asu no Yoichi!",
            "Sayonara, Zetsubou-Sensei": "Sayonara Zetsubou Sensei",
            "Sengoku Basara: Samurai Kings" : "Sengoku Basara",
            "Sengoku Paradise" : "Kiwami",
            "Shin Mazinger Shougeki! Z Hen" : "Shin Mazinger Shougeki! Z-Hen",
            "Shin Megami Tensei: Persona 4" : "Shin Megami",
            "Sono Hanabira ni Kuchizuke o" : "Sono Hanabira ni Kuchizuke wo",
            "Space Battleship Yamato: Resurrection" : "Miyamoto Musashi: Souken ni Haseru Yume",
            "Super Robot Wars Original Generation: The Inspector" : "Super Robot Taisen OG: The Inspector",
            "The Guin Saga" : "Guin Saga",
            "The Tower of Druaga" : "Druaga no Tou",
            "To Aru Kagaku no Railgun" : "Toaru Kagaku no Railgun",
            "Victini and Reshiram and White" : "Pokemon Best Wishes! the Movie: Victini to Shiroki Eiyuu Reshiram",
            "Yondemasuyo" : "Yondemasu yo",
            "Ōkami Kakushi" : "Ookami Kakushi",
            "Ōkami-san" : "Ookami-san"
        },
        "improve" : {
            "×" : "x",
            "ō" : "ou",
            "Ō" : "Ou",
            "ū" : "uu",
            "ä" : "a",
            "Ä" : "A",
            "½" : "1/2",
            "&amp;" : "&",
            "(2009 film)" : "",
            "(anime)" : "",
            "(film)" : "",
            "(manga)" : "",
            "(movie)" : "",
            "(visual novel)" : "",
            "(novel)" : "",
            "(video game)" : "",
            "(novel series)" : "",
            "(Japanese series)" : "",
            "(TV series)" : ""
        }
    };

    app.getMalQueryInfo(function(response) {
        if (response.success === true) {
            app.malQueryInfo = JSON.parse(response.value);
            if (undefined === app.malQueryInfo.replace || app.malQueryInfo.improve === undefined) {
                throw "MAL query info is missing the 'replace' or 'improve' fields.";
            }
        }
        else {
            app.log("Failed to get malQueryInfo. Resorting to default.");
            app.malQueryInfo = app.defaultMalQueryInfo;
        }
        app.run();
    });
}

app.run = function() {
    if (app.isYearList()) {
        app.trackEvent({ category: 'YearList', action: 'Loaded', label: document.URL });
        app.insertSettingsBox();
        app.insertRatingsIntoList();
        app.updateScore();
    }
    else {
        app.pageType = app.getPageTypeFromInfoBox();

        if (app.pageType === "") {
            app.pageType = app.getPageTypeFromANNLinks();
        }

        if (app.pageType.search(/anime/) !== -1 || app.pageType.search(/manga/) !== -1) {
            app.trackEvent({ category: 'AnimePage', action: 'Loaded', label: document.URL });
            app.insertRatingsIntoPage();
        }
    }
};


} catch (exc) {
    app.log("Exception caught: " + exc.toString());
}
