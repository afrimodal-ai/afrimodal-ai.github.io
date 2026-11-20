/* The page: the controls, the rows and the URL.

   What matches a selection is in site/recipe.js, which has no page in it and
   is tested on its own. This file only turns clicks into a selection and a
   selection into elements.

   Everything the visitor chose lives in the URL, so the page can be shared
   and comes back the same (builder handoff Section 3). */

(function () {
  "use strict";

  var R = window.AfroRecipe;
  var index = window.LANGUAGE_INDEX || [];
  var byCode = {};
  index.forEach(function (row) { byCode[row.code] = row; });

  // What the visitor chose.
  var state = R.emptyState();
  var data = {};        // language code -> its data file
  var loading = {};     // language code -> true while its file is in flight

  var el = {};
  ["langs", "lang-q", "lang-results", "purpose", "get-hours", "get-pending", "get-roles", "get-line", "rows",
    "left-out", "unchecked", "no-country", "country", "country-box", "get-size", "credit-box",
    "copy-credit"].forEach(function (id) {
      el[id] = document.getElementById(id);
    });

  function plural(n, word) { return n + " " + word + (n === 1 ? "" : "s"); }

  function text(node, value) { node.textContent = value; }

  function siteUrl(name) { return (window.SITE_BASE || "") + name; }

  // --- the selection, in the URL ------------------------------------------

  // Where an old bookmark pointed. The page it named is not being built, so
  // the fragment is dropped rather than left in the address bar.
  var OLD_TABS = ["overview", "datasets", "languages", "tokens", "runs",
    "contamination", "jobs"];

  function readUrl() {
    state = R.fromQuery(window.location.search, byCode);
  }

  function writeUrl() {
    window.history.replaceState(null, "",
      window.location.pathname + "?" + R.toQuery(state));
  }

  // --- drawing -------------------------------------------------------------

  function drawLangs() {
    el.langs.innerHTML = "";
    state.langs.forEach(function (code) {
      var info = byCode[code] || { name: code };
      var chip = document.createElement("span");
      chip.className = "b-lang";
      // The name alone: the code is in the URL and the script for anyone
      // who needs it.
      var label = document.createElement("span");
      text(label, info.name);
      var drop = document.createElement("button");
      drop.type = "button";
      drop.setAttribute("aria-label", "Remove " + info.name);
      text(drop, "×");
      drop.addEventListener("click", function () {
        state.langs = state.langs.filter(function (c) { return c !== code; });
        refresh();
      });
      chip.appendChild(label);
      chip.appendChild(drop);
      el.langs.appendChild(chip);
    });
  }

  function drawRows(view) {
    el.rows.innerHTML = "";
    view.rows.forEach(function (entry) {
      var row = entry.row;
      var item = document.createElement("li");
      var line = document.createElement("div");
      line.className = "b-row" + (entry.unsplit ? " b-row-off" : "");

      var middle = document.createElement("span");
      middle.className = "b-row-name";
      var name = document.createElement("span");
      name.className = "b-row-title";
      text(name, entry.name);
      var meta = document.createElement("span");
      meta.className = "b-row-meta";
      var bits = [row.licence || "terms not recorded", row.host, row.access];
      if (!row.source) bits.push(row.loader_note || "the loader cannot fetch this source yet");
      text(meta, bits.join(" \u00b7 "));
      var voices = document.createElement("span");
      voices.className = "b-row-meta";
      text(voices, R.speakersLine(row));
      middle.appendChild(name);
      middle.appendChild(meta);
      middle.appendChild(voices);
      if (row.test_note) {
        var caution = document.createElement("span");
        caution.className = "b-row-meta";
        text(caution, row.test_note);
        middle.appendChild(caution);
      }

      var right = document.createElement("span");
      right.className = "b-splits";
      if (entry.unsplit) {
        var whole = document.createElement("span");
        whole.className = "b-split-whole";
        text(whole, R.fmt(entry.hours) + " h published, split not measured");
        right.appendChild(whole);
      } else {
        var reads = R.PURPOSES[state.purpose].role;
        entry.splits.forEach(function (split) {
          var cell = document.createElement("span");
          cell.className = "b-split" + (split.role === reads ? " b-split-read" : "");
          var word = document.createElement("span");
          word.className = "b-split-role";
          text(word, split.label);
          var value = document.createElement("span");
          value.className = "b-split-hours";
          // No figure is not a zero.
          text(value, split.hours ? R.fmt(split.hours) + " h" : "\u2013");
          cell.appendChild(word);
          cell.appendChild(value);
          right.appendChild(cell);
        });
      }

      line.appendChild(middle);
      line.appendChild(right);
      item.appendChild(line);
      item.appendChild(moreAbout(entry));
      el.rows.appendChild(item);
    });
  }

  /* One line of "name (reason)", each reason linking to the page the answer
     was read from where there is one, so a refusal can be checked rather
     than taken on trust. */
  function drawRefusals(node, heading, items) {
    node.hidden = !items.length;
    if (!items.length) return;
    node.innerHTML = "";
    var head = document.createElement("span");
    head.className = "b-left-out-head";
    text(head, heading);
    node.appendChild(head);
    items.forEach(function (item, index) {
      node.appendChild(document.createTextNode((index ? ", " : " ") + item.name + " ("));
      if (item.evidence) {
        var link = document.createElement("a");
        link.href = item.evidence;
        link.target = "_blank";
        link.rel = "noopener";
        text(link, item.reason);
        node.appendChild(link);
      } else {
        node.appendChild(document.createTextNode(item.reason));
      }
      node.appendChild(document.createTextNode(")"));
    });
  }

  /* Everything else about a dataset, closed until someone asks for it: its
     size, its terms, and how its publishers ask to be cited. */
  function moreAbout(entry) {
    var row = entry.row;
    var box = document.createElement("details");
    box.className = "b-row-more";
    var head = document.createElement("summary");
    text(head, "Terms and citation");
    box.appendChild(head);

    function line(label, value, href) {
      if (!value) return;
      var p = document.createElement("p");
      p.appendChild(document.createTextNode(label + ": "));
      if (href) {
        var link = document.createElement("a");
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener";
        text(link, value);
        p.appendChild(link);
      } else {
        p.appendChild(document.createTextNode(value));
      }
      box.appendChild(p);
    }

    line("Terms", row.licence || "not recorded", row.licence_url);
    line("Published by", row.institution);
    line("Access", row.access);
    if (entry.cost) {
      line("Published size", R.size(entry.cost.bytes) + " for the "
        + R.PURPOSES[state.purpose].role + " split"
        + (entry.cost.covers === "this language" ? ""
          : ", which this language shares with the others in the same part"));
    }
    line("Data", row.link, row.link);
    if (row.citation) {
      var cite = document.createElement("p");
      cite.className = "b-cite";
      text(cite, row.citation);
      box.appendChild(cite);
    }
    return box;
  }

  /* What the size covers, where it is not simply this selection. */
  function sizeNote(view) {
    var bits = [];
    if (view.bytesApproximate) {
      bits.push("Some figures are for a part of a repository that holds other "
        + "languages too.");
    }
    if (view.bytesPartial) bits.push("Some sources have no size recorded here.");
    return bits.join(" ");
  }

  function perLanguageLine(view) {
    if (state.langs.length < 2) return "";
    var got = {};
    view.counted.forEach(function (entry) {
      got[entry.code] = (got[entry.code] || 0) + entry.hours;
    });
    return state.langs.filter(function (code) { return got[code]; }).map(function (code) {
      return (data[code] ? data[code].name : code) + " " + R.fmt(got[code]) + " h";
    }).join(" \u00b7 ");
  }

  /* A publisher's two-letter country code that the catalogue's own table
     does not name, shown by the browser's name for it. Display only: the
     value stays as the publisher wrote it. */
  function countryName(value) {
    if (!/^[A-Z]{2}$/.test(value)) return value;
    try {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(value) || value;
    } catch (error) {
      return value;
    }
  }

  /* The country chooser: only the countries the chosen languages record,
     and only while there is one. A country that none of them records any
     more is dropped once their files have arrived. */
  function drawCountries(loaded) {
    var options = R.countries(state, data);
    // An old en-NG link arrives as the code NG; the files name it Nigeria.
    if (options.indexOf(state.country) < 0 && options.indexOf(countryName(state.country)) >= 0) {
      state.country = countryName(state.country);
    }
    if (loaded && state.country && options.indexOf(state.country) < 0) state.country = "";
    el["country-box"].hidden = !options.length && !state.country;
    var select = el.country;
    select.innerHTML = "";
    var any = document.createElement("option");
    any.value = "";
    text(any, "Any country");
    select.appendChild(any);
    options.forEach(function (name) {
      var option = document.createElement("option");
      option.value = name;
      text(option, countryName(name));
      select.appendChild(option);
    });
    select.value = state.country || "";
  }

  function refresh() {
    drawLangs();
    var pending = state.langs.some(function (code) { return !data[code]; });
    state.langs.forEach(fetchLanguage);
    drawCountries(!pending);

    var view = R.matching(state, data);

    if (!state.langs.length) {
      text(el["get-hours"], "0 h");
      text(el["get-line"], "Pick a language to start.");
      el.rows.innerHTML = "";
      el["left-out"].hidden = true;
      el.unchecked.hidden = true;
      el["no-country"].hidden = true;
      el["get-size"].hidden = true;
      el["get-pending"].hidden = true;
      el["get-roles"].hidden = true;
      el["credit-box"].hidden = true;
      writeUrl();
      return;
    }

    // Hours nobody has placed in a split are not a zero and not part of the
    // total, but they do answer the question, so they sit beside it.
    var further = view.unmeasured.length > 0;
    el["get-pending"].hidden = !further;
    if (further) text(el["get-pending"], "+ " + R.fmt(view.pending) + " h, split not measured");
    if (view.counted.length) {
      text(el["get-hours"], R.fmt(view.total) + " h");
      var line = "of " + R.PURPOSES[state.purpose].noun + " audio, from "
        + plural(view.counted.length, "dataset") + " on " + plural(view.hosts, "host") + ".";
      if (further) {
        line += " The other " + R.fmt(view.pending) + " h, from "
          + plural(view.unmeasured.length, "dataset")
          + ", stays apart until its splits are measured.";
      }
      var per = perLanguageLine(view);
      text(el["get-line"], per ? line + " " + per : line);
      el["get-roles"].hidden = false;
      text(el["get-roles"], "Across these datasets: train " + R.fmt(view.roles.train)
        + " h \u00b7 dev " + R.fmt(view.roles.dev)
        + " h \u00b7 test " + R.fmt(view.roles.test) + " h"
        + (view.roles.untranscribed ? " \u00b7 untranscribed train "
          + R.fmt(view.roles.untranscribed) + " h" : ""));
    } else {
      el["get-roles"].hidden = true;
      text(el["get-hours"], further ? "None measured" : "0 h");
      text(el["get-line"], pending ? "Reading the figures..."
        : further ? "" : "Nothing is allowed for this selection.");
    }

    var bytes = R.size(view.bytes);
    el["get-size"].hidden = !bytes;
    if (bytes) {
      text(el["get-size"], "\u00b7 "
        + (view.bytesApproximate || view.bytesPartial ? "about " : "")
        + bytes + " published size");
      el["get-size"].title = sizeNote(view);
    }

    drawRows(view);
    drawRefusals(el["left-out"], "Left out:", view.leftOut);
    drawRefusals(el.unchecked, "Not counted, because nobody has read the terms yet:",
      view.unchecked);
    // Datasets that say nothing about where their speakers are from are not
    // counted for a country, and are named so the visitor knows they exist.
    el["no-country"].hidden = !(state.country && view.noCountry.length);
    if (state.country && view.noCountry.length) {
      text(el["no-country"], "Not counted for " + countryName(state.country)
        + ", because they record no country: " + view.noCountry.join(", ") + ".");
    }
    el["credit-box"].hidden = !view.rows.length;
    text(el["copy-credit"], "Copy attribution");
    writeUrl();
  }

  // --- the language files --------------------------------------------------

  function fetchLanguage(code) {
    if (data[code] || loading[code]) return;
    loading[code] = true;
    fetch(siteUrl("data/lang/" + code + ".json")).then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    }).then(function (payload) {
      data[code] = payload;
      loading[code] = false;
      refresh();
    }).catch(function () {
      loading[code] = false;
      data[code] = { code: code, name: (byCode[code] || {}).name || code, datasets: [] };
      refresh();
    });
  }

  // --- the language box -------------------------------------------

  function search(query) {
    var needle = R.fold(query.trim());
    if (!needle) return [];
    var hits = [];
    index.forEach(function (row) {
      if (state.langs.indexOf(row.code) >= 0) return;
      var rank = -1;
      row.terms.forEach(function (term) {
        if (term === needle) rank = Math.max(rank, 3);
        else if (term.indexOf(needle) === 0) rank = Math.max(rank, 2);
        else if (term.indexOf(needle) > 0) rank = Math.max(rank, 1);
      });
      if (rank > 0) hits.push({ row: row, rank: rank });
    });
    hits.sort(function (a, b) {
      return b.rank - a.rank || a.row.name.localeCompare(b.row.name);
    });
    return hits.slice(0, 8).map(function (hit) { return hit.row; });
  }

  function drawResults(hits) {
    el["lang-results"].innerHTML = "";
    el["lang-results"].hidden = !hits.length;
    el["lang-q"].setAttribute("aria-expanded", hits.length ? "true" : "false");
    hits.forEach(function (row) {
      var item = document.createElement("li");
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", "false");
      item.tabIndex = -1;
      // The name and where it is spoken: enough to tell two languages apart.
      // The autonym and the code are still searched, not shown.
      var bits = [row.name];
      if (row.countries && row.countries.length) bits.push(row.countries.join(", "));
      text(item, bits.join(" · "));
      item.addEventListener("click", function () { add(row.code); });
      el["lang-results"].appendChild(item);
    });
  }

  function add(code) {
    if (state.langs.indexOf(code) < 0) state.langs.push(code);
    state.budget = null;
    el["lang-q"].value = "";
    drawResults([]);
    refresh();
  }

  // --- wiring --------------------------------------------------------------

  function group(container, field, apply) {
    var buttons = container.querySelectorAll("[data-" + field + "]");
    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener("click", function () {
        apply(button.getAttribute("data-" + field), button, buttons);
        refresh();
      });
    });
  }

  function pressOne(chosen, buttons, attribute) {
    Array.prototype.forEach.call(buttons, function (button) {
      button.setAttribute(attribute, button === chosen ? "true" : "false");
    });
  }

  function start() {
    readUrl();
    if (OLD_TABS.indexOf((window.location.hash || "").slice(1)) >= 0) {
      window.history.replaceState(null, "",
        window.location.pathname + window.location.search);
    }

    el["lang-q"].addEventListener("input", function () {
      drawResults(search(el["lang-q"].value));
    });
    el["lang-q"].addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      event.preventDefault();
      var hits = search(el["lang-q"].value);
      if (hits.length) add(hits[0].code);
    });
    document.addEventListener("click", function (event) {
      if (!el["lang-q"].contains(event.target)
        && !el["lang-results"].contains(event.target)) drawResults([]);
    });

    el.country.addEventListener("change", function () {
      state.country = el.country.value;
      refresh();
    });
    el.purpose.value = state.purpose;
    el.purpose.addEventListener("change", function () {
      state.purpose = el.purpose.value;
      state.budget = null;
      refresh();
    });
    group(document, "use", function (value, button, buttons) {
      state.use = value;
      pressOne(button, buttons, "aria-pressed");
    });
    // The URL may have set any of these before a click ever happens.
    Array.prototype.forEach.call(document.querySelectorAll("[data-use]"), function (b) {
      b.setAttribute("aria-pressed",
        b.getAttribute("data-use") === state.use ? "true" : "false");
    });
    el["copy-credit"].addEventListener("click", function () {
      try {
        navigator.clipboard.writeText(R.attribution(state, R.matching(state, data)));
        text(el["copy-credit"], "Copied");
      } catch (error) {
        text(el["copy-credit"], "Press Ctrl+C");
      }
    });

    refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
