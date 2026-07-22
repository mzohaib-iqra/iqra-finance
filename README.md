# IQRA Finance — School Finance & Management System

A desktop app (Windows) for tracking every rupee in and out of the school: student fees,
income, expenses, salaries, transport, and financial reports. Built with Electron + React.
All data is stored in a local file on your computer — no internet connection needed to use it.

## Getting the installer (recommended — no coding required)

This repo is wired with GitHub Actions, so every time this code is pushed to GitHub, a real
Windows installer is built automatically:

1. Push this folder to a GitHub repository (same way you've deployed your other apps).
2. Go to the repo's **Actions** tab → open the latest "Build Windows Installer" run.
3. Scroll to **Artifacts** → download **IQRA-Finance-Windows-Installer**.
4. Unzip it, run the `.exe` inside, and follow the installer. It creates a Start Menu
   entry and a desktop shortcut, just like any Windows program.

Optional: to get a permanent download link instead of an Actions artifact, create a Git tag
(e.g. `git tag v1.0.0 && git push --tags`) — the workflow will attach the installer to a
GitHub Release automatically.

## Building it yourself (if you have Node.js installed)

```bash
npm install
npm run dist
```

The installer will appear in the `release/` folder as `IQRA Finance Setup <version>.exe`.

To just run the app locally without packaging it (for testing):

```bash
npm install
npm start
```

## First launch

The first time the app runs, it asks you to create an Administrator account (username +
password) — there's no built-in default login. After that, everyone who opens the app signs
in with their own username and password. Add more accounts for other staff under
**Settings → Users & Permissions** (Admin only), choosing a role for each:

| Role | Add/Edit records | Delete records | Settings | Manage Users |
|---|---|---|---|---|
| Admin | ✅ | ✅ | ✅ | ✅ |
| Principal | ✅ | ✅ | ✅ | ❌ |
| Accountant | ✅ | ✅ | ❌ | ❌ |
| Data Entry Operator | ✅ | ❌ | ❌ | ❌ |
| Read-only User | ❌ | ❌ | ❌ | ❌ |

Passwords are stored locally as salted SHA-256 hashes — enough to keep casual users off a
shared school computer, but this is a single-file local app with no server, so treat it as
practical access control rather than bank-grade security.

## Where your data lives

All records are stored in a single JSON file on your computer, in:

```
%APPDATA%\IQRA Finance\iqra-finance-data.json
```

**Back this up regularly** — use the "Export Backup (JSON)" button in Settings and save the
copy somewhere safe (a USB drive, OneDrive/Google Drive folder, etc). If your computer's
disk fails or the app is reinstalled, this backup is the only way to restore your records.

## What's included

- Dashboard (cash/bank balances, monthly & yearly profit, pending fees/fines, charts)
- Students (records, fee history, pending-fee tracking)
- Income (all fee/income categories, printable receipts)
- Expenses (all expense categories, printable vouchers)
- Salary (employees, payroll, printable salary slips — auto-posts to Expenses)
- Transport (vehicles, drivers, routes, fuel/repair cost tracking per vehicle)
- Documents (certificates, result cards, and other issued paperwork — auto-posts fees to Income)
- Fines (late fee/discipline/library/custom — impose then collect, auto-posts to Income)
- Reports (daily/monthly/yearly/custom, P&L, cash flow, pending fees/fines, CSV export)
- Users & Permissions (login required, 5 roles, per-role access control)
- Dark Mode (toggle in Settings or the topbar)
- Settings (school info, categories, opening balances, backup & restore)

## Ideas for later

Bulk Excel import/export for student rolls, activity/audit log of who changed what, and a
calendar view of upcoming fee due dates — happy to build any of these next if useful.
