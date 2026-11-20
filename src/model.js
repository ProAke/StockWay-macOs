export const categories = [
  "อาหารและเครื่องดื่ม",
  "สุขภาพ",
  "อิเล็กทรอนิกส์",
  "เอกสาร",
  "ของใช้ในบ้าน",
  "อื่น ๆ",
];
export const conditions = ["สภาพดี", "พอใช้", "ชำรุด"];
const minute = 60_000;
const day = 1440 * minute;
export const seedBoxes = [
  {
    id: "BOX-001",
    name: "กล่องของแห้ง",
    room: "ห้องครัว",
    spot: "ตู้กับข้าว ชั้น 2",
  },
  { id: "BOX-002", name: "กล่องสุขภาพ", room: "ห้องนอน", spot: "ตู้ข้างเตียง" },
  {
    id: "BOX-003",
    name: "กล่องอุปกรณ์ไอที",
    room: "ห้องทำงาน",
    spot: "ลิ้นชักโต๊ะ ชั้นบน",
  },
  {
    id: "BOX-004",
    name: "กล่องเอกสาร",
    room: "ห้องทำงาน",
    spot: "ชั้นหนังสือ ชั้น 3",
  },
  {
    id: "BOX-005",
    name: "กล่องของใช้สำรอง",
    room: "ห้องเก็บของ",
    spot: "ชั้นวางด้านซ้าย",
  },
];
export function seedItems(now = Date.now()) {
  const make = (id, name, category, box, photo, age, expiry) => ({
    id,
    name,
    category: categories[category],
    boxId: `BOX-00${box}`,
    photo: `/assets/${photo}.webp`,
    registered: new Date(now - age * day).toISOString(),
    start: new Date(now - age * day).toISOString(),
    expiry: expiry == null ? "" : new Date(now + expiry * minute).toISOString(),
    condition: "สภาพดี",
    reminder: 15,
    notes: "",
  });
  return [
    make("i1", "เมล็ดกาแฟคั่ว", 0, 1, "coffee", 8, 12),
    make("i2", "ชุดปฐมพยาบาล", 1, 2, "aid", 14, -1440),
    make("i3", "สายชาร์จ USB-C", 2, 3, "cables", 21, null),
    make("i4", "เอกสารสำคัญ", 3, 4, "docs", 36, null),
    make("i5", "น้ำผึ้งแท้", 0, 1, "honey", 42, 1440 * 50),
    make("i6", "แผ่นกรองอากาศ", 4, 5, "filter", 63, 10),
  ];
}
export function status(item, now) {
  if (!item.expiry) return "none";
  const diff = new Date(item.expiry).getTime() - now;
  return diff <= 0
    ? "expired"
    : diff <= item.reminder * minute
      ? "soon"
      : "good";
}
export const statuses = {
  good: "ยังไม่หมดอายุ",
  none: "ไม่กำหนดวันหมดอายุ",
  soon: "ใกล้หมดอายุ",
  expired: "หมดอายุแล้ว",
};
export function localInput(value = new Date()) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * minute)
    .toISOString()
    .slice(0, 16);
}
export const formatDate = (v) =>
  v
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(v))
    : "ไม่ระบุ";
export const daysStored = (item, now) =>
  Math.max(
    0,
    Math.floor((now - new Date(item.start || item.registered).getTime()) / day),
  );
export function safeRead(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (value) return JSON.parse(value);
  } catch {
    /* start with default data */
  }
  return fallback;
}
export function boxFromScan(value) {
  const text = value.trim();
  try {
    return new URL(text).searchParams.get("box")?.trim().toUpperCase() || "";
  } catch {
    return text.toUpperCase();
  }
}
