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

## Where your data lives

All records are stored in a single JSON file on your computer, in:

```
%APPDATA%\iqra-finance\iqra-finance-data.json
```

**Back this up regularly** — use the "Export Backup (JSON)" button in Settings and save the
copy somewhere safe (a USB drive, OneDrive/Google Drive folder, etc). If your computer's
disk fails or the app is reinstalled, this backup is the only way to restore your records.

## What's included so far

- Dashboard (cash/bank balances, monthly & yearly profit, pending fees, charts)
- Students (records, fee history, pending-fee tracking)
- Income (all fee/income categories, printable receipts)
- Expenses (all expense categories, printable vouchers)
- Salary (employees, payroll, printable salary slips — auto-posts to Expenses)
- Transport (vehicles, drivers, routes, fuel/repair cost tracking)
- Reports (daily/monthly/yearly/custom, P&L, cash flow, pending fees, CSV export)
- Settings (school info, categories, opening balances, backup & restore)

## Coming next

Documents Management, Fine Management, multi-user roles & permissions, and Dark Mode.
