import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import Chart from 'chart.js/auto';

/* =========================================================================
   CONSTANTS
   ========================================================================= */

const DEFAULT_INCOME_CATEGORIES = [
  "Student Monthly Fee","Admission Fee","Registration Fee","Transport Fee","Fine Collection",
  "Board Registration Fee","Board Exam Fee","Documents Fee","Character Certificate Fee",
  "Migration Fee","Duplicate Certificate Fee","Prospectus Sale","Uniform Sale","Books Sale",
  "Stationery Sale","Donation","Hostel Fee","Lab Fee","Library Fee","Sports Fee","Computer Fee","Other"
];

const DEFAULT_EXPENSE_CATEGORIES = [
  "Teachers Salaries","Staff Salaries","Electricity Bill","Gas Bill","Internet Bill","Water Bill",
  "Rent","Building Maintenance","Furniture","Computer Purchase","Stationery","Books","Marketing",
  "Advertisement","Transport Fuel","Vehicle Repair","Generator Fuel","Lab Equipment","Sports Equipment",
  "Cleaning","Tea & Refreshments","Office Supplies","Miscellaneous"
];

const DEFAULT_PAYMENT_METHODS = ["Cash","Bank Transfer","Cheque","Easypaisa","JazzCash"];

const CLASS_LIST = ["Play Group","Nursery","Prep","Class 1","Class 2","Class 3","Class 4","Class 5",
  "Class 6","Class 7","Class 8","Class 9","Class 10","Class 11 (FSc-I)","Class 12 (FSc-II)"];

const SECTIONS = ["Boys","Girls"];

const DEFAULT_DATA = {
  settings: {
    schoolName: "IQRA Public School and College",
    tagline: "Boys & Girls Campus — Dara Pezu",
    address: "Dara Pezu",
    phone: "",
    logo: "",
    session: "2026-2027",
    receiptPrefix: "RC",
    voucherPrefix: "EV",
    slipPrefix: "SL",
    nextReceiptNo: 1001,
    nextVoucherNo: 2001,
    nextSlipNo: 3001,
    openingCash: 0,
    openingBank: 0,
    incomeCategories: DEFAULT_INCOME_CATEGORIES.slice(),
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES.slice(),
    paymentMethods: DEFAULT_PAYMENT_METHODS.slice(),
    darkMode: false,
    docPrefix: "DOC",
    nextDocNo: 4001,
  },
  students: [],
  income: [],
  expenses: [],
  employees: [],
  salaryPayments: [],
  vehicles: [],
  documents: [],
  fines: [],
  users: [],
};

function freshData() { return JSON.parse(JSON.stringify(DEFAULT_DATA)); }

const EMPLOYEE_ROLES = ["Teacher","Staff","Admin Officer","Other"];
const VEHICLE_TYPES = ["Van","Bus","Coaster","Rickshaw","Other"];
const DOCUMENT_TYPES = ["Board Registration Certificate","Board Exam Result","Character Certificate","Migration Certificate","Duplicate Certificate","Result Card","Other"];
const DOCUMENT_FEE_CATEGORY = {
  "Board Registration Certificate": "Board Registration Fee",
  "Board Exam Result": "Board Exam Fee",
  "Character Certificate": "Character Certificate Fee",
  "Migration Certificate": "Migration Fee",
  "Duplicate Certificate": "Duplicate Certificate Fee",
  "Result Card": "Documents Fee",
  "Other": "Documents Fee",
};
const FINE_TYPES = ["Late Fee Fine","Discipline Fine","Library Fine","Custom Fine"];
const USER_ROLES = ["Admin","Principal","Accountant","Data Entry Operator","Read-only User"];

function getCapabilities(role) {
  const isAdmin = role === 'Admin';
  const isPrincipal = role === 'Principal';
  const isAccountant = role === 'Accountant';
  const isDataEntry = role === 'Data Entry Operator';
  return {
    canEdit: isAdmin || isPrincipal || isAccountant || isDataEntry,
    canDelete: isAdmin || isPrincipal || isAccountant,
    canAccessSettings: isAdmin || isPrincipal,
    canManageUsers: isAdmin,
  };
}

/* Simple local password hashing using the Web Crypto API (SHA-256 + per-user salt).
   This is meant to keep casual users out of a shared school PC, not to withstand
   a determined offline attack on the data file — that trade-off is reasonable for
   a single-computer local app with no server component. */
function randomSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(salt + ':' + password));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* =========================================================================
   UTILITIES
   ========================================================================= */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

function formatPKR(n) {
  const num = Number(n) || 0;
  return 'Rs ' + num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function formatDate(s) {
  if (!s) return '-';
  const d = new Date(s + 'T00:00:00');
  if (isNaN(d)) return s;
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

function monthKeyOf(dateStr) { return (dateStr || '').slice(0,7); }

function monthLabel(key) {
  const [y,m] = key.split('-');
  const d = new Date(Number(y), Number(m)-1, 1);
  return d.toLocaleString('en-US', { month:'short' }) + " '" + String(y).slice(2);
}

function getLast6MonthKeys() {
  const arr = [];
  const now = new Date();
  for (let i=5;i>=0;i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    arr.push(d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'));
  }
  return arr;
}

async function exportCSV(filename, headerRow, rows) {
  const esc = (c) => `"${String(c ?? '').replace(/"/g,'""')}"`;
  const csv = [headerRow, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const result = await window.electronAPI.exportCSV(filename, csv);
  return result;
}

function monthsBetweenInclusive(start, end) {
  const s = new Date(start), e = new Date(end);
  if (isNaN(s) || isNaN(e) || s > e) return 0;
  return Math.max(0, (e.getFullYear()-s.getFullYear())*12 + (e.getMonth()-s.getMonth()) + 1);
}

function effectiveMonthlyFee(student) {
  const base = Number(student.monthlyFee) || 0;
  const afterSch = base - (base * (Number(student.scholarshipPercent) || 0) / 100);
  const afterDisc = afterSch - (Number(student.discount) || 0);
  return Math.max(0, afterDisc);
}

function studentPendingFee(student, incomeList) {
  const today = new Date();
  const admission = student.admissionDate ? new Date(student.admissionDate) : today;
  const start = admission > today ? today : admission;
  const months = Math.min(monthsBetweenInclusive(start, today), 60);
  const monthlyDue = effectiveMonthlyFee(student);
  const transportDue = student.transport ? (Number(student.transportFee) || 0) : 0;
  const totalDue = months * (monthlyDue + transportDue);
  const paid = incomeList
    .filter(i => i.studentId === student.id && (i.category === 'Student Monthly Fee' || i.category === 'Transport Fee'))
    .reduce((s,i) => s + (Number(i.amount) || 0), 0);
  return Math.max(0, Math.round(totalDue - paid));
}

/* Balance / totals helpers */
function isCash(paymentMethod) { return paymentMethod === 'Cash'; }

function getCashBalance(data) {
  const ci = data.income.filter(i => isCash(i.paymentMethod)).reduce((s,i)=>s+Number(i.amount||0),0);
  const ce = data.expenses.filter(e => isCash(e.paymentMethod)).reduce((s,e)=>s+Number(e.amount||0),0);
  return (Number(data.settings.openingCash)||0) + ci - ce;
}
function getBankBalance(data) {
  const bi = data.income.filter(i => !isCash(i.paymentMethod)).reduce((s,i)=>s+Number(i.amount||0),0);
  const be = data.expenses.filter(e => !isCash(e.paymentMethod)).reduce((s,e)=>s+Number(e.amount||0),0);
  return (Number(data.settings.openingBank)||0) + bi - be;
}
function totalsForRange(data, fromDate, toDate) {
  const inRange = (d) => d >= fromDate && d <= toDate;
  const income = data.income.filter(i => inRange(i.date)).reduce((s,i)=>s+Number(i.amount||0),0);
  const expense = data.expenses.filter(e => inRange(e.date)).reduce((s,e)=>s+Number(e.amount||0),0);
  return { income, expense, profit: income - expense };
}
function totalsForMonth(data, ymKey) {
  const income = data.income.filter(i=>monthKeyOf(i.date)===ymKey).reduce((s,i)=>s+Number(i.amount||0),0);
  const expense = data.expenses.filter(e=>monthKeyOf(e.date)===ymKey).reduce((s,e)=>s+Number(e.amount||0),0);
  return { income, expense, profit: income - expense };
}
function totalsForYear(data, year) {
  const income = data.income.filter(i=>(i.date||'').startsWith(String(year))).reduce((s,i)=>s+Number(i.amount||0),0);
  const expense = data.expenses.filter(e=>(e.date||'').startsWith(String(year))).reduce((s,e)=>s+Number(e.amount||0),0);
  return { income, expense, profit: income - expense };
}

/* =========================================================================
   ICONS (small hand-drawn line icon set, 22x22 stroke style)
   ========================================================================= */
function Icon({ name, className }) {
  const cls = className || "w-5 h-5";
  const common = { fill:"none", stroke:"currentColor", strokeWidth:"1.8", strokeLinecap:"round", strokeLinejoin:"round" };
  switch(name) {
    case 'dashboard': return <svg viewBox="0 0 24 24" className={cls} {...common}><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></svg>;
    case 'students': return <svg viewBox="0 0 24 24" className={cls} {...common}><circle cx="12" cy="8" r="3.2"/><path d="M5 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/></svg>;
    case 'income': return <svg viewBox="0 0 24 24" className={cls} {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v10M8.5 10.5 12 7l3.5 3.5"/></svg>;
    case 'expense': return <svg viewBox="0 0 24 24" className={cls} {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v10M8.5 13.5 12 17l3.5-3.5"/></svg>;
    case 'reports': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>;
    case 'settings': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M4 7h10M18 7h2M4 12h2M8 12h12M4 17h14M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="17" r="2"/></svg>;
    case 'plus': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'close': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M6 6l12 12M18 6 6 18"/></svg>;
    case 'search': return <svg viewBox="0 0 24 24" className={cls} {...common}><circle cx="11" cy="11" r="7"/><path d="M20 20l-4.3-4.3"/></svg>;
    case 'edit': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/></svg>;
    case 'trash': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>;
    case 'print': return <svg viewBox="0 0 24 24" className={cls} {...common}><rect x="6" y="9" width="12" height="7" rx="1"/><path d="M6 9V4h12v5M6 16v4h12v-4"/></svg>;
    case 'eye': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/></svg>;
    case 'chevron': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M9 6l6 6-6 6"/></svg>;
    case 'bus': return <svg viewBox="0 0 24 24" className={cls} {...common}><rect x="3" y="5" width="18" height="11" rx="2"/><path d="M3 12h18M7 16v2M17 16v2"/><circle cx="7.5" cy="18.3" r="1"/><circle cx="16.5" cy="18.3" r="1"/></svg>;
    case 'payroll': return <svg viewBox="0 0 24 24" className={cls} {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.2" r="1.8"/><path d="M6 15.2c0-1.5 1.1-2.4 2.5-2.4s2.5.9 2.5 2.4M13.5 9h4.5M13.5 12h4.5M13.5 15h3"/></svg>;
    case 'clock': return <svg viewBox="0 0 24 24" className={cls} {...common}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>;
    case 'wallet': return <svg viewBox="0 0 24 24" className={cls} {...common}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M15 14h3"/></svg>;
    case 'bank': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M3 10l9-6 9 6M4 10v9M20 10v9M8 10v9M16 10v9M2 19h20"/></svg>;
    case 'download': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></svg>;
    case 'upload': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M12 21V9M7 14l5-5 5 5M4 4h16"/></svg>;
    case 'refresh': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M4 12a8 8 0 0 1 14-5.3L21 9M20 12a8 8 0 0 1-14 5.3L3 15M21 4v5h-5M3 20v-5h5"/></svg>;
    case 'user': return <svg viewBox="0 0 24 24" className={cls} {...common}><circle cx="12" cy="8" r="3.2"/><path d="M5 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/></svg>;
    case 'alert': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h0"/></svg>;
    case 'moon': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>;
    case 'sun': return <svg viewBox="0 0 24 24" className={cls} {...common}><circle cx="12" cy="12" r="4.2"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>;
    case 'logout': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h12"/></svg>;
    case 'document': return <svg viewBox="0 0 24 24" className={cls} {...common}><path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4M9 12h6M9 16h6M9 8h2"/></svg>;
    case 'lock': return <svg viewBox="0 0 24 24" className={cls} {...common}><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
    default: return null;
  }
}

/* =========================================================================
   REUSABLE UI
   ========================================================================= */
function Card({ children, className }) {
  return <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${className||''}`}>{children}</div>;
}

function StatCard({ label, value, icon, tint, sub }) {
  const tints = {
    indigo: 'bg-brand-50 text-brand-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <Card className="p-5 flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
        <p className="text-2xl font-display font-bold text-ink">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tints[tint||'indigo']}`}>
        <Icon name={icon} className="w-5 h-5" />
      </div>
    </Card>
  );
}

function Button({ children, onClick, variant, className, type, disabled }) {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    danger: 'bg-rose-50 text-rose-600 hover:bg-rose-100',
    ghost: 'text-slate-500 hover:bg-slate-100',
  };
  return (
    <button type={type||'button'} disabled={disabled} onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant||'primary']} ${className||''}`}>
      {children}
    </button>
  );
}

function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 no-print" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto animate-fade`} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-display font-semibold text-slate-800 text-base">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"><Icon name="close" className="w-4 h-4"/></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({ text, onConfirm, onCancel }) {
  return (
    <Modal title="Please confirm" onClose={onCancel}>
      <p className="text-sm text-slate-600 mb-5">{text}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>Yes, proceed</Button>
      </div>
    </Modal>
  );
}

function Field({ label, children, required }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">{label}{required && <span className="text-rose-500"> *</span>}</span>
      {children}
    </label>
  );
}
const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white";

function Badge({ children, tint }) {
  const tints = { emerald:'bg-emerald-50 text-emerald-700', rose:'bg-rose-50 text-rose-700', slate:'bg-slate-100 text-slate-600', amber:'bg-amber-50 text-amber-700' };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tints[tint||'slate']}`}>{children}</span>;
}

function EmptyState({ icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3"><Icon name={icon} className="w-6 h-6"/></div>
      <p className="font-medium text-slate-600">{title}</p>
      {sub && <p className="text-sm text-slate-400 mt-1 max-w-sm">{sub}</p>}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Icon name="search" className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||'Search...'} className={inputCls + " pl-9"} />
    </div>
  );
}

/* Chart components */
function BarChart({ labels, series }) {
  const ref = useRef(null); const chartRef = useRef(null);
  useEffect(() => {
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(ref.current.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: series.map(s => ({ label:s.label, data:s.data, backgroundColor:s.color, borderRadius:6, maxBarThickness:28 })) },
      options: { responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, font:{size:11} } } },
        scales:{ y:{ beginAtZero:true, ticks:{ callback:v=>'Rs '+Number(v).toLocaleString(), font:{size:10} }, grid:{color:'#f1f2f8'} }, x:{ grid:{display:false}, ticks:{font:{size:11}} } } }
    });
    return () => chartRef.current && chartRef.current.destroy();
  }, [JSON.stringify(labels), JSON.stringify(series)]);
  return <canvas ref={ref}></canvas>;
}

function DoughnutChart({ labels, data, colors }) {
  const ref = useRef(null); const chartRef = useRef(null);
  useEffect(() => {
    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(ref.current.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets:[{ data, backgroundColor: colors, borderWidth:2, borderColor:'#fff' }] },
      options: { responsive:true, maintainAspectRatio:false, cutout:'62%', plugins:{ legend:{ position:'right', labels:{ boxWidth:9, font:{size:10.5}, padding:10 } } } }
    });
    return () => chartRef.current && chartRef.current.destroy();
  }, [JSON.stringify(labels), JSON.stringify(data)]);
  return <canvas ref={ref}></canvas>;
}

const PALETTE = ['#655ff0','#059669','#e11d48','#d97706','#0891b2','#7c3aed','#db2777','#65a30d','#4f46e5','#0d9488','#c026d3','#ca8a04'];

/* =========================================================================
   LOCAL DATA HOOK
   ========================================================================= */
function useLocalData() {
  const [data, setDataState] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    window.electronAPI.loadData()
      .then(saved => {
        if (!mounted) return;
        const base = freshData();
        const merged = saved ? { ...base, ...saved, settings: { ...base.settings, ...(saved.settings || {}) } } : base;
        setDataState(merged);
        setLoaded(true);
      })
      .catch(err => { console.error('Load failed', err); setDataState(freshData()); setLoaded(true); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (loaded && data) {
      window.electronAPI.saveData(data).catch(err => console.error('Save failed', err));
    }
  }, [data, loaded]);

  const setData = useCallback((updater) => {
    setDataState(prev => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  return [data, setData, loaded];
}

/* =========================================================================
   SIDEBAR + TOPBAR
   ========================================================================= */
const NAV_ITEMS = [
  { key:'dashboard', label:'Dashboard', icon:'dashboard' },
  { key:'students', label:'Students', icon:'students' },
  { key:'income', label:'Income', icon:'income' },
  { key:'expenses', label:'Expenses', icon:'expense' },
  { key:'salary', label:'Salary', icon:'payroll' },
  { key:'transport', label:'Transport', icon:'bus' },
  { key:'documents', label:'Documents', icon:'document' },
  { key:'fines', label:'Fines', icon:'alert' },
  { key:'reports', label:'Reports', icon:'reports' },
  { key:'settings', label:'Settings', icon:'settings' },
];

function Sidebar({ tab, setTab, settings, mobileOpen, setMobileOpen, caps, currentUser, onLogout }) {
  const visibleItems = NAV_ITEMS.filter(item => item.key !== 'settings' || caps.canAccessSettings);
  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={()=>setMobileOpen(false)}></div>}
      <aside className={`fixed lg:static z-40 h-full w-64 shrink-0 bg-[#181430] text-white flex flex-col transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          {settings.logo ? <img src={settings.logo} className="w-9 h-9 rounded-lg object-cover bg-white" /> : <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center font-display font-bold">IQ</div>}
          <div className="min-w-0">
            <p className="font-display font-semibold text-sm leading-tight truncate">{settings.schoolName}</p>
            <p className="text-[11px] text-white/50 truncate">{settings.tagline}</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleItems.map(item => (
            <button key={item.key} onClick={()=>{ setTab(item.key); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${tab===item.key ? 'bg-brand-600 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
              <Icon name={item.icon} className="w-[18px] h-[18px]" />
              {item.label}
            </button>
          ))}
        </nav>
        {currentUser && (
          <div className="px-4 py-3 border-t border-white/10 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0"><Icon name="user" className="w-4 h-4 text-white/70" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium truncate">{currentUser.fullName || currentUser.username}</p>
              <p className="text-[10px] text-white/40 truncate">{currentUser.role}</p>
            </div>
            <button title="Log out" onClick={onLogout} className="p-1.5 rounded-lg text-white/40 hover:bg-white/10 hover:text-white"><Icon name="logout" className="w-4 h-4"/></button>
          </div>
        )}
        <div className="px-5 py-3 border-t border-white/10 text-[11px] text-white/35">
          Session {settings.session}<br/>Data stored locally on this computer
        </div>
      </aside>
    </>
  );
}

function Topbar({ setMobileOpen, title, subtitle, darkMode, onToggleDark }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(()=>setNow(new Date()), 60000); return ()=>clearInterval(t); }, []);
  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-100 px-4 sm:px-6 py-4 flex items-center justify-between no-print">
      <div className="flex items-center gap-3">
        <button className="lg:hidden text-slate-500 p-1" onClick={()=>setMobileOpen(true)}>
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </button>
        <div>
          <h1 className="font-display font-bold text-lg text-ink">{title}</h1>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} onClick={onToggleDark}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 transition">
          <Icon name={darkMode ? 'sun' : 'moon'} className="w-[18px] h-[18px]" />
        </button>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-slate-600">{now.toLocaleDateString('en-GB',{weekday:'long', day:'numeric', month:'long', year:'numeric'})}</p>
          <p className="text-xs text-slate-400">{now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</p>
        </div>
      </div>
    </header>
  );
}

/* =========================================================================
   DASHBOARD
   ========================================================================= */
function Dashboard({ data, setTab }) {
  const today = todayStr();
  const todayIncome = data.income.filter(i=>i.date===today).reduce((s,i)=>s+Number(i.amount||0),0);
  const todayExpense = data.expenses.filter(e=>e.date===today).reduce((s,e)=>s+Number(e.amount||0),0);
  const cash = getCashBalance(data);
  const bank = getBankBalance(data);
  const thisMonth = todayStr().slice(0,7);
  const monthTotals = totalsForMonth(data, thisMonth);
  const yearTotals = totalsForYear(data, todayStr().slice(0,4));
  const activeStudents = data.students.filter(s=>s.status==='Active');
  const transportStudents = activeStudents.filter(s=>s.transport);
  const pendingFeeTotal = activeStudents.reduce((s,st)=>s+studentPendingFee(st, data.income),0);
  const pendingFinesTotal = data.fines.filter(f=>f.status==='Pending').reduce((s,f)=>s+Number(f.amount||0),0);

  const months = getLast6MonthKeys();
  const incomeSeries = months.map(m=>totalsForMonth(data,m).income);
  const expenseSeries = months.map(m=>totalsForMonth(data,m).expense);
  const monthLabels = months.map(monthLabel);

  const expenseByCat = {};
  data.expenses.filter(e=>monthKeyOf(e.date)===thisMonth).forEach(e=>{ expenseByCat[e.category] = (expenseByCat[e.category]||0) + Number(e.amount||0); });
  const expCatLabels = Object.keys(expenseByCat);
  const expCatData = Object.values(expenseByCat);

  const recent = [
    ...data.income.map(i=>({...i, type:'in'})),
    ...data.expenses.map(e=>({...e, type:'out'})),
  ].sort((a,b)=> (b.date||'').localeCompare(a.date||'')).slice(0,8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's Income" value={formatPKR(todayIncome)} icon="income" tint="emerald" />
        <StatCard label="Today's Expenses" value={formatPKR(todayExpense)} icon="expense" tint="rose" />
        <StatCard label="Cash in Hand" value={formatPKR(cash)} icon="wallet" tint="indigo" />
        <StatCard label="Bank Balance" value={formatPKR(bank)} icon="bank" tint="indigo" />
        <StatCard label="Monthly Income" value={formatPKR(monthTotals.income)} icon="income" tint="emerald" sub={monthLabel(thisMonth)} />
        <StatCard label="Monthly Expenses" value={formatPKR(monthTotals.expense)} icon="expense" tint="rose" sub={monthLabel(thisMonth)} />
        <StatCard label="Monthly Profit" value={formatPKR(monthTotals.profit)} icon="reports" tint={monthTotals.profit>=0?'emerald':'rose'} />
        <StatCard label="Yearly Profit" value={formatPKR(yearTotals.profit)} icon="reports" tint={yearTotals.profit>=0?'emerald':'rose'} />
        <StatCard label="Pending Fees" value={formatPKR(pendingFeeTotal)} icon="alert" tint="amber" sub="Across active students" />
        <StatCard label="Pending Fines" value={formatPKR(pendingFinesTotal)} icon="alert" tint="amber" sub="Unpaid fines" />
        <StatCard label="Total Students" value={activeStudents.length} icon="students" tint="slate" />
        <StatCard label="Transport Students" value={transportStudents.length} icon="bus" tint="slate" />
        <StatCard label="Total Records" value={data.income.length + data.expenses.length} icon="dashboard" tint="slate" sub="Income + expense entries" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-sm text-slate-700">Income vs Expenses — last 6 months</h3>
          </div>
          <div className="h-72">
            <BarChart labels={monthLabels} series={[{label:'Income', data:incomeSeries, color:'#059669'},{label:'Expenses', data:expenseSeries, color:'#e11d48'}]} />
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-display font-semibold text-sm text-slate-700 mb-4">Expenses by category — {monthLabel(thisMonth)}</h3>
          <div className="h-72">
            {expCatLabels.length ? <DoughnutChart labels={expCatLabels} data={expCatData} colors={PALETTE} /> : <EmptyState icon="expense" title="No expenses this month" />}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-sm text-slate-700">Recent transactions</h3>
          <button onClick={()=>setTab('reports')} className="text-xs font-medium text-brand-600 hover:text-brand-700">View all reports →</button>
        </div>
        {recent.length === 0 ? <EmptyState icon="dashboard" title="No transactions yet" sub="Income and expenses you record will show up here." /> : (
          <div className="divide-y divide-slate-50">
            {recent.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${r.type==='in' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    <Icon name={r.type==='in'?'income':'expense'} className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{r.category}{r.type==='out' && r.vendor ? ' — '+r.vendor : ''}</p>
                    <p className="text-xs text-slate-400">{formatDate(r.date)} · {r.type==='in' ? r.receiptNo : r.voucherNo}</p>
                  </div>
                </div>
                <p className={`text-sm font-semibold shrink-0 ${r.type==='in' ? 'text-emerald-600' : 'text-rose-600'}`}>{r.type==='in'?'+':'-'}{formatPKR(r.amount)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* =========================================================================
   STUDENTS MODULE
   ========================================================================= */
function StudentForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState(initial || {
    admissionNo:'', rollNo:'', name:'', fatherName:'', cnic:'', phone:'', className:CLASS_LIST[3], section:'Boys',
    gender:'Male', address:'', admissionDate: todayStr(), monthlyFee:'', transport:false, transportFee:'',
    scholarshipPercent:'', discount:'', status:'Active',
  });
  const set = (k,v) => setF(prev=>({...prev, [k]:v}));
  const submit = (e) => { e.preventDefault(); if(!f.name || !f.admissionNo) return; onSave(f); };
  return (
    <form onSubmit={submit}>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Admission #" required><input className={inputCls} value={f.admissionNo} onChange={e=>set('admissionNo',e.target.value)} required/></Field>
        <Field label="Roll #"><input className={inputCls} value={f.rollNo} onChange={e=>set('rollNo',e.target.value)} /></Field>
        <Field label="Student Name" required><input className={inputCls} value={f.name} onChange={e=>set('name',e.target.value)} required/></Field>
        <Field label="Father Name"><input className={inputCls} value={f.fatherName} onChange={e=>set('fatherName',e.target.value)} /></Field>
        <Field label="CNIC / B-Form"><input className={inputCls} value={f.cnic} onChange={e=>set('cnic',e.target.value)} /></Field>
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={e=>set('phone',e.target.value)} /></Field>
        <Field label="Class"><select className={inputCls} value={f.className} onChange={e=>set('className',e.target.value)}>{CLASS_LIST.map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Section"><select className={inputCls} value={f.section} onChange={e=>set('section',e.target.value)}>{SECTIONS.map(s=><option key={s}>{s}</option>)}</select></Field>
        <Field label="Gender"><select className={inputCls} value={f.gender} onChange={e=>set('gender',e.target.value)}><option>Male</option><option>Female</option></select></Field>
        <Field label="Admission Date"><input type="date" className={inputCls} value={f.admissionDate} onChange={e=>set('admissionDate',e.target.value)} /></Field>
        <Field label="Monthly Fee (Rs)"><input type="number" min="0" className={inputCls} value={f.monthlyFee} onChange={e=>set('monthlyFee',e.target.value)} /></Field>
        <Field label="Status"><select className={inputCls} value={f.status} onChange={e=>set('status',e.target.value)}><option>Active</option><option>Left</option></select></Field>
        <Field label="Scholarship %"><input type="number" min="0" max="100" className={inputCls} value={f.scholarshipPercent} onChange={e=>set('scholarshipPercent',e.target.value)} /></Field>
        <Field label="Discount (Rs)"><input type="number" min="0" className={inputCls} value={f.discount} onChange={e=>set('discount',e.target.value)} /></Field>
        <Field label="Transport">
          <div className="flex items-center gap-2 h-[38px]">
            <input type="checkbox" checked={f.transport} onChange={e=>set('transport',e.target.checked)} className="w-4 h-4 accent-brand-600" />
            <span className="text-sm text-slate-600">Uses school transport</span>
          </div>
        </Field>
        {f.transport && <Field label="Transport Fee (Rs)"><input type="number" min="0" className={inputCls} value={f.transportFee} onChange={e=>set('transportFee',e.target.value)} /></Field>}
        <div className="sm:col-span-2"><Field label="Address"><textarea className={inputCls} rows="2" value={f.address} onChange={e=>set('address',e.target.value)} /></Field></div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Student</Button>
      </div>
    </form>
  );
}

function StudentProfile({ student, income, onClose, onRecordPayment, caps }) {
  const history = income.filter(i=>i.studentId===student.id).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const pending = studentPendingFee(student, income);
  const paid = history.reduce((s,i)=>s+Number(i.amount||0),0);
  return (
    <Modal title={`Student Profile — ${student.name}`} onClose={onClose} wide>
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        <Card className="p-4"><p className="text-xs text-slate-400 mb-1">Class / Section</p><p className="font-semibold text-sm">{student.className} — {student.section}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-400 mb-1">Total Paid</p><p className="font-semibold text-sm text-emerald-600">{formatPKR(paid)}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-400 mb-1">Pending Fee</p><p className="font-semibold text-sm text-rose-600">{formatPKR(pending)}</p></Card>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm mb-5 text-slate-600">
        <p><span className="text-slate-400">Admission #:</span> {student.admissionNo}</p>
        <p><span className="text-slate-400">Roll #:</span> {student.rollNo || '-'}</p>
        <p><span className="text-slate-400">Father:</span> {student.fatherName || '-'}</p>
        <p><span className="text-slate-400">Phone:</span> {student.phone || '-'}</p>
        <p><span className="text-slate-400">CNIC:</span> {student.cnic || '-'}</p>
        <p><span className="text-slate-400">Admitted:</span> {formatDate(student.admissionDate)}</p>
        <p><span className="text-slate-400">Monthly Fee:</span> {formatPKR(student.monthlyFee)}</p>
        <p><span className="text-slate-400">Transport:</span> {student.transport ? formatPKR(student.transportFee)+'/mo' : 'No'}</p>
        <p><span className="text-slate-400">Status:</span> <Badge tint={student.status==='Active'?'emerald':'slate'}>{student.status}</Badge></p>
      </div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-display font-semibold text-sm text-slate-700">Fee & Payment History</h4>
        {caps.canEdit && <Button onClick={()=>onRecordPayment(student)} className="text-xs py-1.5"><Icon name="plus" className="w-3.5 h-3.5"/>Record Payment</Button>}
      </div>
      <div className="border border-slate-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Receipt</th><th className="text-left px-3 py-2">Category</th><th className="text-right px-3 py-2">Amount</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {history.length===0 && <tr><td colSpan="4" className="text-center py-6 text-slate-400">No payments recorded yet</td></tr>}
            {history.map(h=>(
              <tr key={h.id}><td className="px-3 py-2">{formatDate(h.date)}</td><td className="px-3 py-2">{h.receiptNo}</td><td className="px-3 py-2">{h.category}</td><td className="px-3 py-2 text-right font-medium">{formatPKR(h.amount)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function StudentsModule({ data, addStudent, updateStudent, deleteStudent, openIncomeFormFor, caps }) {
  const [q, setQ] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [sectionFilter, setSectionFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [profileOf, setProfileOf] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const filtered = data.students.filter(s => {
    if (classFilter!=='All' && s.className!==classFilter) return false;
    if (sectionFilter!=='All' && s.section!==sectionFilter) return false;
    if (statusFilter!=='All' && s.status!==statusFilter) return false;
    if (q && !(`${s.name} ${s.admissionNo} ${s.fatherName} ${s.phone}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2 flex-1 min-w-[240px]">
          <div className="w-56"><SearchBox value={q} onChange={setQ} placeholder="Search name, admission#, phone..." /></div>
          <select className={inputCls + " w-auto"} value={classFilter} onChange={e=>setClassFilter(e.target.value)}><option>All</option>{CLASS_LIST.map(c=><option key={c}>{c}</option>)}</select>
          <select className={inputCls + " w-auto"} value={sectionFilter} onChange={e=>setSectionFilter(e.target.value)}><option>All</option>{SECTIONS.map(s=><option key={s}>{s}</option>)}</select>
          <select className={inputCls + " w-auto"} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>All</option><option>Active</option><option>Left</option></select>
        </div>
        {caps.canEdit && <Button onClick={()=>{ setEditing(null); setFormOpen(true); }}><Icon name="plus" className="w-4 h-4"/>Add Student</Button>}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Adm#</th><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Class</th>
                <th className="text-left px-4 py-3">Section</th><th className="text-left px-4 py-3">Phone</th><th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Pending Fee</th><th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length===0 && <tr><td colSpan="8"><EmptyState icon="students" title="No students found" sub="Try adjusting filters or add a new student." /></td></tr>}
              {filtered.map(s=>{
                const pending = studentPendingFee(s, data.income);
                return (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-500">{s.admissionNo}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      <button className="hover:text-brand-600" onClick={()=>setProfileOf(s)}>{s.name}</button>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s.className}</td>
                    <td className="px-4 py-3 text-slate-500">{s.section}</td>
                    <td className="px-4 py-3 text-slate-500">{s.phone||'-'}</td>
                    <td className="px-4 py-3"><Badge tint={s.status==='Active'?'emerald':'slate'}>{s.status}</Badge></td>
                    <td className="px-4 py-3 text-right font-medium">{pending>0 ? <span className="text-rose-600">{formatPKR(pending)}</span> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button title="View" onClick={()=>setProfileOf(s)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="eye" className="w-4 h-4"/></button>
                        {caps.canEdit && <button title="Edit" onClick={()=>{ setEditing(s); setFormOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="edit" className="w-4 h-4"/></button>}
                        {caps.canDelete && <button title="Delete" onClick={()=>setToDelete(s)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="w-4 h-4"/></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {formOpen && (
        <Modal title={editing ? 'Edit Student' : 'Add Student'} onClose={()=>setFormOpen(false)} wide>
          <StudentForm initial={editing} onCancel={()=>setFormOpen(false)} onSave={(f)=>{ editing ? updateStudent(editing.id, f) : addStudent(f); setFormOpen(false); }} />
        </Modal>
      )}
      {profileOf && <StudentProfile student={profileOf} income={data.income} onClose={()=>setProfileOf(null)} onRecordPayment={(s)=>{ setProfileOf(null); openIncomeFormFor(s); }} caps={caps} />}
      {toDelete && <ConfirmDialog text={`Delete student "${toDelete.name}"? This cannot be undone.`} onCancel={()=>setToDelete(null)} onConfirm={()=>{ deleteStudent(toDelete.id); setToDelete(null); }} />}
    </div>
  );
}

/* =========================================================================
   INCOME MODULE
   ========================================================================= */
function IncomeForm({ initial, students, categories, methods, onSave, onCancel }) {
  const [f, setF] = useState(initial || {
    date: todayStr(), studentId:'', category: categories[0], amount:'', paymentMethod: methods[0], receivedBy:'', remarks:'', forMonth: todayStr().slice(0,7),
  });
  const set = (k,v) => setF(prev=>({...prev,[k]:v}));
  const needsMonth = f.category === 'Student Monthly Fee' || f.category === 'Transport Fee';
  const submit = (e) => { e.preventDefault(); if(!f.amount || !f.category) return; onSave(f); };
  return (
    <form onSubmit={submit}>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Date" required><input type="date" className={inputCls} value={f.date} onChange={e=>set('date',e.target.value)} required/></Field>
        <Field label="Category" required>
          <select className={inputCls} value={f.category} onChange={e=>set('category',e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select>
        </Field>
        <Field label="Student (optional)">
          <select className={inputCls} value={f.studentId} onChange={e=>set('studentId',e.target.value)}>
            <option value="">— Not linked to a student —</option>
            {students.map(s=><option key={s.id} value={s.id}>{s.name} ({s.admissionNo})</option>)}
          </select>
        </Field>
        {needsMonth && <Field label="For Month"><input type="month" className={inputCls} value={f.forMonth} onChange={e=>set('forMonth',e.target.value)} /></Field>}
        <Field label="Amount (Rs)" required><input type="number" min="0" className={inputCls} value={f.amount} onChange={e=>set('amount',e.target.value)} required/></Field>
        <Field label="Payment Method"><select className={inputCls} value={f.paymentMethod} onChange={e=>set('paymentMethod',e.target.value)}>{methods.map(m=><option key={m}>{m}</option>)}</select></Field>
        <Field label="Received By"><input className={inputCls} value={f.receivedBy} onChange={e=>set('receivedBy',e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Remarks"><textarea className={inputCls} rows="2" value={f.remarks} onChange={e=>set('remarks',e.target.value)} /></Field></div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Income</Button>
      </div>
    </form>
  );
}

function ReceiptView({ entry, settings, student }) {
  return (
    <div id="print-section" className="text-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3 mb-3">
        {settings.logo && <img src={settings.logo} className="w-12 h-12 rounded object-cover" />}
        <div>
          <p className="font-display font-bold text-base">{settings.schoolName}</p>
          <p className="text-xs text-slate-500">{settings.address} {settings.phone ? ' · '+settings.phone : ''}</p>
        </div>
      </div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-display font-semibold">Fee / Income Receipt</h3>
        <p className="text-slate-500">No: <span className="font-semibold text-ink">{entry.receiptNo}</span></p>
      </div>
      <div className="grid grid-cols-2 gap-y-1.5 mb-3">
        <p className="text-slate-500">Date</p><p className="text-right font-medium">{formatDate(entry.date)}</p>
        {student && <><p className="text-slate-500">Student</p><p className="text-right font-medium">{student.name} (Adm# {student.admissionNo})</p></>}
        {student && <><p className="text-slate-500">Class</p><p className="text-right font-medium">{student.className} — {student.section}</p></>}
        <p className="text-slate-500">Category</p><p className="text-right font-medium">{entry.category}</p>
        {entry.forMonth && <><p className="text-slate-500">For Month</p><p className="text-right font-medium">{monthLabel(entry.forMonth)}</p></>}
        <p className="text-slate-500">Payment Method</p><p className="text-right font-medium">{entry.paymentMethod}</p>
        <p className="text-slate-500">Received By</p><p className="text-right font-medium">{entry.receivedBy || '-'}</p>
      </div>
      <div className="border-t border-b border-dashed border-slate-300 py-3 flex justify-between items-center mb-3">
        <span className="font-medium">Amount</span><span className="font-display font-bold text-lg">{formatPKR(entry.amount)}</span>
      </div>
      {entry.remarks && <p className="text-slate-500 text-xs mb-3">Remarks: {entry.remarks}</p>}
      <p className="text-[11px] text-slate-400 mt-6">This is a computer-generated receipt.</p>
    </div>
  );
}

function IncomeModule({ data, addIncome, updateIncome, deleteIncome, prefillFor, clearPrefill, caps }) {
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [printing, setPrinting] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => { if (prefillFor) { setEditing(null); setFormOpen(true); } }, [prefillFor]);

  const filtered = data.income.filter(i => {
    if (catFilter!=='All' && i.category!==catFilter) return false;
    if (q) {
      const student = data.students.find(s=>s.id===i.studentId);
      const hay = `${i.receiptNo} ${i.category} ${i.remarks} ${student?student.name:''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  }).sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const total = filtered.reduce((s,i)=>s+Number(i.amount||0),0);

  const studentPrefill = prefillFor ? { date: todayStr(), studentId: prefillFor.id, category:'Student Monthly Fee', amount:'', paymentMethod: data.settings.paymentMethods[0], receivedBy:'', remarks:'', forMonth: todayStr().slice(0,7) } : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2 flex-1 min-w-[240px]">
          <div className="w-56"><SearchBox value={q} onChange={setQ} placeholder="Search receipt, category, student..." /></div>
          <select className={inputCls + " w-auto"} value={catFilter} onChange={e=>setCatFilter(e.target.value)}><option>All</option>{data.settings.incomeCategories.map(c=><option key={c}>{c}</option>)}</select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">Total: <span className="font-semibold text-emerald-600">{formatPKR(total)}</span></span>
          {caps.canEdit && <Button onClick={()=>{ setEditing(null); setFormOpen(true); }}><Icon name="plus" className="w-4 h-4"/>Add Income</Button>}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr><th className="text-left px-4 py-3">Receipt#</th><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Student</th><th className="text-left px-4 py-3">Category</th><th className="text-left px-4 py-3">Method</th><th className="text-right px-4 py-3">Amount</th><th className="text-right px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length===0 && <tr><td colSpan="7"><EmptyState icon="income" title="No income entries" sub="Record fees, donations, and other income here." /></td></tr>}
              {filtered.map(i=>{
                const student = data.students.find(s=>s.id===i.studentId);
                return (
                  <tr key={i.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-500">{i.receiptNo}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(i.date)}</td>
                    <td className="px-4 py-3 text-slate-600">{student ? student.name : '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{i.category}</td>
                    <td className="px-4 py-3 text-slate-500">{i.paymentMethod}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatPKR(i.amount)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button title="Print receipt" onClick={()=>setPrinting(i)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="print" className="w-4 h-4"/></button>
                        {caps.canEdit && <button title="Edit" onClick={()=>{ setEditing(i); setFormOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="edit" className="w-4 h-4"/></button>}
                        {caps.canDelete && <button title="Delete" onClick={()=>setToDelete(i)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="w-4 h-4"/></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {formOpen && (
        <Modal title={editing ? 'Edit Income' : 'Add Income'} onClose={()=>{ setFormOpen(false); clearPrefill(); }} wide>
          <IncomeForm initial={editing || studentPrefill} students={data.students.filter(s=>s.status==='Active')} categories={data.settings.incomeCategories} methods={data.settings.paymentMethods}
            onCancel={()=>{ setFormOpen(false); clearPrefill(); }}
            onSave={(f)=>{ editing ? updateIncome(editing.id, f) : addIncome(f); setFormOpen(false); clearPrefill(); }} />
        </Modal>
      )}

      {printing && (
        <Modal title="Receipt" onClose={()=>setPrinting(null)}>
          <ReceiptView entry={printing} settings={data.settings} student={data.students.find(s=>s.id===printing.studentId)} />
          <div className="flex justify-end gap-2 mt-4 no-print">
            <Button variant="secondary" onClick={()=>setPrinting(null)}>Close</Button>
            <Button onClick={()=>window.print()}><Icon name="print" className="w-4 h-4"/>Print</Button>
          </div>
        </Modal>
      )}
      {toDelete && <ConfirmDialog text={`Delete this income entry (${toDelete.receiptNo})?`} onCancel={()=>setToDelete(null)} onConfirm={()=>{ deleteIncome(toDelete.id); setToDelete(null); }} />}
    </div>
  );
}

/* =========================================================================
   EXPENSES MODULE
   ========================================================================= */
const VEHICLE_LINKED_CATEGORIES = ['Transport Fuel','Vehicle Repair','Generator Fuel'];

function ExpenseForm({ initial, categories, methods, vehicles, onSave, onCancel }) {
  const [f, setF] = useState(initial || { date: todayStr(), vendor:'', category: categories[0], amount:'', paymentMethod: methods[0], paidBy:'', remarks:'', vehicleId:'' });
  const set = (k,v) => setF(prev=>({...prev,[k]:v}));
  const showVehicle = VEHICLE_LINKED_CATEGORIES.includes(f.category) && vehicles && vehicles.length > 0;
  const submit = (e) => { e.preventDefault(); if(!f.amount || !f.category) return; onSave(f); };
  return (
    <form onSubmit={submit}>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Date" required><input type="date" className={inputCls} value={f.date} onChange={e=>set('date',e.target.value)} required/></Field>
        <Field label="Category" required><select className={inputCls} value={f.category} onChange={e=>set('category',e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Vendor / Payee"><input className={inputCls} value={f.vendor} onChange={e=>set('vendor',e.target.value)} /></Field>
        <Field label="Amount (Rs)" required><input type="number" min="0" className={inputCls} value={f.amount} onChange={e=>set('amount',e.target.value)} required/></Field>
        <Field label="Payment Method"><select className={inputCls} value={f.paymentMethod} onChange={e=>set('paymentMethod',e.target.value)}>{methods.map(m=><option key={m}>{m}</option>)}</select></Field>
        <Field label="Paid By"><input className={inputCls} value={f.paidBy} onChange={e=>set('paidBy',e.target.value)} /></Field>
        {showVehicle && (
          <Field label="Vehicle (optional)">
            <select className={inputCls} value={f.vehicleId} onChange={e=>set('vehicleId',e.target.value)}>
              <option value="">— Not linked to a vehicle —</option>
              {vehicles.map(v=><option key={v.id} value={v.id}>{v.vehicleNo} ({v.type})</option>)}
            </select>
          </Field>
        )}
        <div className="sm:col-span-2"><Field label="Remarks"><textarea className={inputCls} rows="2" value={f.remarks} onChange={e=>set('remarks',e.target.value)} /></Field></div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Expense</Button>
      </div>
    </form>
  );
}

function VoucherView({ entry, settings }) {
  return (
    <div id="print-section" className="text-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3 mb-3">
        {settings.logo && <img src={settings.logo} className="w-12 h-12 rounded object-cover" />}
        <div>
          <p className="font-display font-bold text-base">{settings.schoolName}</p>
          <p className="text-xs text-slate-500">{settings.address} {settings.phone ? ' · '+settings.phone : ''}</p>
        </div>
      </div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-display font-semibold">Expense Voucher</h3>
        <p className="text-slate-500">No: <span className="font-semibold text-ink">{entry.voucherNo}</span></p>
      </div>
      <div className="grid grid-cols-2 gap-y-1.5 mb-3">
        <p className="text-slate-500">Date</p><p className="text-right font-medium">{formatDate(entry.date)}</p>
        <p className="text-slate-500">Vendor / Payee</p><p className="text-right font-medium">{entry.vendor || '-'}</p>
        <p className="text-slate-500">Category</p><p className="text-right font-medium">{entry.category}</p>
        <p className="text-slate-500">Payment Method</p><p className="text-right font-medium">{entry.paymentMethod}</p>
        <p className="text-slate-500">Paid By</p><p className="text-right font-medium">{entry.paidBy || '-'}</p>
      </div>
      <div className="border-t border-b border-dashed border-slate-300 py-3 flex justify-between items-center mb-3">
        <span className="font-medium">Amount</span><span className="font-display font-bold text-lg">{formatPKR(entry.amount)}</span>
      </div>
      {entry.remarks && <p className="text-slate-500 text-xs mb-3">Remarks: {entry.remarks}</p>}
      <p className="text-[11px] text-slate-400 mt-6">This is a computer-generated voucher.</p>
    </div>
  );
}

function ExpensesModule({ data, addExpense, updateExpense, deleteExpense, caps }) {
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [printing, setPrinting] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const filtered = data.expenses.filter(e => {
    if (catFilter!=='All' && e.category!==catFilter) return false;
    if (q && !(`${e.voucherNo} ${e.category} ${e.vendor} ${e.remarks}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  }).sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const total = filtered.reduce((s,e)=>s+Number(e.amount||0),0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2 flex-1 min-w-[240px]">
          <div className="w-56"><SearchBox value={q} onChange={setQ} placeholder="Search voucher, vendor, category..." /></div>
          <select className={inputCls + " w-auto"} value={catFilter} onChange={e=>setCatFilter(e.target.value)}><option>All</option>{data.settings.expenseCategories.map(c=><option key={c}>{c}</option>)}</select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">Total: <span className="font-semibold text-rose-600">{formatPKR(total)}</span></span>
          {caps.canEdit && <Button onClick={()=>{ setEditing(null); setFormOpen(true); }}><Icon name="plus" className="w-4 h-4"/>Add Expense</Button>}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr><th className="text-left px-4 py-3">Voucher#</th><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Vendor</th><th className="text-left px-4 py-3">Category</th><th className="text-left px-4 py-3">Method</th><th className="text-right px-4 py-3">Amount</th><th className="text-right px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length===0 && <tr><td colSpan="7"><EmptyState icon="expense" title="No expenses recorded" sub="Track salaries, bills, and purchases here." /></td></tr>}
              {filtered.map(e=>(
                <tr key={e.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-slate-500">{e.voucherNo}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(e.date)}</td>
                  <td className="px-4 py-3 text-slate-600">{e.vendor||'-'}</td>
                  <td className="px-4 py-3 text-slate-600">{e.category}</td>
                  <td className="px-4 py-3 text-slate-500">{e.paymentMethod}</td>
                  <td className="px-4 py-3 text-right font-medium text-rose-600">{formatPKR(e.amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button title="Print voucher" onClick={()=>setPrinting(e)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="print" className="w-4 h-4"/></button>
                      {caps.canEdit && <button title="Edit" onClick={()=>{ setEditing(e); setFormOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="edit" className="w-4 h-4"/></button>}
                      {caps.canDelete && <button title="Delete" onClick={()=>setToDelete(e)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="w-4 h-4"/></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {formOpen && (
        <Modal title={editing ? 'Edit Expense' : 'Add Expense'} onClose={()=>setFormOpen(false)} wide>
          <ExpenseForm initial={editing} categories={data.settings.expenseCategories} methods={data.settings.paymentMethods} vehicles={data.vehicles}
            onCancel={()=>setFormOpen(false)} onSave={(f)=>{ editing ? updateExpense(editing.id, f) : addExpense(f); setFormOpen(false); }} />
        </Modal>
      )}
      {printing && (
        <Modal title="Voucher" onClose={()=>setPrinting(null)}>
          <VoucherView entry={printing} settings={data.settings} />
          <div className="flex justify-end gap-2 mt-4 no-print">
            <Button variant="secondary" onClick={()=>setPrinting(null)}>Close</Button>
            <Button onClick={()=>window.print()}><Icon name="print" className="w-4 h-4"/>Print</Button>
          </div>
        </Modal>
      )}
      {toDelete && <ConfirmDialog text={`Delete this expense entry (${toDelete.voucherNo})?`} onCancel={()=>setToDelete(null)} onConfirm={()=>{ deleteExpense(toDelete.id); setToDelete(null); }} />}
    </div>
  );
}

/* =========================================================================
   REPORTS MODULE
   ========================================================================= */
const REPORT_TABS = ['Daily','Monthly','Yearly','Custom Range','Income by Category','Expense by Category','Profit & Loss','Cash Flow','Pending Fees'];

function ReportsModule({ data }) {
  const [tab, setTab] = useState('Daily');
  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(todayStr().slice(0,7));
  const [year, setYear] = useState(todayStr().slice(0,4));
  const [from, setFrom] = useState(todayStr().slice(0,8)+'01');
  const [to, setTo] = useState(todayStr());

  let rangeFrom = date, rangeTo = date;
  if (tab==='Monthly') { rangeFrom = month+'-01'; rangeTo = month+'-31'; }
  if (tab==='Yearly') { rangeFrom = year+'-01-01'; rangeTo = year+'-12-31'; }
  if (tab==='Custom Range') { rangeFrom = from; rangeTo = to; }

  const incomeRows = data.income.filter(i => i.date>=rangeFrom && i.date<=rangeTo);
  const expenseRows = data.expenses.filter(e => e.date>=rangeFrom && e.date<=rangeTo);
  const incTotal = incomeRows.reduce((s,i)=>s+Number(i.amount||0),0);
  const expTotal = expenseRows.reduce((s,e)=>s+Number(e.amount||0),0);

  const catTotals = (rows, key) => {
    const m = {};
    rows.forEach(r => { m[r.category] = (m[r.category]||0) + Number(r.amount||0); });
    return Object.entries(m).sort((a,b)=>b[1]-a[1]);
  };

  const showTransactionTable = ['Daily','Monthly','Yearly','Custom Range'].includes(tab);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {REPORT_TABS.map(t => (
          <button key={t} onClick={()=>setTab(t)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab===t ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{t}</button>
        ))}
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3 mb-5">
          {tab==='Daily' && <Field label="Date"><input type="date" className={inputCls} value={date} onChange={e=>setDate(e.target.value)} /></Field>}
          {tab==='Monthly' && <Field label="Month"><input type="month" className={inputCls} value={month} onChange={e=>setMonth(e.target.value)} /></Field>}
          {tab==='Yearly' && <Field label="Year"><input type="number" className={inputCls} value={year} onChange={e=>setYear(e.target.value)} /></Field>}
          {tab==='Custom Range' && <>
            <Field label="From"><input type="date" className={inputCls} value={from} onChange={e=>setFrom(e.target.value)} /></Field>
            <Field label="To"><input type="date" className={inputCls} value={to} onChange={e=>setTo(e.target.value)} /></Field>
          </>}
        </div>

        {tab !== 'Pending Fees' && (
          <div className="grid sm:grid-cols-3 gap-3 mb-5">
            <Card className="p-4 bg-emerald-50/50 border-emerald-100"><p className="text-xs text-slate-500">Total Income</p><p className="font-display font-bold text-lg text-emerald-700">{formatPKR(incTotal)}</p></Card>
            <Card className="p-4 bg-rose-50/50 border-rose-100"><p className="text-xs text-slate-500">Total Expenses</p><p className="font-display font-bold text-lg text-rose-700">{formatPKR(expTotal)}</p></Card>
            <Card className={`p-4 ${incTotal-expTotal>=0 ? 'bg-brand-50/50 border-brand-100' : 'bg-amber-50/50 border-amber-100'}`}><p className="text-xs text-slate-500">Net</p><p className={`font-display font-bold text-lg ${incTotal-expTotal>=0 ? 'text-brand-700':'text-amber-700'}`}>{formatPKR(incTotal-expTotal)}</p></Card>
          </div>
        )}

        {showTransactionTable && (
          <>
            <div className="flex justify-end mb-2">
              <Button variant="secondary" onClick={()=>exportCSV(`report_${tab.replace(/\s+/g,'_')}.csv`, ['Type','Date','Ref#','Category/Vendor','Method','Amount'],
                [...incomeRows.map(i=>['Income', i.date, i.receiptNo, i.category, i.paymentMethod, i.amount]),
                 ...expenseRows.map(e=>['Expense', e.date, e.voucherNo, e.category+(e.vendor?' - '+e.vendor:''), e.paymentMethod, -e.amount])])}>
                <Icon name="download" className="w-4 h-4"/>Export CSV
              </Button>
            </div>
            <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Ref#</th><th className="text-left px-3 py-2">Type</th><th className="text-left px-3 py-2">Category</th><th className="text-right px-3 py-2">Amount</th></tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {(incomeRows.length + expenseRows.length)===0 && <tr><td colSpan="5" className="text-center py-8 text-slate-400">No transactions in this period</td></tr>}
                  {[...incomeRows.map(i=>({...i,type:'Income'})), ...expenseRows.map(e=>({...e,type:'Expense'}))].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(r=>(
                    <tr key={r.id}><td className="px-3 py-2">{formatDate(r.date)}</td><td className="px-3 py-2">{r.type==='Income'?r.receiptNo:r.voucherNo}</td>
                      <td className="px-3 py-2"><Badge tint={r.type==='Income'?'emerald':'rose'}>{r.type}</Badge></td><td className="px-3 py-2">{r.category}</td>
                      <td className={`px-3 py-2 text-right font-medium ${r.type==='Income'?'text-emerald-600':'text-rose-600'}`}>{r.type==='Income'?'+':'-'}{formatPKR(r.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab==='Income by Category' && (
          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-3 py-2">Category</th><th className="text-right px-3 py-2">Amount</th></tr></thead>
              <tbody className="divide-y divide-slate-50">{catTotals(data.income).map(([c,a])=><tr key={c}><td className="px-3 py-2">{c}</td><td className="px-3 py-2 text-right font-medium text-emerald-600">{formatPKR(a)}</td></tr>)}</tbody></table>
          </div>
        )}
        {tab==='Expense by Category' && (
          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-3 py-2">Category</th><th className="text-right px-3 py-2">Amount</th></tr></thead>
              <tbody className="divide-y divide-slate-50">{catTotals(data.expenses).map(([c,a])=><tr key={c}><td className="px-3 py-2">{c}</td><td className="px-3 py-2 text-right font-medium text-rose-600">{formatPKR(a)}</td></tr>)}</tbody></table>
          </div>
        )}
        {tab==='Profit & Loss' && (() => {
          const allIncCat = catTotals(data.income), allExpCat = catTotals(data.expenses);
          const totalInc = allIncCat.reduce((s,[,a])=>s+a,0), totalExp = allExpCat.reduce((s,[,a])=>s+a,0);
          return (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-sm text-slate-600 mb-2">Income</h4>
                {allIncCat.map(([c,a])=><div key={c} className="flex justify-between py-1 text-sm border-b border-slate-50"><span className="text-slate-500">{c}</span><span className="font-medium">{formatPKR(a)}</span></div>)}
                <div className="flex justify-between py-2 font-semibold text-emerald-700">Total<span>{formatPKR(totalInc)}</span></div>
              </div>
              <div>
                <h4 className="font-semibold text-sm text-slate-600 mb-2">Expenses</h4>
                {allExpCat.map(([c,a])=><div key={c} className="flex justify-between py-1 text-sm border-b border-slate-50"><span className="text-slate-500">{c}</span><span className="font-medium">{formatPKR(a)}</span></div>)}
                <div className="flex justify-between py-2 font-semibold text-rose-700">Total<span>{formatPKR(totalExp)}</span></div>
              </div>
              <div className="sm:col-span-2 border-t border-slate-200 pt-3 flex justify-between font-display font-bold text-base">
                <span>Net Profit / Loss (all-time)</span><span className={totalInc-totalExp>=0?'text-emerald-700':'text-rose-700'}>{formatPKR(totalInc-totalExp)}</span>
              </div>
            </div>
          );
        })()}
        {tab==='Cash Flow' && (() => {
          const cashIn = data.income.filter(i=>i.paymentMethod==='Cash').reduce((s,i)=>s+Number(i.amount||0),0);
          const cashOut = data.expenses.filter(e=>e.paymentMethod==='Cash').reduce((s,e)=>s+Number(e.amount||0),0);
          const bankIn = data.income.filter(i=>i.paymentMethod!=='Cash').reduce((s,i)=>s+Number(i.amount||0),0);
          const bankOut = data.expenses.filter(e=>e.paymentMethod!=='Cash').reduce((s,e)=>s+Number(e.amount||0),0);
          return (
            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="p-4">
                <h4 className="font-semibold text-sm text-slate-600 mb-3 flex items-center gap-2"><Icon name="wallet" className="w-4 h-4"/>Cash</h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Opening Balance</span><span>{formatPKR(data.settings.openingCash)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">+ Cash Income</span><span className="text-emerald-600">{formatPKR(cashIn)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">- Cash Expenses</span><span className="text-rose-600">{formatPKR(cashOut)}</span></div>
                  <div className="flex justify-between font-semibold border-t border-slate-100 pt-1.5">Closing Balance<span>{formatPKR(Number(data.settings.openingCash)+cashIn-cashOut)}</span></div>
                </div>
              </Card>
              <Card className="p-4">
                <h4 className="font-semibold text-sm text-slate-600 mb-3 flex items-center gap-2"><Icon name="bank" className="w-4 h-4"/>Bank</h4>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Opening Balance</span><span>{formatPKR(data.settings.openingBank)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">+ Bank Income</span><span className="text-emerald-600">{formatPKR(bankIn)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">- Bank Expenses</span><span className="text-rose-600">{formatPKR(bankOut)}</span></div>
                  <div className="flex justify-between font-semibold border-t border-slate-100 pt-1.5">Closing Balance<span>{formatPKR(Number(data.settings.openingBank)+bankIn-bankOut)}</span></div>
                </div>
              </Card>
            </div>
          );
        })()}
        {tab==='Pending Fees' && (() => {
          const rows = data.students.filter(s=>s.status==='Active').map(s=>({s, pending: studentPendingFee(s, data.income)})).filter(r=>r.pending>0).sort((a,b)=>b.pending-a.pending);
          const totalPending = rows.reduce((s,r)=>s+r.pending,0);
          return (
            <>
              <Card className="p-4 bg-amber-50/50 border-amber-100 mb-4 max-w-xs"><p className="text-xs text-slate-500">Total Pending Fees</p><p className="font-display font-bold text-lg text-amber-700">{formatPKR(totalPending)}</p></Card>
              <div className="flex justify-end mb-2"><Button variant="secondary" onClick={()=>exportCSV('pending_fees.csv', ['Admission#','Name','Class','Section','Phone','Pending'], rows.map(r=>[r.s.admissionNo,r.s.name,r.s.className,r.s.section,r.s.phone,r.pending]))}><Icon name="download" className="w-4 h-4"/>Export CSV</Button></div>
              <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
                <table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-3 py-2">Adm#</th><th className="text-left px-3 py-2">Name</th><th className="text-left px-3 py-2">Class</th><th className="text-left px-3 py-2">Phone</th><th className="text-right px-3 py-2">Pending</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.length===0 && <tr><td colSpan="5" className="text-center py-8 text-slate-400">No pending fees 🎉</td></tr>}
                    {rows.map(r=><tr key={r.s.id}><td className="px-3 py-2">{r.s.admissionNo}</td><td className="px-3 py-2 font-medium">{r.s.name}</td><td className="px-3 py-2">{r.s.className} — {r.s.section}</td><td className="px-3 py-2">{r.s.phone||'-'}</td><td className="px-3 py-2 text-right font-semibold text-rose-600">{formatPKR(r.pending)}</td></tr>)}
                  </tbody></table>
              </div>
            </>
          );
        })()}
      </Card>
    </div>
  );
}

/* =========================================================================
   SETTINGS MODULE
   ========================================================================= */
function CategoryEditor({ label, list, onChange }) {
  const [newCat, setNewCat] = useState('');
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5 mb-2 max-h-40 overflow-y-auto scrollbar-thin p-2 border border-slate-100 rounded-lg bg-slate-50/50">
        {list.map(c => (
          <span key={c} className="inline-flex items-center gap-1 bg-white border border-slate-200 rounded-full pl-2.5 pr-1 py-0.5 text-xs text-slate-600">
            {c}
            <button onClick={()=>onChange(list.filter(x=>x!==c))} className="w-4 h-4 rounded-full hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center"><Icon name="close" className="w-2.5 h-2.5"/></button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input className={inputCls} placeholder="Add category..." value={newCat} onChange={e=>setNewCat(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter' && newCat.trim()){ onChange([...list,newCat.trim()]); setNewCat(''); } }} />
        <Button variant="secondary" onClick={()=>{ if(newCat.trim()){ onChange([...list,newCat.trim()]); setNewCat(''); } }}>Add</Button>
      </div>
    </div>
  );
}

function SettingsModule({ data, updateSettings, importData, resetData, caps, currentUser, onAddUser, onUpdateUser, onDeleteUser }) {
  const s = data.settings;
  const set = (k,v) => updateSettings({ [k]: v });
  const [confirmReset, setConfirmReset] = useState(false);
  const [status, setStatus] = useState('');

  const handleLogo = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set('logo', reader.result);
    reader.readAsDataURL(file);
  };

  const handleExport = async () => {
    const result = await window.electronAPI.exportBackup(JSON.stringify(data, null, 2));
    setStatus(result.ok ? `Backup saved to ${result.filePath}` : '');
    if (result.ok) setTimeout(()=>setStatus(''), 5000);
  };

  const handleImport = async () => {
    const result = await window.electronAPI.importBackup();
    if (!result.ok) return;
    try {
      const parsed = JSON.parse(result.content);
      importData(parsed);
      setStatus('Backup restored successfully.');
      setTimeout(()=>setStatus(''), 5000);
    } catch (err) {
      setStatus('Could not read that file — please select a valid backup JSON exported from this app.');
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="font-display font-semibold text-sm text-slate-700 mb-4">School Information</h3>
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="School Name"><input className={inputCls} value={s.schoolName} onChange={e=>set('schoolName',e.target.value)} /></Field>
          <Field label="Tagline"><input className={inputCls} value={s.tagline} onChange={e=>set('tagline',e.target.value)} /></Field>
          <Field label="Address"><input className={inputCls} value={s.address} onChange={e=>set('address',e.target.value)} /></Field>
          <Field label="Phone"><input className={inputCls} value={s.phone} onChange={e=>set('phone',e.target.value)} /></Field>
          <Field label="Session"><input className={inputCls} value={s.session} onChange={e=>set('session',e.target.value)} /></Field>
          <Field label="Logo">
            <div className="flex items-center gap-3">
              {s.logo && <img src={s.logo} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />}
              <input type="file" accept="image/*" onChange={handleLogo} className="text-xs" />
            </div>
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-display font-semibold text-sm text-slate-700 mb-4">Numbering & Opening Balances</h3>
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Receipt Prefix"><input className={inputCls} value={s.receiptPrefix} onChange={e=>set('receiptPrefix',e.target.value)} /></Field>
          <Field label="Voucher Prefix"><input className={inputCls} value={s.voucherPrefix} onChange={e=>set('voucherPrefix',e.target.value)} /></Field>
          <Field label="Next Receipt Number"><input type="number" className={inputCls} value={s.nextReceiptNo} onChange={e=>set('nextReceiptNo', Number(e.target.value))} /></Field>
          <Field label="Next Voucher Number"><input type="number" className={inputCls} value={s.nextVoucherNo} onChange={e=>set('nextVoucherNo', Number(e.target.value))} /></Field>
          <Field label="Opening Cash Balance (Rs)"><input type="number" className={inputCls} value={s.openingCash} onChange={e=>set('openingCash', Number(e.target.value))} /></Field>
          <Field label="Opening Bank Balance (Rs)"><input type="number" className={inputCls} value={s.openingBank} onChange={e=>set('openingBank', Number(e.target.value))} /></Field>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-display font-semibold text-sm text-slate-700 mb-4">Categories & Payment Methods</h3>
        <div className="grid sm:grid-cols-2 gap-5">
          <CategoryEditor label="Income Categories" list={s.incomeCategories} onChange={(l)=>set('incomeCategories',l)} />
          <CategoryEditor label="Expense Categories" list={s.expenseCategories} onChange={(l)=>set('expenseCategories',l)} />
        </div>
        <div className="mt-5"><CategoryEditor label="Payment Methods" list={s.paymentMethods} onChange={(l)=>set('paymentMethods',l)} /></div>
      </Card>

      <Card className="p-5">
        <h3 className="font-display font-semibold text-sm text-slate-700 mb-4">Appearance</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={!!s.darkMode} onChange={e=>set('darkMode', e.target.checked)} className="w-4 h-4 accent-brand-600" />
          <span className="text-sm text-slate-600">Use dark mode</span>
        </label>
      </Card>

      {caps.canManageUsers && (
        <UsersSection users={data.users} currentUser={currentUser} onAddUser={onAddUser} onUpdateUser={onUpdateUser} onDeleteUser={onDeleteUser} />
      )}

      <Card className="p-5">
        <h3 className="font-display font-semibold text-sm text-slate-700 mb-2">Backup & Restore</h3>
        <p className="text-xs text-slate-400 mb-4">Your data is stored only on this computer, in a local data file. Export a backup regularly and keep a copy somewhere safe (a USB drive or cloud folder) — uninstalling the app or a disk failure will erase everything unless you have a backup.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleExport}><Icon name="download" className="w-4 h-4"/>Export Backup (JSON)</Button>
          <Button variant="secondary" onClick={handleImport}><Icon name="upload" className="w-4 h-4"/>Import Backup</Button>
          <Button variant="danger" onClick={()=>setConfirmReset(true)}><Icon name="refresh" className="w-4 h-4"/>Reset All Data</Button>
        </div>
        {status && <p className="text-xs text-brand-600 mt-3">{status}</p>}
      </Card>

      {confirmReset && <ConfirmDialog text="This will permanently erase all students, income, expense, salary, and transport records on this computer. Export a backup first if you're not sure. Continue?" onCancel={()=>setConfirmReset(false)} onConfirm={()=>{ resetData(); setConfirmReset(false); }} />}
    </div>
  );
}

/* =========================================================================
   USERS & PERMISSIONS (embedded in Settings)
   ========================================================================= */
function UserForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState(initial ? { ...initial, password:'', confirm:'' } : { username:'', fullName:'', role: USER_ROLES[3], status:'Active', password:'', confirm:'' });
  const [error, setError] = useState('');
  const set = (k,v) => setF(prev=>({...prev,[k]:v}));
  const isNew = !initial;
  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (!f.username.trim()) { setError('Username is required.'); return; }
    if (isNew && !f.password) { setError('Password is required for a new user.'); return; }
    if (f.password && f.password !== f.confirm) { setError('Passwords do not match.'); return; }
    if (f.password && f.password.length < 6) { setError('Password should be at least 6 characters.'); return; }
    onSave(f);
  };
  return (
    <form onSubmit={submit}>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Username" required><input className={inputCls} value={f.username} onChange={e=>set('username',e.target.value)} disabled={!isNew} required/></Field>
        <Field label="Full Name"><input className={inputCls} value={f.fullName} onChange={e=>set('fullName',e.target.value)} /></Field>
        <Field label="Role"><select className={inputCls} value={f.role} onChange={e=>set('role',e.target.value)}>{USER_ROLES.map(r=><option key={r}>{r}</option>)}</select></Field>
        <Field label="Status"><select className={inputCls} value={f.status} onChange={e=>set('status',e.target.value)}><option>Active</option><option>Disabled</option></select></Field>
        <Field label={isNew ? "Password" : "New Password (leave blank to keep current)"}><input type="password" className={inputCls} value={f.password} onChange={e=>set('password',e.target.value)} /></Field>
        <Field label="Confirm Password"><input type="password" className={inputCls} value={f.confirm} onChange={e=>set('confirm',e.target.value)} /></Field>
      </div>
      <p className="text-xs text-slate-400 -mt-2 mb-3">
        Admin/Principal: full access. Accountant: add/edit/delete financial records. Data Entry Operator: add/edit only. Read-only User: view only. Only Admin can manage users.
      </p>
      {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{isNew ? 'Create User' : 'Save Changes'}</Button>
      </div>
    </form>
  );
}

function UsersSection({ users, currentUser, onAddUser, onUpdateUser, onDeleteUser }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-sm text-slate-700">Users & Permissions</h3>
          <p className="text-xs text-slate-400 mt-0.5">Control who can log in and what they can do.</p>
        </div>
        <Button onClick={()=>{ setEditing(null); setFormOpen(true); }}><Icon name="plus" className="w-4 h-4"/>Add User</Button>
      </div>
      <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-3 py-2">Username</th><th className="text-left px-3 py-2">Full Name</th><th className="text-left px-3 py-2">Role</th><th className="text-left px-3 py-2">Status</th><th className="text-right px-3 py-2">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-50">
            {users.length===0 && <tr><td colSpan="5" className="text-center py-6 text-slate-400">No users yet</td></tr>}
            {users.map(u=>(
              <tr key={u.id}>
                <td className="px-3 py-2 font-medium">{u.username}{currentUser && u.id===currentUser.id && <span className="text-slate-400"> (you)</span>}</td>
                <td className="px-3 py-2 text-slate-600">{u.fullName||'-'}</td>
                <td className="px-3 py-2 text-slate-600">{u.role}</td>
                <td className="px-3 py-2"><Badge tint={u.status==='Active'?'emerald':'slate'}>{u.status}</Badge></td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <button title="Edit" onClick={()=>{ setEditing(u); setFormOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="edit" className="w-4 h-4"/></button>
                    {(!currentUser || u.id !== currentUser.id) && <button title="Delete" onClick={()=>setToDelete(u)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="w-4 h-4"/></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {formOpen && (
        <Modal title={editing ? 'Edit User' : 'Add User'} onClose={()=>setFormOpen(false)} wide>
          <UserForm initial={editing} onCancel={()=>setFormOpen(false)} onSave={(f)=>{ editing ? onUpdateUser(editing, f) : onAddUser(f); setFormOpen(false); }} />
        </Modal>
      )}
      {toDelete && <ConfirmDialog text={`Remove user "${toDelete.username}"? They will no longer be able to log in.`} onCancel={()=>setToDelete(null)} onConfirm={()=>{ onDeleteUser(toDelete); setToDelete(null); }} />}
    </Card>
  );
}

/* =========================================================================
   SALARY MODULE
   ========================================================================= */
function EmployeeForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState(initial || { name:'', role: EMPLOYEE_ROLES[0], phone:'', cnic:'', joinDate: todayStr(), monthlySalary:'', status:'Active' });
  const set = (k,v) => setF(prev=>({...prev,[k]:v}));
  const submit = (e) => { e.preventDefault(); if(!f.name) return; onSave(f); };
  return (
    <form onSubmit={submit}>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Full Name" required><input className={inputCls} value={f.name} onChange={e=>set('name',e.target.value)} required/></Field>
        <Field label="Role"><select className={inputCls} value={f.role} onChange={e=>set('role',e.target.value)}>{EMPLOYEE_ROLES.map(r=><option key={r}>{r}</option>)}</select></Field>
        <Field label="Phone"><input className={inputCls} value={f.phone} onChange={e=>set('phone',e.target.value)} /></Field>
        <Field label="CNIC"><input className={inputCls} value={f.cnic} onChange={e=>set('cnic',e.target.value)} /></Field>
        <Field label="Join Date"><input type="date" className={inputCls} value={f.joinDate} onChange={e=>set('joinDate',e.target.value)} /></Field>
        <Field label="Monthly Salary (Rs)"><input type="number" min="0" className={inputCls} value={f.monthlySalary} onChange={e=>set('monthlySalary',e.target.value)} /></Field>
        <Field label="Status"><select className={inputCls} value={f.status} onChange={e=>set('status',e.target.value)}><option>Active</option><option>Left</option></select></Field>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Employee</Button>
      </div>
    </form>
  );
}

function SalaryForm({ employee, methods, onSave, onCancel }) {
  const [f, setF] = useState({ month: todayStr().slice(0,7), basicSalary: employee.monthlySalary || 0, bonus:0, deductions:0, advance:0, paymentMethod: methods[0], paidBy:'', remarks:'' });
  const set = (k,v) => setF(prev=>({...prev,[k]:v}));
  const net = (Number(f.basicSalary)||0) + (Number(f.bonus)||0) - (Number(f.deductions)||0) - (Number(f.advance)||0);
  const submit = (e) => { e.preventDefault(); onSave({ ...f, date: todayStr(), netPaid: net }); };
  return (
    <form onSubmit={submit}>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="For Month"><input type="month" className={inputCls} value={f.month} onChange={e=>set('month',e.target.value)} /></Field>
        <Field label="Payment Method"><select className={inputCls} value={f.paymentMethod} onChange={e=>set('paymentMethod',e.target.value)}>{methods.map(m=><option key={m}>{m}</option>)}</select></Field>
        <Field label="Basic Salary (Rs)"><input type="number" className={inputCls} value={f.basicSalary} onChange={e=>set('basicSalary',e.target.value)} /></Field>
        <Field label="Bonus (Rs)"><input type="number" className={inputCls} value={f.bonus} onChange={e=>set('bonus',e.target.value)} /></Field>
        <Field label="Deductions (Rs)"><input type="number" className={inputCls} value={f.deductions} onChange={e=>set('deductions',e.target.value)} /></Field>
        <Field label="Advance Adjusted (Rs)"><input type="number" className={inputCls} value={f.advance} onChange={e=>set('advance',e.target.value)} /></Field>
        <Field label="Paid By"><input className={inputCls} value={f.paidBy} onChange={e=>set('paidBy',e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Remarks"><textarea className={inputCls} rows="2" value={f.remarks} onChange={e=>set('remarks',e.target.value)} /></Field></div>
      </div>
      <div className="border-t border-b border-dashed border-slate-200 py-3 flex justify-between items-center mb-3">
        <span className="font-medium text-sm">Net Payable</span><span className="font-display font-bold text-lg">{formatPKR(net)}</span>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Pay Salary</Button>
      </div>
    </form>
  );
}

function SalarySlipView({ payment, employee, settings }) {
  return (
    <div id="print-section" className="text-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3 mb-3">
        {settings.logo && <img src={settings.logo} className="w-12 h-12 rounded object-cover" />}
        <div>
          <p className="font-display font-bold text-base">{settings.schoolName}</p>
          <p className="text-xs text-slate-500">{settings.address}</p>
        </div>
      </div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-display font-semibold">Salary Slip</h3>
        <p className="text-slate-500">No: <span className="font-semibold text-ink">{payment.slipNo}</span></p>
      </div>
      <div className="grid grid-cols-2 gap-y-1.5 mb-3">
        <p className="text-slate-500">Employee</p><p className="text-right font-medium">{employee ? employee.name : '-'}</p>
        <p className="text-slate-500">Role</p><p className="text-right font-medium">{employee ? employee.role : '-'}</p>
        <p className="text-slate-500">Month</p><p className="text-right font-medium">{monthLabel(payment.month)}</p>
        <p className="text-slate-500">Date Paid</p><p className="text-right font-medium">{formatDate(payment.date)}</p>
        <p className="text-slate-500">Basic Salary</p><p className="text-right font-medium">{formatPKR(payment.basicSalary)}</p>
        <p className="text-slate-500">Bonus</p><p className="text-right font-medium">{formatPKR(payment.bonus)}</p>
        <p className="text-slate-500">Deductions</p><p className="text-right font-medium">-{formatPKR(payment.deductions)}</p>
        <p className="text-slate-500">Advance Adjusted</p><p className="text-right font-medium">-{formatPKR(payment.advance)}</p>
        <p className="text-slate-500">Payment Method</p><p className="text-right font-medium">{payment.paymentMethod}</p>
      </div>
      <div className="border-t border-b border-dashed border-slate-300 py-3 flex justify-between items-center mb-3">
        <span className="font-medium">Net Paid</span><span className="font-display font-bold text-lg">{formatPKR(payment.netPaid)}</span>
      </div>
      {payment.remarks && <p className="text-slate-500 text-xs mb-3">Remarks: {payment.remarks}</p>}
      <p className="text-[11px] text-slate-400 mt-6">This is a computer-generated salary slip.</p>
    </div>
  );
}

function SalaryModule({ data, addEmployee, updateEmployee, deleteEmployee, paySalary, deleteSalaryPayment, caps }) {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('Active');
  const [empFormOpen, setEmpFormOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [payingFor, setPayingFor] = useState(null);
  const [printingSlip, setPrintingSlip] = useState(null);
  const [toDeleteEmp, setToDeleteEmp] = useState(null);
  const [toDeletePayment, setToDeletePayment] = useState(null);

  const employees = data.employees.filter(e => {
    if (statusFilter!=='All' && e.status!==statusFilter) return false;
    if (q && !(`${e.name} ${e.role} ${e.phone}`.toLowerCase().includes(q.toLowerCase()))) return false;
    return true;
  });

  const thisMonth = todayStr().slice(0,7);
  const paidThisMonth = data.salaryPayments.filter(p=>p.month===thisMonth).reduce((s,p)=>s+Number(p.netPaid||0),0);
  const totalMonthlyPayroll = data.employees.filter(e=>e.status==='Active').reduce((s,e)=>s+Number(e.monthlySalary||0),0);
  const recentPayments = [...data.salaryPayments].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,10);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard label="Active Employees" value={data.employees.filter(e=>e.status==='Active').length} icon="students" tint="slate" />
        <StatCard label="Monthly Payroll (budgeted)" value={formatPKR(totalMonthlyPayroll)} icon="payroll" tint="indigo" />
        <StatCard label="Paid This Month" value={formatPKR(paidThisMonth)} icon="expense" tint="rose" sub={monthLabel(thisMonth)} />
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2 flex-1 min-w-[240px]">
          <div className="w-56"><SearchBox value={q} onChange={setQ} placeholder="Search employee, role, phone..." /></div>
          <select className={inputCls + " w-auto"} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>All</option><option>Active</option><option>Left</option></select>
        </div>
        {caps.canEdit && <Button onClick={()=>{ setEditingEmp(null); setEmpFormOpen(true); }}><Icon name="plus" className="w-4 h-4"/>Add Employee</Button>}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Role</th><th className="text-left px-4 py-3">Phone</th><th className="text-right px-4 py-3">Monthly Salary</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {employees.length===0 && <tr><td colSpan="6"><EmptyState icon="payroll" title="No employees found" sub="Add teaching and support staff to start running payroll." /></td></tr>}
              {employees.map(e=>(
                <tr key={e.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-700">{e.name}</td>
                  <td className="px-4 py-3 text-slate-500">{e.role}</td>
                  <td className="px-4 py-3 text-slate-500">{e.phone||'-'}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatPKR(e.monthlySalary)}</td>
                  <td className="px-4 py-3"><Badge tint={e.status==='Active'?'emerald':'slate'}>{e.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {caps.canEdit && <Button className="text-xs py-1 px-2" onClick={()=>setPayingFor(e)}><Icon name="income" className="w-3.5 h-3.5"/>Pay</Button>}
                      {caps.canEdit && <button title="Edit" onClick={()=>{ setEditingEmp(e); setEmpFormOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="edit" className="w-4 h-4"/></button>}
                      {caps.canDelete && <button title="Delete" onClick={()=>setToDeleteEmp(e)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="w-4 h-4"/></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-display font-semibold text-sm text-slate-700 mb-4">Recent Salary Payments</h3>
        <div className="border border-slate-100 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase"><tr><th className="text-left px-3 py-2">Slip#</th><th className="text-left px-3 py-2">Employee</th><th className="text-left px-3 py-2">Month</th><th className="text-left px-3 py-2">Date</th><th className="text-right px-3 py-2">Net Paid</th><th className="text-right px-3 py-2">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-50">
              {recentPayments.length===0 && <tr><td colSpan="6" className="text-center py-8 text-slate-400">No salary payments recorded yet</td></tr>}
              {recentPayments.map(p=>{
                const emp = data.employees.find(e=>e.id===p.employeeId);
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-2">{p.slipNo}</td>
                    <td className="px-3 py-2 font-medium">{emp ? emp.name : '(removed)'}</td>
                    <td className="px-3 py-2">{monthLabel(p.month)}</td>
                    <td className="px-3 py-2">{formatDate(p.date)}</td>
                    <td className="px-3 py-2 text-right font-medium text-rose-600">{formatPKR(p.netPaid)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button title="Print slip" onClick={()=>setPrintingSlip(p)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="print" className="w-4 h-4"/></button>
                        {caps.canDelete && <button title="Delete" onClick={()=>setToDeletePayment(p)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="w-4 h-4"/></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {empFormOpen && (
        <Modal title={editingEmp ? 'Edit Employee' : 'Add Employee'} onClose={()=>setEmpFormOpen(false)} wide>
          <EmployeeForm initial={editingEmp} onCancel={()=>setEmpFormOpen(false)} onSave={(f)=>{ editingEmp ? updateEmployee(editingEmp.id, f) : addEmployee(f); setEmpFormOpen(false); }} />
        </Modal>
      )}
      {payingFor && (
        <Modal title={`Pay Salary — ${payingFor.name}`} onClose={()=>setPayingFor(null)} wide>
          <SalaryForm employee={payingFor} methods={data.settings.paymentMethods} onCancel={()=>setPayingFor(null)} onSave={(f)=>{ paySalary(payingFor, f); setPayingFor(null); }} />
        </Modal>
      )}
      {printingSlip && (
        <Modal title="Salary Slip" onClose={()=>setPrintingSlip(null)}>
          <SalarySlipView payment={printingSlip} employee={data.employees.find(e=>e.id===printingSlip.employeeId)} settings={data.settings} />
          <div className="flex justify-end gap-2 mt-4 no-print">
            <Button variant="secondary" onClick={()=>setPrintingSlip(null)}>Close</Button>
            <Button onClick={()=>window.print()}><Icon name="print" className="w-4 h-4"/>Print</Button>
          </div>
        </Modal>
      )}
      {toDeleteEmp && <ConfirmDialog text={`Delete employee "${toDeleteEmp.name}"? Past salary payments will be kept but unlinked.`} onCancel={()=>setToDeleteEmp(null)} onConfirm={()=>{ deleteEmployee(toDeleteEmp.id); setToDeleteEmp(null); }} />}
      {toDeletePayment && <ConfirmDialog text="Delete this salary payment? Its linked expense record will also be removed." onCancel={()=>setToDeletePayment(null)} onConfirm={()=>{ deleteSalaryPayment(toDeletePayment); setToDeletePayment(null); }} />}
    </div>
  );
}

/* =========================================================================
   TRANSPORT MODULE
   ========================================================================= */
function VehicleForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState(initial || { vehicleNo:'', type: VEHICLE_TYPES[0], capacity:'', driverName:'', driverPhone:'', route:'', status:'Active' });
  const set = (k,v) => setF(prev=>({...prev,[k]:v}));
  const submit = (e) => { e.preventDefault(); if(!f.vehicleNo) return; onSave(f); };
  return (
    <form onSubmit={submit}>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Vehicle #" required><input className={inputCls} value={f.vehicleNo} onChange={e=>set('vehicleNo',e.target.value)} required/></Field>
        <Field label="Type"><select className={inputCls} value={f.type} onChange={e=>set('type',e.target.value)}>{VEHICLE_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Capacity (seats)"><input type="number" min="0" className={inputCls} value={f.capacity} onChange={e=>set('capacity',e.target.value)} /></Field>
        <Field label="Route"><input className={inputCls} value={f.route} onChange={e=>set('route',e.target.value)} /></Field>
        <Field label="Driver Name"><input className={inputCls} value={f.driverName} onChange={e=>set('driverName',e.target.value)} /></Field>
        <Field label="Driver Phone"><input className={inputCls} value={f.driverPhone} onChange={e=>set('driverPhone',e.target.value)} /></Field>
        <Field label="Status"><select className={inputCls} value={f.status} onChange={e=>set('status',e.target.value)}><option>Active</option><option>Inactive</option></select></Field>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Vehicle</Button>
      </div>
    </form>
  );
}

function TransportModule({ data, addVehicle, updateVehicle, deleteVehicle, caps }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const transportIncome = data.income.filter(i=>i.category==='Transport Fee').reduce((s,i)=>s+Number(i.amount||0),0);
  const transportExpense = data.expenses.filter(e=>VEHICLE_LINKED_CATEGORIES.includes(e.category)).reduce((s,e)=>s+Number(e.amount||0),0);
  const expenseByVehicle = (vehicleId) => data.expenses.filter(e=>e.vehicleId===vehicleId).reduce((s,e)=>s+Number(e.amount||0),0);
  const transportStudents = data.students.filter(s=>s.status==='Active' && s.transport);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-4 gap-4">
        <StatCard label="Vehicles" value={data.vehicles.length} icon="bus" tint="slate" />
        <StatCard label="Transport Students" value={transportStudents.length} icon="students" tint="slate" />
        <StatCard label="Transport Fee Income" value={formatPKR(transportIncome)} icon="income" tint="emerald" sub="All time" />
        <StatCard label="Fuel + Repair Expense" value={formatPKR(transportExpense)} icon="expense" tint="rose" sub="All time" />
      </div>

      <div className="flex justify-end">
        {caps.canEdit && <Button onClick={()=>{ setEditing(null); setFormOpen(true); }}><Icon name="plus" className="w-4 h-4"/>Add Vehicle</Button>}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr><th className="text-left px-4 py-3">Vehicle #</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Route</th><th className="text-left px-4 py-3">Driver</th><th className="text-left px-4 py-3">Capacity</th><th className="text-right px-4 py-3">Fuel + Repair Cost</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.vehicles.length===0 && <tr><td colSpan="8"><EmptyState icon="bus" title="No vehicles added" sub="Add your school vans/buses to track drivers, routes, and running costs." /></td></tr>}
              {data.vehicles.map(v=>(
                <tr key={v.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-700">{v.vehicleNo}</td>
                  <td className="px-4 py-3 text-slate-500">{v.type}</td>
                  <td className="px-4 py-3 text-slate-500">{v.route||'-'}</td>
                  <td className="px-4 py-3 text-slate-500">{v.driverName||'-'} {v.driverPhone && <span className="text-slate-400">({v.driverPhone})</span>}</td>
                  <td className="px-4 py-3 text-slate-500">{v.capacity||'-'}</td>
                  <td className="px-4 py-3 text-right font-medium text-rose-600">{formatPKR(expenseByVehicle(v.id))}</td>
                  <td className="px-4 py-3"><Badge tint={v.status==='Active'?'emerald':'slate'}>{v.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {caps.canEdit && <button title="Edit" onClick={()=>{ setEditing(v); setFormOpen(true); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="edit" className="w-4 h-4"/></button>}
                      {caps.canDelete && <button title="Delete" onClick={()=>setToDelete(v)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="w-4 h-4"/></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-xs text-slate-400">Tip: when you add a Fuel or Vehicle Repair expense, choose the matching vehicle in the expense form so its running cost shows up here.</p>
      </Card>

      {formOpen && (
        <Modal title={editing ? 'Edit Vehicle' : 'Add Vehicle'} onClose={()=>setFormOpen(false)} wide>
          <VehicleForm initial={editing} onCancel={()=>setFormOpen(false)} onSave={(f)=>{ editing ? updateVehicle(editing.id, f) : addVehicle(f); setFormOpen(false); }} />
        </Modal>
      )}
      {toDelete && <ConfirmDialog text={`Delete vehicle "${toDelete.vehicleNo}"?`} onCancel={()=>setToDelete(null)} onConfirm={()=>{ deleteVehicle(toDelete.id); setToDelete(null); }} />}
    </div>
  );
}

/* =========================================================================
   DOCUMENTS MODULE
   ========================================================================= */
function DocumentForm({ students, onSave, onCancel }) {
  const [f, setF] = useState({ studentId:'', type: DOCUMENT_TYPES[0], issueDate: todayStr(), feeCharged:'', remarks:'' });
  const set = (k,v) => setF(prev=>({...prev,[k]:v}));
  const submit = (e) => { e.preventDefault(); if(!f.studentId) return; onSave(f); };
  return (
    <form onSubmit={submit}>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Student" required>
          <select className={inputCls} value={f.studentId} onChange={e=>set('studentId',e.target.value)} required>
            <option value="">Select student...</option>
            {students.map(s=><option key={s.id} value={s.id}>{s.name} ({s.admissionNo})</option>)}
          </select>
        </Field>
        <Field label="Document Type"><select className={inputCls} value={f.type} onChange={e=>set('type',e.target.value)}>{DOCUMENT_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Issue Date"><input type="date" className={inputCls} value={f.issueDate} onChange={e=>set('issueDate',e.target.value)} /></Field>
        <Field label="Fee Charged (Rs, optional)"><input type="number" min="0" className={inputCls} value={f.feeCharged} onChange={e=>set('feeCharged',e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Remarks"><textarea className={inputCls} rows="2" value={f.remarks} onChange={e=>set('remarks',e.target.value)} /></Field></div>
      </div>
      <p className="text-xs text-slate-400 -mt-2 mb-3">If a fee is charged, a matching income receipt is created automatically.</p>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Issue Document</Button>
      </div>
    </form>
  );
}

function DocumentSlipView({ doc, student, settings }) {
  return (
    <div id="print-section" className="text-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3 mb-3">
        {settings.logo && <img src={settings.logo} className="w-12 h-12 rounded object-cover" />}
        <div><p className="font-display font-bold text-base">{settings.schoolName}</p><p className="text-xs text-slate-500">{settings.address}</p></div>
      </div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-display font-semibold">Document Issue Slip</h3>
        <p className="text-slate-500">No: <span className="font-semibold text-ink">{doc.docNo}</span></p>
      </div>
      <div className="grid grid-cols-2 gap-y-1.5 mb-3">
        <p className="text-slate-500">Student</p><p className="text-right font-medium">{student ? `${student.name} (Adm# ${student.admissionNo})` : '-'}</p>
        <p className="text-slate-500">Document Type</p><p className="text-right font-medium">{doc.type}</p>
        <p className="text-slate-500">Issue Date</p><p className="text-right font-medium">{formatDate(doc.issueDate)}</p>
        {doc.feeCharged > 0 && <><p className="text-slate-500">Fee Charged</p><p className="text-right font-medium">{formatPKR(doc.feeCharged)}</p></>}
      </div>
      {doc.remarks && <p className="text-slate-500 text-xs mb-3">Remarks: {doc.remarks}</p>}
      <p className="text-[11px] text-slate-400 mt-6">This is a computer-generated document issue record, not the certificate itself.</p>
    </div>
  );
}

function DocumentsModule({ data, issueDocument, deleteDocument, caps }) {
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [formOpen, setFormOpen] = useState(false);
  const [printing, setPrinting] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const filtered = data.documents.filter(d => {
    if (typeFilter!=='All' && d.type!==typeFilter) return false;
    if (q) {
      const student = data.students.find(s=>s.id===d.studentId);
      if (!(`${d.docNo} ${d.type} ${student?student.name:''}`.toLowerCase().includes(q.toLowerCase()))) return false;
    }
    return true;
  }).sort((a,b)=>(b.issueDate||'').localeCompare(a.issueDate||''));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-2 flex-1 min-w-[240px]">
          <div className="w-56"><SearchBox value={q} onChange={setQ} placeholder="Search doc#, type, student..." /></div>
          <select className={inputCls + " w-auto"} value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option>All</option>{DOCUMENT_TYPES.map(t=><option key={t}>{t}</option>)}</select>
        </div>
        {caps.canEdit && <Button onClick={()=>setFormOpen(true)}><Icon name="plus" className="w-4 h-4"/>Issue Document</Button>}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr><th className="text-left px-4 py-3">Doc#</th><th className="text-left px-4 py-3">Student</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Issue Date</th><th className="text-right px-4 py-3">Fee</th><th className="text-right px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length===0 && <tr><td colSpan="6"><EmptyState icon="document" title="No documents issued yet" sub="Track certificates, result cards, and other paid documents here." /></td></tr>}
              {filtered.map(d=>{
                const student = data.students.find(s=>s.id===d.studentId);
                return (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-500">{d.docNo}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{student ? student.name : '(removed)'}</td>
                    <td className="px-4 py-3 text-slate-600">{d.type}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(d.issueDate)}</td>
                    <td className="px-4 py-3 text-right font-medium">{d.feeCharged > 0 ? formatPKR(d.feeCharged) : <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button title="Print slip" onClick={()=>setPrinting(d)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Icon name="print" className="w-4 h-4"/></button>
                        {caps.canDelete && <button title="Delete" onClick={()=>setToDelete(d)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="w-4 h-4"/></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {formOpen && (
        <Modal title="Issue Document" onClose={()=>setFormOpen(false)} wide>
          <DocumentForm students={data.students.filter(s=>s.status==='Active')} onCancel={()=>setFormOpen(false)} onSave={(f)=>{ issueDocument(f); setFormOpen(false); }} />
        </Modal>
      )}
      {printing && (
        <Modal title="Document Issue Slip" onClose={()=>setPrinting(null)}>
          <DocumentSlipView doc={printing} student={data.students.find(s=>s.id===printing.studentId)} settings={data.settings} />
          <div className="flex justify-end gap-2 mt-4 no-print">
            <Button variant="secondary" onClick={()=>setPrinting(null)}>Close</Button>
            <Button onClick={()=>window.print()}><Icon name="print" className="w-4 h-4"/>Print</Button>
          </div>
        </Modal>
      )}
      {toDelete && <ConfirmDialog text={`Delete this document record (${toDelete.docNo})? This does not affect any linked income entry.`} onCancel={()=>setToDelete(null)} onConfirm={()=>{ deleteDocument(toDelete.id); setToDelete(null); }} />}
    </div>
  );
}

/* =========================================================================
   FINE MANAGEMENT MODULE
   ========================================================================= */
function FineForm({ students, onSave, onCancel }) {
  const [f, setF] = useState({ studentId:'', type: FINE_TYPES[0], amount:'', dateImposed: todayStr(), reason:'' });
  const set = (k,v) => setF(prev=>({...prev,[k]:v}));
  const submit = (e) => { e.preventDefault(); if(!f.studentId || !f.amount) return; onSave(f); };
  return (
    <form onSubmit={submit}>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Student" required>
          <select className={inputCls} value={f.studentId} onChange={e=>set('studentId',e.target.value)} required>
            <option value="">Select student...</option>
            {students.map(s=><option key={s.id} value={s.id}>{s.name} ({s.admissionNo})</option>)}
          </select>
        </Field>
        <Field label="Fine Type"><select className={inputCls} value={f.type} onChange={e=>set('type',e.target.value)}>{FINE_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
        <Field label="Amount (Rs)" required><input type="number" min="0" className={inputCls} value={f.amount} onChange={e=>set('amount',e.target.value)} required/></Field>
        <Field label="Date Imposed"><input type="date" className={inputCls} value={f.dateImposed} onChange={e=>set('dateImposed',e.target.value)} /></Field>
        <div className="sm:col-span-2"><Field label="Reason"><textarea className={inputCls} rows="2" value={f.reason} onChange={e=>set('reason',e.target.value)} /></Field></div>
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 mt-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Impose Fine</Button>
      </div>
    </form>
  );
}

function FinesModule({ data, imposeFine, collectFine, deleteFine, caps }) {
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  const filtered = data.fines.filter(f => statusFilter==='All' || f.status===statusFilter).sort((a,b)=>(b.dateImposed||'').localeCompare(a.dateImposed||''));
  const totalPending = data.fines.filter(f=>f.status==='Pending').reduce((s,f)=>s+Number(f.amount||0),0);
  const totalCollected = data.fines.filter(f=>f.status==='Paid').reduce((s,f)=>s+Number(f.amount||0),0);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <StatCard label="Pending Fines" value={formatPKR(totalPending)} icon="alert" tint="amber" />
        <StatCard label="Fines Collected (all-time)" value={formatPKR(totalCollected)} icon="income" tint="emerald" />
      </div>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <select className={inputCls + " w-auto"} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>All</option><option>Pending</option><option>Paid</option></select>
        {caps.canEdit && <Button onClick={()=>setFormOpen(true)}><Icon name="plus" className="w-4 h-4"/>Impose Fine</Button>}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr><th className="text-left px-4 py-3">Student</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Reason</th><th className="text-right px-4 py-3">Amount</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length===0 && <tr><td colSpan="7"><EmptyState icon="alert" title="No fines found" sub="Impose late-fee, discipline, library, or custom fines here." /></td></tr>}
              {filtered.map(f=>{
                const student = data.students.find(s=>s.id===f.studentId);
                return (
                  <tr key={f.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-700">{student ? student.name : '(removed)'}</td>
                    <td className="px-4 py-3 text-slate-600">{f.type}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(f.dateImposed)}</td>
                    <td className="px-4 py-3 text-slate-500">{f.reason || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium text-rose-600">{formatPKR(f.amount)}</td>
                    <td className="px-4 py-3"><Badge tint={f.status==='Paid'?'emerald':'amber'}>{f.status}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {f.status==='Pending' && caps.canEdit && <Button className="text-xs py-1 px-2" onClick={()=>collectFine(f)}><Icon name="income" className="w-3.5 h-3.5"/>Collect</Button>}
                        {caps.canDelete && <button title="Delete" onClick={()=>setToDelete(f)} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Icon name="trash" className="w-4 h-4"/></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {formOpen && (
        <Modal title="Impose Fine" onClose={()=>setFormOpen(false)} wide>
          <FineForm students={data.students.filter(s=>s.status==='Active')} onCancel={()=>setFormOpen(false)} onSave={(f)=>{ imposeFine(f); setFormOpen(false); }} />
        </Modal>
      )}
      {toDelete && <ConfirmDialog text="Delete this fine record? If it was already collected, the linked income entry will also be removed." onCancel={()=>setToDelete(null)} onConfirm={()=>{ deleteFine(toDelete); setToDelete(null); }} />}
    </div>
  );
}

/* =========================================================================
   LOADING SCREEN
   ========================================================================= */
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-brand-600 mx-auto mb-4 animate-pulse"></div>
        <p className="text-slate-400 text-sm">Loading IQRA Finance…</p>
      </div>
    </div>
  );
}

/* =========================================================================
   AUTH SCREENS (first-run setup + login)
   ========================================================================= */
function SetupScreen({ onCreateAdmin, schoolName }) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) { setError('Please choose a username and password.'); return; }
    if (password.length < 6) { setError('Password should be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    await onCreateAdmin({ username: username.trim(), password, fullName: fullName.trim() || username.trim() });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm p-7">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 mx-auto mb-3 flex items-center justify-center text-white font-display font-bold text-lg">IQ</div>
          <h1 className="font-display font-bold text-lg text-ink">Welcome to {schoolName}</h1>
          <p className="text-sm text-slate-400 mt-1">Create your administrator account to get started</p>
        </div>
        <form onSubmit={submit}>
          <Field label="Full Name"><input className={inputCls} value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="e.g. Zohaib Khan" autoFocus /></Field>
          <Field label="Username" required><input className={inputCls} value={username} onChange={e=>setUsername(e.target.value)} required /></Field>
          <Field label="Password" required><input type="password" className={inputCls} value={password} onChange={e=>setPassword(e.target.value)} required /></Field>
          <Field label="Confirm Password" required><input type="password" className={inputCls} value={confirm} onChange={e=>setConfirm(e.target.value)} required /></Field>
          {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}
          <Button type="submit" className="w-full justify-center" disabled={busy}>{busy ? 'Creating…' : 'Create Admin Account'}</Button>
        </form>
      </Card>
    </div>
  );
}

function LoginScreen({ onLogin, schoolName }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const ok = await onLogin(username.trim(), password);
    setBusy(false);
    if (!ok) setError('Incorrect username or password, or this account is disabled.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm p-7">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-600 mx-auto mb-3 flex items-center justify-center text-white"><Icon name="lock" className="w-5 h-5"/></div>
          <h1 className="font-display font-bold text-lg text-ink">{schoolName}</h1>
          <p className="text-sm text-slate-400 mt-1">Sign in to continue</p>
        </div>
        <form onSubmit={submit}>
          <Field label="Username" required><input className={inputCls} value={username} onChange={e=>setUsername(e.target.value)} autoFocus required /></Field>
          <Field label="Password" required><input type="password" className={inputCls} value={password} onChange={e=>setPassword(e.target.value)} required /></Field>
          {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}
          <Button type="submit" className="w-full justify-center" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</Button>
        </form>
      </Card>
    </div>
  );
}

/* =========================================================================
   APP ROOT
   ========================================================================= */
function App() {
  const [data, setData, loaded] = useLocalData();
  const [tab, setTab] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [incomePrefill, setIncomePrefill] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');

  const addStudent = (f) => setData(prev => ({ ...prev, students: [{ ...f, id: uid() }, ...prev.students] }));
  const updateStudent = (id, f) => setData(prev => ({ ...prev, students: prev.students.map(s => s.id===id ? { ...s, ...f, id } : s) }));
  const deleteStudent = (id) => setData(prev => ({ ...prev, students: prev.students.filter(s=>s.id!==id) }));

  const addIncome = (f) => setData(prev => {
    const receiptNo = `${prev.settings.receiptPrefix}-${prev.settings.nextReceiptNo}`;
    return { ...prev, income: [{ ...f, id: uid(), receiptNo }, ...prev.income], settings: { ...prev.settings, nextReceiptNo: prev.settings.nextReceiptNo + 1 } };
  });
  const updateIncome = (id, f) => setData(prev => ({ ...prev, income: prev.income.map(i => i.id===id ? { ...i, ...f, id } : i) }));
  const deleteIncome = (id) => setData(prev => ({ ...prev, income: prev.income.filter(i=>i.id!==id) }));

  const addExpense = (f) => setData(prev => {
    const voucherNo = `${prev.settings.voucherPrefix}-${prev.settings.nextVoucherNo}`;
    return { ...prev, expenses: [{ ...f, id: uid(), voucherNo }, ...prev.expenses], settings: { ...prev.settings, nextVoucherNo: prev.settings.nextVoucherNo + 1 } };
  });
  const updateExpense = (id, f) => setData(prev => ({ ...prev, expenses: prev.expenses.map(e => e.id===id ? { ...e, ...f, id } : e) }));
  const deleteExpense = (id) => setData(prev => ({ ...prev, expenses: prev.expenses.filter(e=>e.id!==id) }));

  const addEmployee = (f) => setData(prev => ({ ...prev, employees: [{ ...f, id: uid() }, ...prev.employees] }));
  const updateEmployee = (id, f) => setData(prev => ({ ...prev, employees: prev.employees.map(e => e.id===id ? { ...e, ...f, id } : e) }));
  const deleteEmployee = (id) => setData(prev => ({ ...prev, employees: prev.employees.filter(e=>e.id!==id) }));

  const paySalary = (employee, f) => setData(prev => {
    const voucherNo = `${prev.settings.voucherPrefix}-${prev.settings.nextVoucherNo}`;
    const slipNo = `${prev.settings.slipPrefix}-${prev.settings.nextSlipNo}`;
    const expenseCategory = employee.role === 'Teacher' ? 'Teachers Salaries' : 'Staff Salaries';
    const expenseEntry = { id: uid(), voucherNo, date: f.date, vendor: employee.name, category: expenseCategory, amount: f.netPaid, paymentMethod: f.paymentMethod, paidBy: f.paidBy || '', remarks: `Salary for ${monthLabel(f.month)}` };
    const salaryEntry = { ...f, id: uid(), employeeId: employee.id, slipNo, expenseId: expenseEntry.id };
    return {
      ...prev,
      expenses: [expenseEntry, ...prev.expenses],
      salaryPayments: [salaryEntry, ...prev.salaryPayments],
      settings: { ...prev.settings, nextVoucherNo: prev.settings.nextVoucherNo + 1, nextSlipNo: prev.settings.nextSlipNo + 1 },
    };
  });
  const deleteSalaryPayment = (payment) => setData(prev => ({
    ...prev,
    salaryPayments: prev.salaryPayments.filter(p=>p.id!==payment.id),
    expenses: prev.expenses.filter(e=>e.id!==payment.expenseId),
  }));

  const addVehicle = (f) => setData(prev => ({ ...prev, vehicles: [{ ...f, id: uid() }, ...prev.vehicles] }));
  const updateVehicle = (id, f) => setData(prev => ({ ...prev, vehicles: prev.vehicles.map(v => v.id===id ? { ...v, ...f, id } : v) }));
  const deleteVehicle = (id) => setData(prev => ({ ...prev, vehicles: prev.vehicles.filter(v=>v.id!==id) }));

  const issueDocument = (f) => setData(prev => {
    const docNo = `${prev.settings.docPrefix}-${prev.settings.nextDocNo}`;
    let next = { ...prev, documents: [{ ...f, id: uid(), docNo }, ...prev.documents], settings: { ...prev.settings, nextDocNo: prev.settings.nextDocNo + 1 } };
    if (Number(f.feeCharged) > 0) {
      const receiptNo = `${next.settings.receiptPrefix}-${next.settings.nextReceiptNo}`;
      const category = DOCUMENT_FEE_CATEGORY[f.type] || 'Documents Fee';
      const incomeEntry = { id: uid(), receiptNo, date: f.issueDate, studentId: f.studentId, category, amount: f.feeCharged, paymentMethod: 'Cash', receivedBy: currentUser ? (currentUser.fullName || currentUser.username) : '', remarks: `${f.type} issued` };
      next = { ...next, income: [incomeEntry, ...next.income], settings: { ...next.settings, nextReceiptNo: next.settings.nextReceiptNo + 1 } };
    }
    return next;
  });
  const deleteDocument = (id) => setData(prev => ({ ...prev, documents: prev.documents.filter(d=>d.id!==id) }));

  const imposeFine = (f) => setData(prev => ({ ...prev, fines: [{ ...f, id: uid(), status: 'Pending' }, ...prev.fines] }));
  const collectFine = (fine) => setData(prev => {
    const receiptNo = `${prev.settings.receiptPrefix}-${prev.settings.nextReceiptNo}`;
    const incomeEntry = { id: uid(), receiptNo, date: todayStr(), studentId: fine.studentId, category: 'Fine Collection', amount: fine.amount, paymentMethod: 'Cash', receivedBy: currentUser ? (currentUser.fullName || currentUser.username) : '', remarks: `${fine.type}${fine.reason ? ' — '+fine.reason : ''}` };
    return {
      ...prev,
      income: [incomeEntry, ...prev.income],
      fines: prev.fines.map(x => x.id===fine.id ? { ...x, status:'Paid', datePaid: todayStr(), incomeId: incomeEntry.id } : x),
      settings: { ...prev.settings, nextReceiptNo: prev.settings.nextReceiptNo + 1 },
    };
  });
  const deleteFine = (fine) => setData(prev => ({
    ...prev,
    fines: prev.fines.filter(x=>x.id!==fine.id),
    income: fine.incomeId ? prev.income.filter(i=>i.id!==fine.incomeId) : prev.income,
  }));

  const updateSettings = (patch) => setData(prev => ({ ...prev, settings: { ...prev.settings, ...patch } }));
  const importData = (obj) => setData({ ...freshData(), ...obj, settings: { ...DEFAULT_DATA.settings, ...(obj.settings||{}) } });
  const resetData = () => { setData(freshData()); setCurrentUser(null); };

  const openIncomeFormFor = (student) => { setTab('income'); setIncomePrefill(student); };

  /* ---- Auth: first-run setup, login, logout, user management ---- */
  const createFirstAdmin = async ({ username, password, fullName }) => {
    const salt = randomSalt();
    const passwordHash = await hashPassword(password, salt);
    const user = { id: uid(), username, passwordHash, salt, fullName, role: 'Admin', status: 'Active' };
    setData(prev => ({ ...prev, users: [user] }));
    setCurrentUser(user);
  };

  const login = async (username, password) => {
    const user = data.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.status === 'Active');
    if (!user) return false;
    const hash = await hashPassword(password, user.salt);
    if (hash !== user.passwordHash) return false;
    setCurrentUser(user);
    return true;
  };

  const logout = () => { setCurrentUser(null); setTab('dashboard'); };

  const addUser = async (f) => {
    const salt = randomSalt();
    const passwordHash = await hashPassword(f.password, salt);
    const user = { id: uid(), username: f.username.trim(), passwordHash, salt, fullName: f.fullName.trim(), role: f.role, status: f.status };
    setData(prev => ({ ...prev, users: [...prev.users, user] }));
  };
  const updateUser = async (existing, f) => {
    let patch = { fullName: f.fullName.trim(), role: f.role, status: f.status };
    if (f.password) {
      const salt = randomSalt();
      const passwordHash = await hashPassword(f.password, salt);
      patch = { ...patch, salt, passwordHash };
    }
    setData(prev => ({ ...prev, users: prev.users.map(u => u.id===existing.id ? { ...u, ...patch } : u) }));
    if (currentUser && currentUser.id === existing.id) setCurrentUser(prev => ({ ...prev, ...patch }));
  };
  const deleteUser = (user) => setData(prev => ({ ...prev, users: prev.users.filter(u=>u.id!==user.id) }));

  const caps = currentUser ? getCapabilities(currentUser.role) : getCapabilities('Read-only User');

  /* ---- Dark mode: reflect settings.darkMode onto the document root ---- */
  useEffect(() => {
    if (!data) return;
    document.documentElement.classList.toggle('dark', !!data.settings.darkMode);
  }, [data && data.settings.darkMode]);

  const titles = {
    dashboard: ['Dashboard', 'Overview of your school finances'],
    students: ['Students', 'Manage student records and fee status'],
    income: ['Income', 'Fees, donations, and all income sources'],
    expenses: ['Expenses', 'Salaries, bills, and all expenditures'],
    salary: ['Salary', 'Employees, payroll, and salary slips'],
    transport: ['Transport', 'Vehicles, drivers, and running costs'],
    documents: ['Documents', 'Certificates, result cards, and issued paperwork'],
    fines: ['Fines', 'Late fee, discipline, library, and custom fines'],
    reports: ['Reports', 'Generate financial reports and statements'],
    settings: ['Settings', 'School info, categories, users, and backup'],
  };

  if (!loaded || !data) return <LoadingScreen />;
  if (data.users.length === 0) return <SetupScreen schoolName={data.settings.schoolName} onCreateAdmin={createFirstAdmin} />;
  if (!currentUser) return <LoginScreen schoolName={data.settings.schoolName} onLogin={login} />;

  return (
    <div className="min-h-screen flex">
      <Sidebar tab={tab} setTab={setTab} settings={data.settings} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} caps={caps} currentUser={currentUser} onLogout={logout} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar setMobileOpen={setMobileOpen} title={titles[tab][0]} subtitle={titles[tab][1]} darkMode={!!data.settings.darkMode} onToggleDark={()=>updateSettings({ darkMode: !data.settings.darkMode })} />
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto">
          {tab==='dashboard' && <Dashboard data={data} setTab={setTab} />}
          {tab==='students' && <StudentsModule data={data} addStudent={addStudent} updateStudent={updateStudent} deleteStudent={deleteStudent} openIncomeFormFor={openIncomeFormFor} caps={caps} />}
          {tab==='income' && <IncomeModule data={data} addIncome={addIncome} updateIncome={updateIncome} deleteIncome={deleteIncome} prefillFor={incomePrefill} clearPrefill={()=>setIncomePrefill(null)} caps={caps} />}
          {tab==='expenses' && <ExpensesModule data={data} addExpense={addExpense} updateExpense={updateExpense} deleteExpense={deleteExpense} caps={caps} />}
          {tab==='salary' && <SalaryModule data={data} addEmployee={addEmployee} updateEmployee={updateEmployee} deleteEmployee={deleteEmployee} paySalary={paySalary} deleteSalaryPayment={deleteSalaryPayment} caps={caps} />}
          {tab==='transport' && <TransportModule data={data} addVehicle={addVehicle} updateVehicle={updateVehicle} deleteVehicle={deleteVehicle} caps={caps} />}
          {tab==='documents' && <DocumentsModule data={data} issueDocument={issueDocument} deleteDocument={deleteDocument} caps={caps} />}
          {tab==='fines' && <FinesModule data={data} imposeFine={imposeFine} collectFine={collectFine} deleteFine={deleteFine} caps={caps} />}
          {tab==='reports' && <ReportsModule data={data} />}
          {tab==='settings' && caps.canAccessSettings && <SettingsModule data={data} updateSettings={updateSettings} importData={importData} resetData={resetData} caps={caps} currentUser={currentUser} onAddUser={addUser} onUpdateUser={updateUser} onDeleteUser={deleteUser} />}
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
