/* What matches a selection.

   No page, no element, no fetch: plain functions over the selection and the
   language files, so the tests can ask them directly through node.

   Every per dataset, per split figure here is read from data/lang/<code>.json
   exactly as scripts/aggregate.py wrote it, and a figure the aggregate does
   not carry is left absent rather than apportioned. */

(function (root) {
  "use strict";

  var PURPOSES = {
    asr: { task: "asr_train", role: "train", noun: "training",
      use: "training speech recognition" },
    eval: { task: "asr_eval", role: "test", noun: "test",
      use: "evaluating speech recognition" },
    lm: { task: "speech_lm_pretrain", role: "train", noun: "training",
      use: "speech language model pretraining" },
    tts: { task: "tts_train", role: "train", noun: "training",
      use: "text to speech" }
  };
  var COUNTED = ["allowed_reviewed", "allowed_unreviewed"];

  /* Why a dataset is not in the basket. Each one says who decided and what
     about, because "terms do not allow this" tells a visitor neither. An
     answer nobody has read yet is not a refusal, so it is not in here: those
     datasets are reported separately. */
  function purposeReason(outcome, purpose) {
    var use = PURPOSES[purpose].use;
    if (outcome === "not_allowed") return "the publisher's terms do not allow " + use;
    if (outcome === "conditional") {
      return "the terms allow " + use + " only under a condition";
    }
    if (outcome === "unclear") return "the terms do not answer " + use;
    return "nobody has read the terms for " + use + " yet";
  }
  var COMMERCIAL_REASON = {
    not_allowed: "commercial use not allowed",
    conditional: "commercial use allowed only under a condition",
    unclear: "the terms do not answer commercial use",
    not_checked: "nobody has read the terms for commercial use yet",
    allowed_unreviewed: "commercial use allowed but not yet reviewed"
  };

  function fold(text) {
    return String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  }

  /* The figure the page shows. Whole hours once there are ten of them, one
     decimal below that, so "655 h" and "2.5 h" both read as a quantity.
     Common Voice holds 0.04 h of isiZulu, which one decimal would print as
     "0": a real quantity shown as nothing. It says "under 0.1" instead. */
  function fmt(x) {
    if (x >= 10) return Math.round(x).toLocaleString("en-GB");
    if (x > 0 && x < 0.05) return "under 0.1";
    return String(Math.round(x * 10) / 10);
  }

  function key(code, row) { return code + ":" + row.id; }

  /* Bytes, as a size someone can judge against a disk. */
  function size(bytes) {
    if (!bytes) return null;
    if (bytes >= 1e12) return (bytes / 1e12).toFixed(1) + " TB";
    if (bytes >= 1e9) return Math.round(bytes / 1e9) + " GB";
    if (bytes >= 1e6) return Math.round(bytes / 1e6) + " MB";
    return Math.max(1, Math.round(bytes / 1e3)) + " KB";
  }

  /* The published size of the split this purpose reads, and whether that
     figure is for this language alone. The size is measured where the loader
     can reach a source, so a source it cannot reach has no figure. */
  function bytesFor(row, purpose) {
    var source = row.source;
    if (!source || !source.bytes) return null;
    var amount = source.bytes[PURPOSES[purpose].role];
    if (!amount) return null;
    return { bytes: amount, covers: source.bytes_covers };
  }

  var SITE_NAME = "AfroSpeech Data";

  /* The hours this dataset offers for this purpose. Evaluation counts the
     test split; training counts the train split, or, where no split has been
     measured, the hours whose split is still unknown. Those are shown
     apart and left out of the total, so a test split is never counted as
     training by accident. */
  function available(row, purpose) {
    if (purpose === "eval") return row.test || 0;
    // Pretraining a speech language model needs no transcript, so it also
    // counts the measured train audio that has none (AfriVoice, Kencorpus).
    var extra = purpose === "lm" ? (row.untranscribed || 0) : 0;
    if (row.train || extra) return (row.train || 0) + extra;
    return row.pending || 0;
  }

  function unsplit(row, purpose) {
    return purpose !== "eval" && !row.train
      && !(purpose === "lm" && row.untranscribed) && !!row.pending;
  }

  /* A row's hours in each role, as published. Null where the aggregate has no
     figure; blank is not zero. */
  function splits(row, purpose) {
    var out = [{ role: "train", label: "Train", hours: row.train || null },
               { role: "dev", label: "Dev", hours: row.dev || null },
               { role: "test", label: "Test", hours: row.test || null }];
    if (purpose === "lm" && row.untranscribed) {
      out.push({ role: "untranscribed", label: "Untranscribed", hours: row.untranscribed });
    }
    return out;
  }

  /* What is known about a row's speakers, in one line. Counts are never added
     up, because one person can be in more than one split. A publisher's figure
     is quoted as written, and one for the whole dataset is never given as this
     language's. */
  function speakersLine(row) {
    if (row.country_note) return "Speakers: not counted by country";
    var counts = row.speakers || {};
    var parts = ["train", "dev", "test"].filter(function (role) {
      return counts[role] !== null && counts[role] !== undefined;
    }).map(function (role) {
      return role + " " + counts[role].toLocaleString("en-GB");
    });
    if (parts.length) {
      return "Speakers: " + parts.join(" \u00b7 ")
        + (row.speakers_stated ? ". Publisher states " + row.speakers_stated : "");
    }
    if (row.speakers_stated) return "Speakers: " + row.speakers_stated + ", as the publisher states";
    if (row.speakers_dataset) {
      return "Speakers: not given per language. Whole dataset: " + row.speakers_dataset;
    }
    return "Speakers: not recorded";
  }

  /* A row narrowed to one country, from the publisher's own country column
     (row.countries, hours per role) or from the one country the row's own
     language code names (row.country). Returns the narrowed row; "other"
     when the row is known to hold none of that country; null when nothing
     says where its speakers are from, which the page reports apart. Hours
     are never shared out: a row with no country figure is not counted. */
  function byCountry(row, country) {
    if (row.countries) {
      var pick = {};
      var any = false;
      ["train", "dev", "test"].forEach(function (role) {
        var hours = (row.countries[role] || {})[country];
        pick[role] = hours || null;
        if (hours) any = true;
      });
      if (!any) return "other";
      // Speakers and sizes are for the whole split, not this country.
      return Object.assign({}, row, pick, { pending: null, speakers: null,
        speakers_stated: null, speakers_dataset: null, source: null,
        country_note: "hours from the publisher's country column" });
    }
    if (row.country) return row.country === country ? row : "other";
    return null;
  }

  /* Every country the selected languages record, with its hours across all
     roles, largest first: what the country chooser offers. */
  function countries(state, data) {
    var hours = {};
    state.langs.forEach(function (code) {
      ((data[code] || {}).datasets || []).forEach(function (row) {
        if (row.countries) {
          Object.keys(row.countries).forEach(function (role) {
            Object.keys(row.countries[role]).forEach(function (name) {
              hours[name] = (hours[name] || 0) + row.countries[role][name];
            });
          });
        } else if (row.country) {
          hours[row.country] = (hours[row.country] || 0)
            + (row.train || 0) + (row.dev || 0) + (row.test || 0) + (row.pending || 0);
        }
      });
    });
    return Object.keys(hours).sort(function (a, b) {
      return hours[b] - hours[a] || a.localeCompare(b);
    });
  }

  /* What the page shows: the rows that match, the rows left out with the
     reason each one was, and the hours of the rows whose split is measured.
     Hours nobody has placed in a split are listed and totalled apart. */
  function matching(state, data) {
    var spec = PURPOSES[state.purpose];
    var rows = [];
    var leftOut = [];
    var unchecked = [];
    var noCountry = [];

    function refuse(entry, outcome, reason) {
      var where = outcome === "not_checked" ? unchecked : leftOut;
      where.push({ name: entry.name, reason: reason, evidence: entry.evidence });
    }
    state.langs.forEach(function (code) {
      var language = data[code];
      if (!language) return;
      language.datasets.forEach(function (row) {
        if (state.country) {
          var narrowed = byCountry(row, state.country);
          if (narrowed === "other") return;
          if (narrowed === null) {
            if (available(row, state.purpose) > 0) noCountry.push(row.name);
            return;
          }
          row = narrowed;
        }
        // A dataset its publisher presents as an evaluation benchmark is
        // never offered for training.
        if (state.purpose !== "eval" && row.evaluation_set) return;
        var hours = available(row, state.purpose);
        if (hours <= 0) return;
        var name = row.name + (state.langs.length > 1 ? " (" + language.name + ")" : "");
        var outcome = row.outcomes[spec.task];
        var evidence = (row.evidence || {})[spec.task];
        var entry = { name: name, evidence: evidence };
        if (state.use === "commercial") {
          // Commercial needs both answers reviewed and allowed (main handoff
          // 8.1); anything else is left out and said so.
          var money = row.outcomes.commercial;
          if (money !== "allowed_reviewed") {
            refuse({ name: name, evidence: (row.evidence || {}).commercial },
              money, COMMERCIAL_REASON[money] || "commercial use not reviewed");
            return;
          }
          if (outcome !== "allowed_reviewed") {
            // Commercial needs this answer reviewed too, so "allowed, nobody
            // has checked it" is its own reason.
            refuse(entry, outcome, outcome === "allowed_unreviewed"
              ? PURPOSES[state.purpose].use + " is allowed but not yet reviewed"
              : purposeReason(outcome, state.purpose));
            return;
          }
        } else if (COUNTED.indexOf(outcome) < 0) {
          refuse(entry, outcome, purposeReason(outcome, state.purpose));
          return;
        }
        rows.push({ code: code, row: row, name: name, hours: hours,
          splits: splits(row, state.purpose),
          cost: bytesFor(row, state.purpose),
          unsplit: unsplit(row, state.purpose) });
      });
    });
    rows.sort(function (a, b) { return b.hours - a.hours; });

    var total = 0;
    var roles = { train: 0, dev: 0, test: 0, untranscribed: 0 };
    var pending = 0;
    var hosts = {};
    var counted = [];
    var unmeasured = [];
    var bytes = 0;
    var bytesPartial = false;
    var bytesApproximate = false;
    rows.forEach(function (entry) {
      if (entry.unsplit) {
        pending += entry.hours;
        unmeasured.push(entry);
        return;
      }
      total += entry.hours;
      entry.splits.forEach(function (split) { roles[split.role] += split.hours || 0; });
      hosts[entry.row.host] = true;
      if (entry.cost) {
        bytes += entry.cost.bytes;
        if (entry.cost.covers !== "this language") bytesApproximate = true;
      } else {
        bytesPartial = true;
      }
      counted.push(entry);
    });
    return { rows: rows, counted: counted, unmeasured: unmeasured,
      leftOut: leftOut, unchecked: unchecked, noCountry: noCountry, total: total, roles: roles, pending: pending,
      bytes: bytes, bytesPartial: bytesPartial, bytesApproximate: bytesApproximate,
      hosts: Object.keys(hosts).length };
  }

  /* What a user of this selection owes its publishers. Most of these
     licences require attribution, and a page that hands out the data
     without handing out the credit is the thing to avoid. One line per
     dataset, with its terms and where the data came from. */
  function attribution(state, view) {
    var lines = ["# Data used", "",
      "Listed by " + SITE_NAME + ". Each dataset below keeps its own terms;",
      "this list is what they ask for, not legal advice.", ""];
    var seen = {};
    view.rows.forEach(function (entry) {
      var row = entry.row;
      if (seen[row.id]) return;
      seen[row.id] = true;
      lines.push("## " + row.name);
      if (row.institution) lines.push("Published by " + row.institution + ".");
      lines.push("Terms: " + (row.licence || "not recorded")
        + (row.licence_url ? " (" + row.licence_url + ")" : ""));
      if (row.link) lines.push("Data: " + row.link);
      if (row.citation) lines.push("", row.citation);
      lines.push("");
    });
    return lines.join("\n");
  }

  /* --- the selection, as a URL ------------------------------------------
     What the visitor chose goes in the query string, so a page can be shared
     and comes back the same. Parameters from the old script builder are
     ignored, so a saved link still opens on its language. These two are each
     other's inverse and are tested as such. */

  function fromQuery(search, known) {
    var q = new URLSearchParams(search || "");
    var state = emptyState();
    var region = "";
    var langs = [];
    (q.get("langs") || "").split(",").forEach(function (c) {
      /* A retired regional code (en-NG, rolled into en on 2026-11-09) opens
         its base language with that country chosen, so old links still work. */
      var m = /^([a-z]{2,3})-([A-Z]{2})$/.exec(c);
      if (known && !known[c] && m && known[m[1]]) { region = m[2]; c = m[1]; }
      if (c && (!known || known[c]) && langs.indexOf(c) < 0) langs.push(c);
    });
    if (langs.length) state.langs = langs;
    if (PURPOSES[q.get("purpose")]) state.purpose = q.get("purpose");
    if (q.get("use") === "commercial") state.use = "commercial";
    state.country = q.get("country") || region;
    return state;
  }

  function toQuery(state) {
    var q = new URLSearchParams();
    if (state.langs.length) q.set("langs", state.langs.join(","));
    q.set("purpose", state.purpose);
    if (state.use === "commercial") q.set("use", "commercial");
    if (state.country) q.set("country", state.country);
    return q.toString();
  }

  /* A selection with nothing chosen, so a caller can state only what it
     cares about. */
  function emptyState() {
    return { langs: [], purpose: "asr", use: "research", country: "" };
  }

  root.AfroRecipe = { PURPOSES: PURPOSES, fold: fold, fmt: fmt, key: key,
    available: available, unsplit: unsplit, splits: splits, speakersLine: speakersLine,
    matching: matching, countries: countries, byCountry: byCountry, emptyState: emptyState, fromQuery: fromQuery,
    toQuery: toQuery, size: size, bytesFor: bytesFor, attribution: attribution };

  if (typeof module !== "undefined" && module.exports) module.exports = root.AfroRecipe;
})(typeof window !== "undefined" ? window : globalThis);
