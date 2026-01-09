function syncStudioBillingByYear() {
  const calendarId = "yourID@group.calendar.google.com" // fill "yourID";
  const startYear = 2026;
  const yearsToSync = 1; // 2026..2027 (adjust)

  const ss = SpreadsheetApp.getActive();
  const cal = CalendarApp.getCalendarById(calendarId);

  const rates = getRates_(ss);

  for (let y = startYear; y < startYear + yearsToSync; y++) {
    const sheet = ss.getSheetByName(String(y)) || ss.insertSheet(String(y));
    sheet.clear();
    sheet.setFrozenRows(1);

    sheet.appendRow([
      "Client", "Start", "End", "Duration (h)",
      "Type", "N people", "Rate (/h)", "Due",
      "Paid", "Remainder",
      "Location", "Notes", "EventId"
    ]);

    const start = new Date(y, 0, 1, 0, 0, 0);
    const end = new Date(y + 1, 0, 1, 0, 0, 0);

    const events = cal.getEvents(start, end);
    const tz = ss.getSpreadsheetTimeZone();

    const rows = [];
    events.forEach(e => {
      if (e.isAllDayEvent()) return; // ignore all-day events

      const title = (e.getTitle() || "").trim();
      if (!title) return;

      const desc = e.getDescription() || "";
      const meta = parseMeta_(desc);

      const startTime = e.getStartTime();
      const endTime = e.getEndTime();
      const hours = Math.max(0, (endTime - startTime) / (1000 * 60 * 60));

      const type = (meta.type || "solo").toLowerCase(); // solo/group
      const people = meta.people != null ? Number(meta.people) : (type === "group" ? 2 : 1);

      // hourly rate: prefer "rate:" otherwise use default rate
      const rate =
        meta.rate != null ? Number(meta.rate) :
        (type === "group" ? rates.group_rate : rates.solo_rate);

      const due = round2_(hours * rate);
      const paid = meta.paid != null ? Number(meta.paid) : 0;
      const remaining = round2_(due - paid);

      rows.push([
        title,
        Utilities.formatDate(startTime, tz, "yyyy-MM-dd HH:mm"),
        Utilities.formatDate(endTime, tz, "yyyy-MM-dd HH:mm"),
        round2_(hours),
        type,
        people,
        rate,
        due,
        paid,
        remaining,
        e.getLocation() || "",
        summarizeNotes_(desc),
        e.getId()
      ]);
    });

    if (rows.length) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      // sort by date
      sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
        .sort({ column: 2, ascending: true });
    }
  }

  buildSummary_(ss, startYear); // summary for 2025 (and +)
}

//--------------------------------------------------------------------------------------------------
// ---- Helpers ----

function getRates_(ss) {
  const sh = ss.getSheetByName("Settings");
  const defaults = { solo_rate: 10, group_rate: 20 }; // arbitrary constant values

  if (!sh) return defaults;

  const data = sh.getDataRange().getValues();
  const map = {};
  data.slice(1).forEach(r => {
    const k = String(r[0] || "").trim();
    const v = Number(r[1]);
    if (k) map[k] = isFinite(v) ? v : r[1];
  });

  return {
    solo_rate: Number(map.solo_rate ?? defaults.solo_rate),
    group_rate: Number(map.group_rate ?? defaults.group_rate),
  };
}

// reads lines like "key: value"
function parseMeta_(desc) {
  const out = {};
  desc.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([a-zA-Z_]+)\s*:\s*(.+?)\s*$/);
    if (!m) return;
    const key = m[1].toLowerCase();
    const val = m[2];

    if (key === "paid" || key === "rate" || key === "people") {
      const num = Number(String(val).replace(",", "."));
      if (isFinite(num)) out[key] = num;
    } else if (key === "type") {
      out.type = String(val).trim().toLowerCase();
    }
  });
  return out;
}

function summarizeNotes_(desc) {
  // keep the description but remove meta lines "key: value"
  const lines = desc.split(/\r?\n/).filter(l => !l.match(/^\s*[a-zA-Z_]+\s*:\s*.+\s*$/));
  return lines.join("\n").trim();
}

function round2_(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Create/update a "Summary" tab with total due/paid/remaining per client
 * (across all existing year sheets)
 */
function buildSummary_(ss, startYear) {
  const sum = ss.getSheetByName("Summary") || ss.insertSheet("Summary");
  sum.clear();
  sum.setFrozenRows(1);
  sum.appendRow(["Client", "Due total", "Paid total", "Remainder total"]);

  const yearSheets = ss.getSheets()
    .map(s => s.getName())
    .filter(n => /^\d{4}$/.test(n) && Number(n) >= startYear);

  // Collect via Apps Script (simple and reliable)
  const totals = new Map();

  yearSheets.forEach(name => {
    const sh = ss.getSheetByName(name);
    const values = sh.getDataRange().getValues();
    if (values.length < 2) return;

    // columns: Client(0) ... Due(7) Paid(8) Remaining(9)
    values.slice(1).forEach(r => {
      const client = String(r[0] || "").trim();
      if (!client) return;
      const due = Number(r[7]) || 0;
      const paid = Number(r[8]) || 0;
      const rem = Number(r[9]) || 0;

      const prev = totals.get(client) || { due: 0, paid: 0, rem: 0 };
      prev.due += due;
      prev.paid += paid;
      prev.rem += rem;
      totals.set(client, prev);
    });
  });

  const rows = Array.from(totals.entries())
    .map(([client, t]) => [client, round2_(t.due), round2_(t.paid), round2_(t.rem)])
    .sort((a, b) => b[3] - a[3]); // sort by remaining desc

  if (rows.length) {
    sum.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}
