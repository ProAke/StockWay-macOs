import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Archive,
  ArrowDown,
  ArrowDownRight,
  ArrowDownUp,
  ArrowRight,
  ArrowUp,
  Bell,
  Box,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  House,
  ImagePlus,
  LayoutGrid,
  MapPin,
  Menu,
  Package,
  Plus,
  QrCode,
  ScanLine,
  Search,
  Settings,
  SlidersHorizontal,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import "@fontsource-variable/noto-sans-thai";
import "@fontsource-variable/inter";
import {
  boxFromScan,
  categories,
  conditions,
  daysStored,
  formatDate,
  localInput,
  safeRead,
  seedBoxes,
  seedItems,
  status,
  statuses,
} from "./model";
import "./style.css";

const navs = [
  ["home", "ภาพรวม", LayoutGrid],
  ["items", "ของทั้งหมด", Package],
  ["boxes", "กล่องจัดเก็บ", Archive],
  ["alerts", "การแจ้งเตือน", Bell],
  ["settings", "ตั้งค่า", Settings],
];
const assets = "/assets/";
const Badge = ({ type }) => (
  <span className={`badge ${type}`}>
    <i />
    {statuses[type]}
  </span>
);
function Photo({ item }) {
  return item.photo ? (
    <img className="thumb" src={item.photo} alt="" />
  ) : (
    <span className="thumb placeholder">
      <Package size={21} />
    </span>
  );
}
function App() {
  const [items, setItems] = useState(() =>
    safeRead("stockway.items", seedItems()),
  );
  const [boxes, setBoxes] = useState(() =>
    safeRead("stockway.boxes", seedBoxes),
  );
  const [settings, setSettings] = useState(() =>
    safeRead("stockway.settings", { lead: 15, desktop: false }),
  );
  const [now, setNow] = useState(Date.now);
  const [view, setView] = useState("home");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [filter, setFilter] = useState("");
  const [boxFilter, setBoxFilter] = useState("");
  const [older, setOlder] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [mobile, setMobile] = useState(false);
  const notified = useRef(new Set(safeRead("stockway.notified", [])));
  const priorAlerts = useRef(null);
  const notificationWorker = useRef(null);
  const boxMap = useMemo(
    () => Object.fromEntries(boxes.map((b) => [b.id, b])),
    [boxes],
  );
  const alerts = items
    .filter((i) => ["soon", "expired"].includes(status(i, now)))
    .sort(
      (a, b) =>
        (status(a, now) === "expired") - (status(b, now) === "expired") ||
        new Date(a.expiry) - new Date(b.expiry),
    );
  const counts = {
    soon: alerts.filter((i) => status(i, now) === "soon").length,
    expired: alerts.filter((i) => status(i, now) === "expired").length,
  };
  useEffect(() => {
    try {
      if (localStorage.getItem("stockway.items") === null)
        localStorage.setItem("stockway.items", JSON.stringify(items));
    } catch {
      /* browsing with storage disabled */
    }
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3800);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      notificationWorker.current = navigator.serviceWorker
        .register("/notifications.js")
        .catch(() => null);
  }, []);
  useEffect(() => {
    const soon = items.filter((i) => status(i, now) === "soon");
    const warnKey = (i) => `${i.id}:${i.expiry}:${i.reminder}`;
    const current = new Set(soon.map(warnKey));
    if (priorAlerts.current) {
      const added = soon.filter((i) => !priorAlerts.current.has(warnKey(i)));
      if (added.length)
        setToast(
          added.length === 1
            ? `${added[0].name} ใกล้หมดอายุ`
            : `มีสิ่งของใกล้หมดอายุ ${added.length} รายการ`,
        );
    }
    priorAlerts.current = current;
    if (
      !settings.desktop ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;
    soon.forEach((i) => {
      const key = warnKey(i);
      if (notified.current.has(key)) return;
      notified.current.add(key);
      const title = "StockWay · ของใกล้หมดอายุ";
      const options = {
        body: `${i.name} · ${i.boxId} · ${formatDate(i.expiry)}`,
        tag: key,
        icon: "/stockway.svg",
      };
      (async () => {
        try {
          const worker = await notificationWorker.current;
          if (worker?.active) await worker.showNotification(title, options);
          else new Notification(title, options);
          const liveKeys = items.filter((item) => item.expiry).map(warnKey);
          try {
            localStorage.setItem(
              "stockway.notified",
              JSON.stringify(liveKeys.filter((k) => notified.current.has(k))),
            );
          } catch {
            /* keep session-specific deduplication */
          }
        } catch {
          /* in-app warning still available */
        }
      })();
    });
  }, [items, now, settings.desktop]);
  useEffect(() => {
    const id = boxFromScan(window.location.href);
    if (id && boxMap[id]) {
      setView("items");
      setBoxFilter(id);
    } else if (id) {
      setToast(`ไม่พบกล่อง ${id} ในเบราว์เซอร์นี้`);
    }
  }, []);
  function save(key, value, setter, message) {
    try {
      localStorage.setItem(`stockway.${key}`, JSON.stringify(value));
      setter(value);
      return true;
    } catch {
      setToast(message || "บันทึกไม่ได้ พื้นที่จัดเก็บในเบราว์เซอร์อาจเต็ม");
      return false;
    }
  }
  function go(next) {
    setView(next);
    setMobile(false);
    setQuery("");
    setCategory("");
    setFilter("");
    setBoxFilter("");
    setOlder(false);
    window.scrollTo(0, 0);
  }
  function openBox(id) {
    go("items");
    setBoxFilter(id);
    setModal(null);
  }
  async function toggleNotifications() {
    if (settings.desktop) {
      save("settings", { ...settings, desktop: false }, setSettings);
      return;
    }
    if (!("Notification" in window)) {
      setToast("เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนบนอุปกรณ์");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      if (result === "granted")
        save("settings", { ...settings, desktop: true }, setSettings);
      else setToast("ยังไม่ได้รับอนุญาตให้ส่งการแจ้งเตือน");
    } catch {
      setToast("เปิดการแจ้งเตือนบนอุปกรณ์ไม่ได้");
    }
  }
  const visible = items
    .filter((i) => {
      const b = boxMap[i.boxId];
      return (
        (!query ||
          [i.name, i.category, i.condition, i.boxId, b?.name, b?.room, b?.spot]
            .join(" ")
            .toLowerCase()
            .includes(query.trim().toLowerCase())) &&
        (!category || i.category === category) &&
        (!filter || status(i, now) === filter) &&
        (!boxFilter || i.boxId === boxFilter)
      );
    })
    .sort(
      (a, b) =>
        (older ? 1 : -1) * (new Date(a.registered) - new Date(b.registered)),
    );
  const shown =
    view === "home" && !query && !category && !filter
      ? visible.slice(0, 4)
      : visible;
  const addItem = () =>
    setModal(
      boxes.length
        ? { type: "itemForm", defaultBox: boxFilter }
        : { type: "boxForm" },
    );
  const statusCard = (Icon, label, value, theme, click) => (
    <button className="stat" onClick={click}>
      <span className={`stat-icon ${theme}`}>
        <Icon size={21} />
      </span>
      <span className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
      <ArrowDownRight size={15} className="stat-arrow" />
    </button>
  );
  const empty = (text = "ไม่พบสิ่งของที่ตรงกัน") => (
    <div className="empty">
      <Package size={26} />
      <span>{text}</span>
    </div>
  );
  function itemList() {
    return (
      <section className="inventory">
        <div className="section-heading">
          <div>
            <h2>
              {boxFilter
                ? boxMap[boxFilter]?.name || boxFilter
                : "รายการสิ่งของ"}
            </h2>
            <p>
              {boxFilter
                ? `${boxFilter} · ${boxMap[boxFilter]?.room} / ${boxMap[boxFilter]?.spot}`
                : "ค้นหาและดูตำแหน่งของที่เก็บไว้ในบ้าน"}
            </p>
          </div>
          {view === "home" && (
            <button className="text-btn" onClick={() => go("items")}>
              ดูทั้งหมด <ArrowRight size={16} />
            </button>
          )}
          {boxFilter && (
            <button className="text-btn" onClick={() => setBoxFilter("")}>
              ล้างตัวกรอง <X size={16} />
            </button>
          )}
        </div>
        <div className="inventory-card">
          <div className="tools">
            <label className="search">
              <Search size={18} />
              <input
                aria-label="ค้นหาสิ่งของ"
                placeholder="ค้นหาสิ่งของ, รหัสกล่อง, ตำแหน่ง..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button aria-label="ล้างการค้นหา" onClick={() => setQuery("")}>
                  <X size={15} />
                </button>
              )}
            </label>
            <label className="select-tools">
              <SlidersHorizontal size={16} />
              <select
                aria-label="หมวดหมู่"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">ทุกหมวดหมู่</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
            <button
              className={`square sort ${older ? "active" : ""}`}
              title={older ? "เก่าสุดก่อน" : "ใหม่สุดก่อน"}
              aria-label="สลับลำดับรายการ"
              aria-pressed={older}
              onClick={() => setOlder(!older)}
            >
              <ArrowDownUp size={17} />
            </button>
          </div>
          {view === "items" && (
            <div className="item-filters">
              <label>
                สถานะ{" "}
                <select
                  aria-label="กรองสถานะ"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">ทั้งหมด</option>
                  {Object.entries(statuses).map(([k, v]) => (
                    <option value={k} key={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                กล่อง{" "}
                <select
                  aria-label="กรองกล่อง"
                  value={boxFilter}
                  onChange={(e) => setBoxFilter(e.target.value)}
                >
                  <option value="">ทั้งหมด</option>
                  {boxes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id} · {b.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="table-head inventory-grid">
            <span>
              สิ่งของ {older ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            </span>
            <span>กล่อง / ตำแหน่ง</span>
            <span>สถานะ</span>
            <span />
          </div>
          {shown.length
            ? shown.map((item) => {
                const b = boxMap[item.boxId];
                return (
                  <button
                    className="item-row inventory-grid"
                    key={item.id}
                    onClick={() => setModal({ type: "detail", item })}
                  >
                    <span className="item-ident">
                      <Photo item={item} />
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.category}</small>
                      </span>
                    </span>
                    <span className="location">
                      <strong>
                        <Box size={14} />
                        {item.boxId}
                      </strong>
                      <small>
                        {b?.room} · {b?.spot}
                      </small>
                    </span>
                    <span className="item-state">
                      <Badge type={status(item, now)} />
                      <small>เก็บมา {daysStored(item, now)} วัน</small>
                    </span>
                    <ChevronRight size={16} className="row-arrow" />
                  </button>
                );
              })
            : empty()}
          <div className="table-foot">
            แสดง {shown.length} จาก {visible.length} รายการ
          </div>
        </div>
      </section>
    );
  }
  function alertList(full = false) {
    return (
      <div className="alert-card">
        {alerts.length
          ? (full ? alerts : alerts.slice(0, 3)).map((i) => {
              const kind = status(i, now);
              return (
                <button
                  key={i.id}
                  className="alert-row"
                  onClick={() => setModal({ type: "detail", item: i })}
                >
                  <span className={`alert-icon ${kind}`}>
                    {kind === "soon" ? (
                      <Clock3 size={18} />
                    ) : (
                      <CircleAlert size={18} />
                    )}
                  </span>
                  <span className="alert-copy">
                    <strong>{i.name}</strong>
                    <small>
                      {i.boxId} <span>·</span> {boxMap[i.boxId]?.room}
                    </small>
                    <b className={kind}>
                      {kind === "soon"
                        ? `หมดอายุใน ${Math.ceil((new Date(i.expiry) - now) / 60000)} นาที`
                        : "หมดอายุแล้ว"}
                    </b>
                  </span>
                  <ChevronRight size={15} className="row-arrow" />
                </button>
              );
            })
          : empty("ไม่มีรายการที่ต้องแจ้งเตือน")}
        {!full && (
          <button className="alert-footer" onClick={() => go("alerts")}>
            ดูการแจ้งเตือนทั้งหมด <ArrowRight size={15} />
          </button>
        )}
      </div>
    );
  }
  const message = toast && (
    <div role="status" className="toast">
      <CircleAlert size={19} />
      {toast}
      <button aria-label="ปิดข้อความ" onClick={() => setToast("")}>
        <X size={17} />
      </button>
    </div>
  );
  return (
    <div className="shell">
      {mobile && (
        <button
          className="scrim"
          aria-label="ปิดเมนู"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <button className="brand" onClick={() => go("home")}>
          <img src="/stockway.svg" alt="" />
          <span>
            <strong>
              Stock<span>Way</span>
            </strong>
            <small>จัดเก็บของในบ้าน</small>
          </span>
        </button>
        <div className="menu-label">เมนูหลัก</div>
        <nav>
          {navs.map(([id, label, Icon]) => (
            <button
              key={id}
              className={`nav-link ${view === id ? "current" : ""}`}
              onClick={() => go(id)}
              aria-current={view === id ? "page" : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "alerts" && alerts.length > 0 && <b>{alerts.length}</b>}
            </button>
          ))}
        </nav>
        <div className="home-profile">
          <span>
            <House size={17} />
          </span>
          <div>
            <strong>บ้านของฉัน</strong>
            <small>พื้นที่จัดเก็บส่วนตัว</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="square mobile-menu"
              aria-label="เปิดเมนู"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <House size={16} />
            <span>บ้านของฉัน</span>
            <ChevronRight size={13} />
            <strong>{navs.find((n) => n[0] === view)[1]}</strong>
          </div>
          <div className="header-actions">
            <button
              className="square header-bell"
              aria-label="การแจ้งเตือน"
              onClick={() => go("alerts")}
            >
              <Bell size={19} />
              {alerts.length > 0 && <i />}
            </button>
            <button className="button primary" onClick={addItem}>
              <Plus size={19} /> เพิ่มสิ่งของ
            </button>
          </div>
        </header>
        <main className="page">
          {view === "home" && (
            <>
              <section className="hero">
                <div className="hero-art" aria-hidden="true" />
                <div className="hero-content">
                  <div className="hero-tag">
                    <House size={14} /> พื้นที่จัดเก็บของฉัน
                  </div>
                  <h1>จัดบ้านให้เป็นระเบียบ</h1>
                  <p>รู้ว่าของอยู่กล่องไหน วางไว้ตรงไหน และหมดอายุเมื่อไหร่</p>
                  <button
                    className="button hero-btn"
                    onClick={() => setModal({ type: "scan" })}
                  >
                    <ScanLine size={17} /> สแกน QR กล่อง
                  </button>
                </div>
              </section>
              <div className="stats">
                {statusCard(
                  Package,
                  "สิ่งของทั้งหมด",
                  items.length,
                  "mint",
                  () => go("items"),
                )}
                {statusCard(Archive, "กล่องจัดเก็บ", boxes.length, "blue", () =>
                  go("boxes"),
                )}
                {statusCard(Clock3, "ใกล้หมดอายุ", counts.soon, "amber", () => {
                  go("items");
                  setFilter("soon");
                })}
                {statusCard(
                  CircleAlert,
                  "หมดอายุแล้ว",
                  counts.expired,
                  "rose",
                  () => {
                    go("items");
                    setFilter("expired");
                  },
                )}
              </div>
              <div className="board">
                {itemList()}
                <aside className="board-side">
                  <section>
                    <div className="section-heading">
                      <div>
                        <h2>
                          การแจ้งเตือน{" "}
                          {alerts.length > 0 && (
                            <span className="count">{alerts.length}</span>
                          )}
                        </h2>
                        <p>สิ่งของที่ต้องตรวจสอบ</p>
                      </div>
                    </div>
                    {alertList()}
                  </section>
                  <section className="qr-card">
                    <span className="qr-icon">
                      <QrCode size={24} />
                    </span>
                    <div>
                      <h3>ค้นหาด้วย QR Code</h3>
                      <p>สแกนเพื่อดูของในกล่องได้ทันที</p>
                    </div>
                    <button
                      className="square"
                      aria-label="สแกน QR Code"
                      onClick={() => setModal({ type: "scan" })}
                    >
                      <ArrowRight size={18} />
                    </button>
                  </section>
                </aside>
              </div>
            </>
          )}
          {view === "items" && itemList()}
          {view === "boxes" && (
            <section>
              <div className="section-heading">
                <div>
                  <h1>กล่องจัดเก็บ</h1>
                  <p>จัดการรหัสกล่องและตำแหน่งที่วางภายในบ้าน</p>
                </div>
                <div className="inline">
                  <button
                    className="button"
                    onClick={() => setModal({ type: "scan" })}
                  >
                    <ScanLine size={17} /> สแกน QR
                  </button>
                  <button
                    className="button primary"
                    onClick={() => setModal({ type: "boxForm" })}
                  >
                    <Plus size={17} /> เพิ่มกล่อง
                  </button>
                </div>
              </div>
              <div className="box-grid">
                {boxes.map((b) => (
                  <article className="box-card" key={b.id}>
                    <div className="inline">
                      <span className="stat-icon mint">
                        <Archive size={23} />
                      </span>
                      <span className="box-code">{b.id}</span>
                    </div>
                    <h2>{b.name}</h2>
                    <p>
                      <MapPin size={16} /> {b.room} · {b.spot}
                    </p>
                    <p>
                      {items.filter((i) => i.boxId === b.id).length} สิ่งของ
                    </p>
                    <div className="box-actions">
                      <button
                        className="button"
                        onClick={() => setModal({ type: "qr", box: b })}
                      >
                        <QrCode size={17} /> QR Code
                      </button>
                      <button
                        className="text-btn"
                        onClick={() => openBox(b.id)}
                      >
                        ดูของในกล่อง <ArrowRight size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {!boxes.length && empty("ยังไม่มีกล่องจัดเก็บ")}
            </section>
          )}
          {view === "alerts" && (
            <section className="narrow">
              <div className="section-heading">
                <div>
                  <h1>การแจ้งเตือน</h1>
                  <p>ตรวจสอบสิ่งของที่ใกล้หมดอายุหรือหมดอายุแล้ว</p>
                </div>
                <button className="button" onClick={() => go("settings")}>
                  <Settings size={16} /> ตั้งค่า
                </button>
              </div>
              {alertList(true)}
            </section>
          )}
          {view === "settings" && (
            <section className="narrow">
              <div className="section-heading">
                <div>
                  <h1>ตั้งค่า</h1>
                  <p>ปรับการแจ้งเตือนสำหรับพื้นที่จัดเก็บของคุณ</p>
                </div>
              </div>
              <div className="settings-card">
                <label>
                  <span>
                    <strong>เวลาเตือนเริ่มต้น</strong>
                    <small>
                      สำหรับสิ่งของที่เพิ่มใหม่ สามารถเปลี่ยนได้ทีละรายการ
                    </small>
                  </span>
                  <select
                    value={settings.lead}
                    onChange={(e) =>
                      save(
                        "settings",
                        { ...settings, lead: Number(e.target.value) },
                        setSettings,
                      )
                    }
                  >
                    <option value="10">10 นาที</option>
                    <option value="15">15 นาที</option>
                  </select>
                </label>
                <div className="setting-line">
                  <span>
                    <strong>แจ้งเตือนบนอุปกรณ์</strong>
                    <small>ต้องอนุญาตในเบราว์เซอร์และเปิดแอปค้างไว้</small>
                  </span>
                  <button className="button" onClick={toggleNotifications}>
                    {settings.desktop ? "ปิดการแจ้งเตือน" : "เปิดการแจ้งเตือน"}
                  </button>
                </div>
                <p>ข้อมูลเก็บในเบราว์เซอร์นี้ ไม่ได้ซิงก์ข้ามอุปกรณ์</p>
              </div>
            </section>
          )}
        </main>
      </div>
      {modal && (
        <Dialog modal={modal} close={() => setModal(null)}>
          {modal.type === "itemForm" && (
            <ItemForm
              item={modal.item}
              boxes={boxes}
              lead={settings.lead}
              defaultBox={modal.defaultBox}
              onSave={(item) => {
                if (
                  save(
                    "items",
                    modal.item
                      ? items.map((i) => (i.id === item.id ? item : i))
                      : [item, ...items],
                    setItems,
                  )
                ) {
                  setModal(null);
                  setToast("บันทึกสิ่งของแล้ว");
                }
              }}
            />
          )}
          {modal.type === "boxForm" && (
            <BoxForm
              box={modal.box}
              boxes={boxes}
              onSave={(b) => {
                if (
                  save(
                    "boxes",
                    modal.box
                      ? boxes.map((x) => (x.id === b.id ? b : x))
                      : [...boxes, b],
                    setBoxes,
                  )
                ) {
                  setModal({ type: "qr", box: b });
                  setToast("บันทึกกล่องแล้ว");
                }
              }}
            />
          )}
          {modal.type === "detail" && (
            <ItemDetail
              item={modal.item}
              box={boxMap[modal.item.boxId]}
              now={now}
              edit={() => setModal({ type: "itemForm", item: modal.item })}
              remove={() => setModal({ type: "delete", item: modal.item })}
              openBox={openBox}
            />
          )}
          {modal.type === "delete" && (
            <>
              <p>ต้องการนำ “{modal.item.name}” ออกจากรายการหรือไม่?</p>
              <div className="modal-actions">
                <button
                  className="button"
                  onClick={() => setModal({ type: "detail", item: modal.item })}
                >
                  ยกเลิก
                </button>
                <button
                  className="button danger"
                  onClick={() => {
                    if (
                      save(
                        "items",
                        items.filter((i) => i.id !== modal.item.id),
                        setItems,
                      )
                    ) {
                      setModal(null);
                      setToast("ลบสิ่งของแล้ว");
                    }
                  }}
                >
                  ยืนยันการลบ
                </button>
              </div>
            </>
          )}
          {modal.type === "qr" && (
            <BoxQR
              box={modal.box}
              edit={() => setModal({ type: "boxForm", box: modal.box })}
              openBox={openBox}
            />
          )}
          {modal.type === "scan" && <Scan openBox={openBox} boxMap={boxMap} />}
          {message}
        </Dialog>
      )}
      {!modal && message}
    </div>
  );
}
const modalTitles = {
  itemForm: "เพิ่มสิ่งของ",
  boxForm: "เพิ่มกล่องจัดเก็บ",
  detail: "รายละเอียดสิ่งของ",
  delete: "ลบสิ่งของ",
  qr: "QR Code ประจำกล่อง",
  scan: "สแกน QR กล่อง",
};
function Dialog({ modal, close, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el.close();
      document.body.style.overflow = previous;
    };
  }, []);
  const title =
    modal.item && modal.type === "itemForm"
      ? "แก้ไขสิ่งของ"
      : modal.box && modal.type === "boxForm"
        ? "แก้ไขกล่องจัดเก็บ"
        : modalTitles[modal.type];
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <div className="modal-head">
        <h2 id="dialog-title">{title}</h2>
        <button className="square" aria-label="ปิด" onClick={close}>
          <X size={20} />
        </button>
      </div>
      <div className="modal-body" key={modal.type}>
        {children}
      </div>
    </dialog>
  );
}
function imageData(file, size) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file),
      img = new Image();
    img.onload = () => {
      try {
        const factor = Math.min(1, size / Math.max(img.width, img.height)),
          canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * factor));
        canvas.height = Math.max(1, Math.round(img.height * factor));
        const cx = canvas.getContext("2d", { willReadFrequently: true });
        cx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve({ canvas, cx });
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("invalid image"));
    };
    img.src = url;
  });
}
function ItemForm({ item, boxes, lead, defaultBox, onSave }) {
  const [data, setData] = useState(() => ({
    name: item?.name || "",
    category: item?.category || categories[0],
    boxId: item?.boxId || defaultBox || boxes[0]?.id || "",
    condition: item?.condition || conditions[0],
    registered: localInput(item?.registered),
    start: localInput(item?.start),
    expiry: item?.expiry ? localInput(item.expiry) : "",
    reminder: item?.reminder || lead,
    notes: item?.notes || "",
    photo: item?.photo || "",
  }));
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (field, value) => setData((d) => ({ ...d, [field]: value }));
  const field = (key) => ({
    value: data[key],
    onChange: (e) => set(key, e.target.value),
  });
  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setErr("");
    setLoading(true);
    try {
      const { canvas } = await imageData(file, 650);
      set("photo", canvas.toDataURL("image/jpeg", 0.82));
    } catch {
      setErr("ไม่สามารถเปิดภาพนี้ได้ โปรดลองใช้ภาพ JPG หรือ PNG");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }
  function submit(e) {
    e.preventDefault();
    if (!data.name.trim()) return setErr("โปรดระบุชื่อสิ่งของ");
    if (data.expiry && new Date(data.expiry) <= new Date(data.start))
      return setErr("วันหมดอายุต้องอยู่หลังวันเริ่มเก็บ");
    onSave({
      ...data,
      id: item?.id || crypto.randomUUID(),
      name: data.name.trim(),
      registered: new Date(data.registered).toISOString(),
      start: new Date(data.start).toISOString(),
      expiry: data.expiry ? new Date(data.expiry).toISOString() : "",
      reminder: Number(data.reminder),
    });
  }
  return (
    <form onSubmit={submit} className="form">
      <div className="photo-picker">
        {data.photo ? (
          <img alt="รูปสิ่งของ" src={data.photo} />
        ) : (
          <span>
            <ImagePlus size={25} />
          </span>
        )}
        <div>
          <strong>รูปสิ่งของ</strong>
          <small>
            {loading ? "กำลังโหลดรูป…" : "ถ่ายรูปหรือเลือกภาพจากอุปกรณ์"}
          </small>
          <div className="inline">
            <label className="button file-button">
              <Camera size={16} /> ถ่ายรูป
              <input
                aria-label="ถ่ายรูปสิ่งของ"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={upload}
              />
            </label>
            <label className="button file-button">
              เลือกภาพ
              <input
                aria-label="เลือกภาพสิ่งของ"
                type="file"
                accept="image/*"
                onChange={upload}
              />
            </label>
            {data.photo && (
              <button
                type="button"
                className="text-btn"
                onClick={() => set("photo", "")}
              >
                นำรูปออก
              </button>
            )}
          </div>
        </div>
      </div>
      <label>
        ชื่อสิ่งของ
        <input
          required
          maxLength={100}
          placeholder="เช่น เมล็ดกาแฟคั่ว"
          {...field("name")}
        />
      </label>
      <div className="form-grid">
        <label>
          หมวดหมู่
          <select aria-label="หมวดหมู่" {...field("category")}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          สภาพของ
          <select aria-label="สภาพของ" {...field("condition")}>
            {conditions.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        กล่องจัดเก็บ
        <select aria-label="กล่องจัดเก็บ" {...field("boxId")} required>
          {boxes.map((b) => (
            <option key={b.id} value={b.id}>
              {b.id} · {b.name} · {b.room}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        <label>
          วันและเวลาลงทะเบียน
          <input required type="datetime-local" {...field("registered")} />
        </label>
        <label>
          วันและเวลาเริ่มเก็บ
          <input required type="datetime-local" {...field("start")} />
        </label>
        <label>
          วันและเวลาหมดอายุ
          <input type="datetime-local" {...field("expiry")} />
        </label>
        <label>
          เตือนก่อนหมดอายุ
          <select aria-label="เตือนก่อนหมดอายุ" {...field("reminder")}>
            <option value="10">10 นาที</option>
            <option value="15">15 นาที</option>
          </select>
        </label>
      </div>
      <label>
        หมายเหตุ
        <textarea
          rows="2"
          placeholder="บันทึกเพิ่มเติม (ไม่บังคับ)"
          maxLength={500}
          {...field("notes")}
        />
      </label>
      {err && (
        <p className="form-error" role="alert">
          {err}
        </p>
      )}
      <div className="modal-actions">
        <button className="button primary" disabled={loading} type="submit">
          <Check size={17} /> บันทึกสิ่งของ
        </button>
      </div>
    </form>
  );
}
function ItemDetail({ item, box, now, edit, remove, openBox }) {
  return (
    <>
      <div className="detail-top">
        <Photo item={item} />
        <div>
          <h3>{item.name}</h3>
          <p>{item.category}</p>
          <Badge type={status(item, now)} />
        </div>
      </div>
      <dl className="details">
        <div>
          <dt>กล่อง</dt>
          <dd>
            <button className="text-btn" onClick={() => openBox(item.boxId)}>
              {item.boxId} · {box?.name} <ArrowRight size={14} />
            </button>
          </dd>
        </div>
        <div>
          <dt>ตำแหน่ง</dt>
          <dd>
            {box?.room} · {box?.spot}
          </dd>
        </div>
        <div>
          <dt>สภาพของ</dt>
          <dd>{item.condition}</dd>
        </div>
        <div>
          <dt>ระยะเวลาที่เก็บ</dt>
          <dd>{daysStored(item, now)} วัน</dd>
        </div>
        <div>
          <dt>ลงทะเบียน</dt>
          <dd>{formatDate(item.registered)}</dd>
        </div>
        <div>
          <dt>เริ่มเก็บ</dt>
          <dd>{formatDate(item.start)}</dd>
        </div>
        <div>
          <dt>หมดอายุ</dt>
          <dd>{formatDate(item.expiry)}</dd>
        </div>
        {item.expiry && (
          <div>
            <dt>เตือนล่วงหน้า</dt>
            <dd>{item.reminder} นาที</dd>
          </div>
        )}
        {item.notes && (
          <div>
            <dt>หมายเหตุ</dt>
            <dd>{item.notes}</dd>
          </div>
        )}
      </dl>
      <div className="modal-actions">
        <button className="button danger-text" onClick={remove}>
          ลบสิ่งของ
        </button>
        <button className="button primary" onClick={edit}>
          แก้ไขสิ่งของ
        </button>
      </div>
    </>
  );
}
function BoxForm({ box, boxes, onSave }) {
  let next = 1;
  while (boxes.some((b) => b.id === `BOX-${String(next).padStart(3, "0")}`))
    next++;
  const [data, setData] = useState(
    box || {
      id: `BOX-${String(next).padStart(3, "0")}`,
      name: "",
      room: "",
      spot: "",
    },
  );
  const [err, setErr] = useState("");
  function submit(e) {
    e.preventDefault();
    const val = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v.trim()]),
    );
    val.id = val.id.toUpperCase();
    if (Object.values(val).some((v) => !v))
      return setErr("โปรดกรอกข้อมูลให้ครบ");
    if (!/^[A-Z0-9][A-Z0-9_-]{0,23}$/.test(val.id))
      return setErr("รหัสกล่องใช้ A–Z, 0–9, ขีดกลาง หรือขีดล่างเท่านั้น");
    if (!box && boxes.some((b) => b.id === val.id))
      return setErr("รหัสกล่องนี้ถูกใช้แล้ว");
    onSave(val);
  }
  return (
    <form className="form" onSubmit={submit}>
      {[
        ["id", "รหัสกล่อง", "BOX-006"],
        ["name", "ชื่อกล่อง", "เช่น กล่องเครื่องมือ"],
        ["room", "ห้อง", "เช่น ห้องเก็บของ"],
        ["spot", "ตำแหน่งที่วาง", "เช่น ชั้น 2 ด้านซ้าย"],
      ].map(([id, label, placeholder]) => (
        <label key={id}>
          {label}
          <input
            required
            maxLength={id === "id" ? 24 : 100}
            readOnly={id === "id" && !!box}
            value={data[id]}
            placeholder={placeholder}
            onChange={(e) => setData({ ...data, [id]: e.target.value })}
          />
        </label>
      ))}
      {err && (
        <p className="form-error" role="alert">
          {err}
        </p>
      )}
      <div className="modal-actions">
        <button className="button primary">
          <Check size={17} /> บันทึกกล่อง
        </button>
      </div>
    </form>
  );
}
function BoxQR({ box, edit, openBox }) {
  const [src, setSrc] = useState("");
  const [err, setErr] = useState(false);
  useEffect(() => {
    let active = true;
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set("box", box.id);
    QRCode.toDataURL(url.href, {
      width: 320,
      margin: 2,
      color: { dark: "#16392e", light: "#ffffff" },
    })
      .then((result) => {
        if (active) setSrc(result);
      })
      .catch(() => {
        if (active) setErr(true);
      });
    return () => {
      active = false;
    };
  }, [box.id]);
  return (
    <div className="qr-modal">
      <div className="qr-frame">
        {src ? (
          <img src={src} alt={`QR Code สำหรับ ${box.id}`} />
        ) : err ? (
          "ไม่สามารถสร้าง QR Code ได้"
        ) : (
          <QrCode size={40} />
        )}
      </div>
      <strong className="box-code">{box.id}</strong>
      <h3>{box.name}</h3>
      <p>
        {box.room} · {box.spot}
      </p>
      <div className="modal-actions centered">
        <button className="button" onClick={edit}>
          แก้ไขกล่อง
        </button>
        {src && (
          <a className="button" href={src} download={`${box.id}.png`}>
            ดาวน์โหลด QR
          </a>
        )}
        <button className="button primary" onClick={() => openBox(box.id)}>
          ดูของในกล่อง
        </button>
      </div>
    </div>
  );
}
function Scan({ openBox, boxMap }) {
  const [id, setId] = useState("");
  const [error, setError] = useState("");
  const [camera, setCamera] = useState(false);
  const video = useRef(null);
  function find(value) {
    const key = boxFromScan(value);
    if (boxMap[key]) {
      openBox(key);
      return true;
    }
    setError(`ไม่พบกล่อง${key ? " " + key : ""} ในเบราว์เซอร์นี้`);
    return false;
  }
  useEffect(() => {
    if (!camera) return;
    let live = true,
      stream,
      frame,
      last = 0;
    const c = document.createElement("canvas"),
      cx = c.getContext("2d", { willReadFrequently: true });
    const tick = (time) => {
      if (!live) return;
      const v = video.current;
      if (time - last > 180 && v?.readyState >= 2 && v.videoWidth) {
        last = time;
        c.width = Math.min(640, v.videoWidth);
        c.height = Math.round((v.videoHeight * c.width) / v.videoWidth);
        cx.drawImage(v, 0, 0, c.width, c.height);
        const pixels = cx.getImageData(0, 0, c.width, c.height);
        const code = jsQR(pixels.data, c.width, c.height);
        if (code) {
          find(code.data);
          setCamera(false);
          return;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!live) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.current.srcObject = stream;
        await video.current.play();
        if (live) frame = requestAnimationFrame(tick);
      } catch {
        if (live) {
          setError("เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้อง หรือเลือกภาพ QR");
          setCamera(false);
        }
      }
    }
    start();
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera]);
  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setCamera(false);
    setError("");
    try {
      const { canvas, cx } = await imageData(file, 1200),
        pixels = cx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(pixels.data, canvas.width, canvas.height);
      if (code) find(code.data);
      else setError("ไม่พบ QR Code ในภาพ กรุณาลองภาพที่ชัดขึ้น");
    } catch {
      setError("เปิดภาพไม่ได้");
    } finally {
      e.target.value = "";
    }
  }
  return (
    <div className="form">
      <div className="scan-preview">
        {camera ? (
          <video ref={video} muted playsInline />
        ) : (
          <ScanLine size={49} />
        )}
      </div>
      <div className="inline">
        <button
          className="button"
          onClick={() => {
            setError("");
            setCamera(!camera);
          }}
        >
          <Camera size={17} /> {camera ? "ปิดกล้อง" : "เปิดกล้อง"}
        </button>
        <label className="button file-button">
          <ImagePlus size={17} /> เลือกภาพ QR
          <input
            aria-label="เลือกภาพ QR"
            type="file"
            accept="image/*"
            onChange={upload}
          />
        </label>
      </div>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          find(id);
        }}
      >
        <label>
          หรือกรอกรหัสกล่อง
          <input
            value={id}
            required
            placeholder="เช่น BOX-001"
            onChange={(e) => {
              setId(e.target.value);
              setError("");
            }}
          />
        </label>
        <button className="button primary">
          <Search size={17} /> ค้นหากล่อง
        </button>
      </form>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
