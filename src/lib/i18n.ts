import { cookies } from "next/headers";

export type Locale = "en" | "ar";
export const LOCALE_COOKIE = "sms_locale";

const dict = {
  en: {
    appName: "Dubai School Manager",
    dashboard: "Dashboard",
    students: "Students",
    admissions: "Admissions",
    staff: "Staff",
    academics: "Academics",
    attendance: "Attendance",
    assessments: "Assessments",
    fees: "Fees",
    compliance: "KHDA Compliance",
    settings: "Settings",
    portal: "Parent Portal",
    logout: "Sign out",
    login: "Sign in",
    email: "Email",
    password: "Password",
    welcome: "Welcome",
    save: "Save",
    cancel: "Cancel",
    search: "Search",
    actions: "Actions",
    status: "Status",
    grade: "Grade",
    section: "Section",
    name: "Name",
    date: "Date",
    amount: "Amount",
    total: "Total",
    language: "العربية",
  },
  ar: {
    appName: "مدير مدارس دبي",
    dashboard: "لوحة التحكم",
    students: "الطلاب",
    admissions: "القبول والتسجيل",
    staff: "الموظفون",
    academics: "الشؤون الأكاديمية",
    attendance: "الحضور",
    assessments: "التقييمات",
    fees: "الرسوم",
    compliance: "امتثال هيئة المعرفة",
    settings: "الإعدادات",
    portal: "بوابة أولياء الأمور",
    logout: "تسجيل الخروج",
    login: "تسجيل الدخول",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    welcome: "مرحباً",
    save: "حفظ",
    cancel: "إلغاء",
    search: "بحث",
    actions: "إجراءات",
    status: "الحالة",
    grade: "الصف",
    section: "الشعبة",
    name: "الاسم",
    date: "التاريخ",
    amount: "المبلغ",
    total: "الإجمالي",
    language: "English",
  },
} as const;

export type TKey = keyof (typeof dict)["en"];

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const v = store.get(LOCALE_COOKIE)?.value;
  return v === "ar" ? "ar" : "en";
}

export function translator(locale: Locale) {
  return (key: TKey): string => dict[locale][key] ?? dict.en[key];
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: translator(locale), dir: locale === "ar" ? "rtl" : "ltr" } as const;
}
