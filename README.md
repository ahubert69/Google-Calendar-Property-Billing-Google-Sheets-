# 📅 Google Calendar → Studio Billing (Google Sheets)

Automatically sync a **Google Calendar** to **Google Sheets** to track billing for an **hourly-rented studio**.

Each calendar event becomes a **billing record**, with automatic calculation of:
- session duration
- amount due
- amount paid
- remaining balance
- per-client financial summary

🔐 **No calendar needs to be public.**


> Always use the **same name** for the same client to keep totals consistent.

---

### Event Description (OPTIONAL, but recommended)

Use simple `key: value` lines.

| Key | Description | Required |
|---|---|---|
| `type` | `solo` or `group` | ❌ |
| `people` | number of people (informational) | ❌ |
| `rate` | custom hourly rate (override default) | ❌ |
| `paid` | amount already paid for this session | ❌ |

**Defaults**
- `type = solo`
- rate = value from `Settings`
- `paid = 0`

---

### Examples

**Standard solo session**
paid: 30

2️⃣ Apps Script

Open Extensions → Apps Script

Paste the full script into Code.gs

Run syncStudioBillingByYear() once

Grant permissions

3️⃣ Automatic Updates

Apps Script → Triggers:

Function: syncStudioBillingByYear

Type: Time-driven

Frequency: hourly or daily
