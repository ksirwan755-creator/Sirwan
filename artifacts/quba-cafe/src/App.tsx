import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCafeData } from '@/lib/cafe-data';
import { getActiveEmployeeProfile, getActiveAdminProfile, isFirebaseConfigured, listenForAppAuth, ownerUid, signInOwner, signInEmployee, signInAdmin, signOutOwner, db } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  Activity, Archive, ArrowDownLeft, ArrowUpRight, Banknote, Boxes, BriefcaseBusiness, CalendarDays,
  ChevronDown, CircleAlert, ClipboardList, Coffee, CreditCard, FileBarChart2,
  Globe2, LayoutDashboard, LoaderCircle, LogOut, Menu, Moon, Sun, Pencil, Plus, Search, Settings2,
  Trash2, Users, Utensils, Wallet, X,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
type Locale = 'ku' | 'ar';
type RecordKind = 'categories' | 'products' | 'tables' | 'customers' | 'expenses';
type AnyRecord = Record<string, any>;

type TableStatus = 'available' | 'occupied' | 'reserved' | 'closed';
type OrderStatus = 'new' | 'preparing' | 'ready' | 'delivered' | 'paid' | 'cancelled';

const normalizeOrderStatus = (value?: string | null): OrderStatus => {
  if (['new', 'preparing', 'ready', 'delivered', 'paid', 'cancelled'].includes(String(value ?? ''))) return String(value) as OrderStatus;
  if (value === 'open') return 'new';
  if (value === 'pending') return 'preparing';
  if (value === 'completed') return 'delivered';
  return 'new';
};

const normalizeTableStatus = (value?: string | null, active?: boolean): TableStatus => {
  if (['available', 'occupied', 'reserved', 'closed'].includes(String(value ?? ''))) return String(value) as TableStatus;
  if (active === false) return 'closed';
  return 'available';
};

const getTableState = (table: AnyRecord | null | undefined): TableStatus => {
  if (!table) return 'available';
  return normalizeTableStatus(table.status, table.active);
};

function combineOrderItems(items: AnyRecord[] = []): AnyRecord[] {
  const grouped = new Map<string, AnyRecord>();
  for (const item of items) {
    const key = [item.productId || item.nameKu || item.nameAr || 'item', item.unitPriceIqd ?? 0, item.categoryId || ''].join('::');
    const existing = grouped.get(key);
    if (existing) existing.quantity = Number(existing.quantity || 0) + Number(item.quantity || 0);
    else grouped.set(key, { ...item, quantity: Number(item.quantity || 0) });
  }
  return Array.from(grouped.values());
}

const copy = {
  ku: {
    brand: 'QUBA', language: 'زمان', subbrand: 'کافێ و چێشتخانە',
    dashboard: 'پوختەی ڕۆژ', orders: 'داواکارییەکان', archive: 'ئەرشیفی داواکاری', archiveRemove: 'لابردن لە ئەرشیف', archiveConfirm: 'ئەم داواکارییە تەنها لە ئەرشیف دەشاردرێتەوە و لە ڕاپۆرتەکاندا دەمێنێتەوە. دڵنیایت؟', customers: 'کڕیارەکان', employees: 'کارمەندان', admins: 'بەڕێوەبەرەکان', expenses: 'خەرجییەکان', reports: 'ڕاپۆرتەکان', products: 'خواردنەکانی مێنیو', categories: 'جۆرەکان', tables: 'مێزەکان', service: 'بەشی خواردن و خواردنەوە',
    settings: 'ڕێکخستنی چێشتخانە', signOut: 'چوونەدەرەوە', owner: 'بەڕێوەبەری قوبە',
    today: 'ئەمڕۆ', revenue: 'داهاتی ئەمڕۆ', openOrders: 'داواکارییە چالاکەکان',
    tablesOccupied: 'مێزی بەکارهاتوو', costs: 'خەرجیی ئەمڕۆ', todayFlow: 'ڕەوتی ئەمڕۆ',
    recentOrders: 'دوایین داواکارییەکان', viewAll: 'بینینی هەموو', noOrders: 'هێشتا داواکارییەک نییە',
    startOrder: 'داواکارییەکان لێرە دەردەکەون کاتێک تۆمار کران.',
    tableNumber: 'مێزی ژمارە', closeTable: 'داخستنی مێز و بەتاڵکردنەوە', confirmCloseTable: 'دڵنیایت؟ مێزەکە بۆ کڕیاری نوێ بەردەست دەبێت و مێژووی داواکارییەکان دەمێنێتەوە.', tableClosedSuccess: 'مێزەکە بەردەستە بۆ کڕیاری نوێ', tableAddItems: 'زیادکردنی خواردن و خواردنەوە', tableCurrentOrder: 'داواکاریی ئێستا', tableNoOrder: 'ئەم مێزە بەتاڵە', tableBalance: 'ماوەی حیساب', tableTotal: 'کۆی داواکاری', tableAutoCreate: 'مێزەکان ئامادە دەکرێن...',
    backToTables: 'گەڕانەوە بۆ مێزەکان', tableHistory: 'هەموو داواکارییەکانی ئەم مێزە', currentBalance: 'کۆی پارەی ماوە', foodService: 'خواردن', beverageService: 'خواردنەوە', serviceTitle: 'داواکارییەکانی ئامادەکردن', noServiceItems: 'هیچ داواکارییەکی چالاک نییە',
    emptyTitle: 'هێشتا هیچ تۆمارێک نییە', emptyText: 'کاتێک تۆمارێک زیاد بکەیت، لێرە دەردەکەوێت.',
    add: 'زیادکردن', addItem: 'زیادکردنی بەرهەم', search: 'گەڕان', name: 'ناو', nameKu: 'ناو بە کوردی', nameAr: 'ناو بە عەرەبی',
    price: 'نرخ (دینار)', category: 'جۆر', foodCategory: 'خواردن', beverageCategory: 'خواردنەوە', seats: 'ژمارەی کورسی', label: 'ژمارە / ناونیشان',
    phone: 'ژمارەی تەلەفۆن', notes: 'تێبینی', titleKu: 'ناونیشان بە کوردی', titleAr: 'ناونیشان بە عەرەبی',
    expenseCategory: 'جۆری خەرجی', amount: 'بڕ (دینار)', date: 'بەروار', active: 'چالاک',
    actions: 'کردار', save: 'پاشەکەوتکردن', cancel: 'پاشگەزبوونەوە', edit: 'دەستکاریکردن',
    delete: 'سڕینەوە', deactivateProduct: 'ناچالاککردنی خواردن', confirmDeactivateProduct: 'ئەم خواردنە ناچالاک بکرێت؟ لە داواکارییە کۆنەکاندا دەمێنێتەوە.', confirmDelete: 'دڵنیایت لە سڕینەوەی ئەم تۆمارە؟', no: 'نەخێر', yesDelete: 'بەڵێ، بیسڕەوە',
    all: 'هەموو', open: 'کراوە', paid: 'پارەدراو', cancelled: 'هەڵوەشێنراوە', pending: 'ماوە',
    status: 'دۆخ', total: 'کۆی گشتی', table: 'مێز', customer: 'کڕیار', items: 'بەرهەم',
    created: 'کاتی تۆمارکردن', payment: 'پارەدان', addPayment: 'تۆمارکردنی پارەدان',
    paymentMethod: 'شێوازی پارەدان', cash: 'نەقد', card: 'کارت', other: 'تر',
    paidAmount: 'بڕی پارەدراو', cancelOrder: 'هەڵوەشاندنەوەی داواکاری', confirmCancelOrder: 'دڵنیایت لە هەڵوەشاندنەوەی ئەم داواکارە؟', newOrder: 'داواکارییەکی نوێ',
    quantity: 'دانە', noteOrder: 'تێبینی بۆ داواکاری', selectTable: 'مێز هەڵبژێرە',
    chooseProducts: 'بەرهەم هەڵبژێرە', createOrder: 'تۆمارکردنی داواکاری', noProducts: 'بەرهەمێک نییە بۆ داواکاری.',
    expense: 'خەرجی', noCategory: 'بێ جۆر', loading: 'تکایە چاوەڕێ بکە...', retry: 'دووبارە هەوڵبدەرەوە', ownerDesk: 'ئامرازی بەڕێوەبەر', close: 'داخستن',
    inactive: 'ناچالاک', firebaseMissing: 'بەستەری Firebase ئامادە نییە', firebaseExplain: 'ڕێکخستنی Firebase Web App و UIDی خاوەن وەک گۆڕاوەکان.',
    loginTitle: 'بەخێربێیتەوە', loginText: 'بچۆ ژوورەوە بۆ بەڕێوەبردنی ڕۆژانەی قوبە.', email: 'ئیمەیڵ',
    password: 'وشەی نهێنی', login: 'چوونەژوورەوە', loginError: 'چوونەژوورەوە سەرکەوتوو نەبوو. زانیارییەکانت بپشکنە.',
    logoutError: 'چوونەدەرەوە سەرکەوتوو نەبوو. دووبارە هەوڵ بدەرەوە.',
    notOwner: 'ئەم هەژمارە ڕێگەی چوونەژوورەوەی نییە.', reportTitle: 'ڕاپۆرتی بازرگانی',
    from: 'لە', to: 'بۆ', ordersCount: 'ژمارەی داواکاری', expensesCount: 'ژمارەی خەرجی', sortOrder: 'ڕیزبەندی',
    net: 'داهاتی پاک', restaurant: 'ناوی چێشتخانە', defaultLanguage: 'زمانی سەرەکی',
    saved: 'پاشەکەوت کرا', saveSettings: 'پاشەکەوتکردنی ڕێکخستن', serverError: 'هەڵەیەک ڕوویدا',
    firestoreDenied: 'دەستگەیشتن ڕەتکرایەوە؛ Firestore rules و هەژماری خاوەن بپشکنە.',
    firestoreReadWarning: 'نەتوانرا داتای Firestore بخوێندرێتەوە؛ هۆکار:',
    noResults: 'هیچ ئەنجامێک نەدۆزرایەوە', filterDate: 'پاڵاوتن بە بەروار', allOrders: 'هەموو داواکارییەکان',
    todayLabel: 'ئەمڕۆ', goodMorning: 'بەیانی باش', goodEvening: 'ئێوارە باش',
    tableAvailable: 'بەردەست', tableOccupied: 'بەکارھاتوو', tableReserved: 'پاشەڕگەز', tableClosed: 'داخراو',
    orderNew: 'نوێ', orderPreparing: 'ئامادەکردن', orderReady: 'ئامادە', orderDelivered: 'گەیاندرا', orderPaid: 'پارەدراو', orderCancelled: 'هەڵوەشێنراوە',
    statusFilter: 'فلتەرکردنی دۆخ', updateStatus: 'نوێکردنەوەی دۆخ', customerDetails: 'زانیارییەکانی کڕیار', customerName: 'ناوی کڕیار', customerPhone: 'تەلەفۆنی کڕیار',
    liveTables: 'مێزی ئێستا', activeOrders: 'داواکارییە چالاکەکان', unpaidOrders: 'داواکارییە نۆپارەدراوەکان', completedOrders: 'داواکارییە تەواوەکان',
    mostPopular: 'زۆرترین بەرهەم', weeklySales: 'فرۆشتنی هەفتەیی', monthlySales: 'فرۆشتنی مانگی', salesRange: 'مەودای فرۆشتن',
    noCustomer: 'کڕیار نەپێدراوە', tableState: 'دۆخی مێز', orderTime: 'کاتی داواکاری', paymentStatus: 'دۆخی پارەدان',
  },
  ar: {
    brand: 'QUBA', language: 'اللغة', subbrand: 'مقهى ومطعم',
    dashboard: 'ملخص اليوم', orders: 'الطلبات', archive: 'أرشيف الطلبات', archiveRemove: 'إخفاء من الأرشيف', archiveConfirm: 'سيتم إخفاء هذا الطلب من الأرشيف فقط، وسيبقى محفوظاً في التقارير. هل أنت متأكد؟', customers: 'الزبائن', employees: 'الموظفون', admins: 'المديرون', expenses: 'المصروفات', reports: 'التقارير', products: 'عناصر القائمة', categories: 'الفئات', tables: 'الطاولات', service: 'قسم الطعام والمشروبات',
    settings: 'إعدادات المطعم', signOut: 'تسجيل الخروج', owner: 'إدارة قوبا',
    today: 'اليوم', revenue: 'إيراد اليوم', openOrders: 'الطلبات النشطة',
    tablesOccupied: 'الطاولات المشغولة', costs: 'مصروفات اليوم', todayFlow: 'حركة اليوم',
    recentOrders: 'أحدث الطلبات', viewAll: 'عرض الكل', noOrders: 'لا توجد طلبات بعد',
    startOrder: 'ستظهر الطلبات هنا عند تسجيلها.',
    tableNumber: 'الطاولة رقم', closeTable: 'إنهاء الطاولة وإخلاؤها', confirmCloseTable: 'هل أنت متأكد؟ ستصبح الطاولة متاحة لزبون جديد وسيبقى سجل الطلبات محفوظاً.', tableClosedSuccess: 'أصبحت الطاولة متاحة لزبون جديد', tableAddItems: 'إضافة طعام ومشروبات', tableCurrentOrder: 'الطلب الحالي', tableNoOrder: 'هذه الطاولة فارغة', tableBalance: 'المبلغ المتبقي', tableTotal: 'إجمالي الطلب', tableAutoCreate: 'جارٍ تجهيز الطاولات...',
    backToTables: 'العودة إلى الطاولات', tableHistory: 'كل طلبات هذه الطاولة', currentBalance: 'إجمالي المبلغ المتبقي', foodService: 'الطعام', beverageService: 'المشروبات', serviceTitle: 'طلبات التحضير', noServiceItems: 'لا توجد طلبات نشطة',
    emptyTitle: 'لا توجد سجلات بعد', emptyText: 'ستظهر السجلات هنا بعد إضافتها.',
    add: 'إضافة', addItem: 'إضافة عنصر للقائمة', search: 'بحث', name: 'الاسم', nameKu: 'الاسم بالكردية', nameAr: 'الاسم بالعربية',
    price: 'السعر (دينار)', category: 'الفئة', foodCategory: 'طعام', beverageCategory: 'مشروبات', seats: 'عدد المقاعد', label: 'رقم / اسم الطاولة',
    phone: 'رقم الهاتف', notes: 'ملاحظات', titleKu: 'العنوان بالكردية', titleAr: 'العنوان بالعربية',
    expenseCategory: 'فئة المصروف', amount: 'المبلغ (دينار)', date: 'التاريخ', active: 'نشط',
    actions: 'الإجراءات', save: 'حفظ', cancel: 'إلغاء', edit: 'تعديل', delete: 'حذف', deactivateProduct: 'إيقاف المنتج', confirmDeactivateProduct: 'هل تريد إيقاف هذا المنتج؟ سيبقى ظاهراً في الطلبات السابقة.',
    confirmDelete: 'هل تريد حذف هذا السجل؟', no: 'لا', yesDelete: 'نعم، احذف',
    all: 'الكل', open: 'مفتوح', paid: 'مدفوع', cancelled: 'ملغي', pending: 'متبقي',
    status: 'الحالة', total: 'الإجمالي', table: 'الطاولة', customer: 'الزبون', items: 'المنتجات',
    created: 'وقت التسجيل', payment: 'الدفع', addPayment: 'تسجيل دفعة',
    paymentMethod: 'طريقة الدفع', cash: 'نقداً', card: 'بطاقة', other: 'أخرى',
    paidAmount: 'المبلغ المدفوع', cancelOrder: 'إلغاء الطلب', confirmCancelOrder: 'هل تريد إلغاء هذا الطلب؟', newOrder: 'طلب جديد',
    quantity: 'الكمية', noteOrder: 'ملاحظات الطلب', selectTable: 'اختر طاولة',
    chooseProducts: 'اختر المنتجات', createOrder: 'تسجيل الطلب', noProducts: 'لا توجد منتجات للطلب.',
    expense: 'مصروف', noCategory: 'بدون فئة', loading: 'يرجى الانتظار...', retry: 'إعادة المحاولة', ownerDesk: 'لوحة المالك', close: 'إغلاق',
    inactive: 'غير نشط', firebaseMissing: 'Firebase غير مُعدّ', firebaseExplain: 'أضف إعدادات تطبيق Firebase ومعرّف UID للمالك كمتغيرات بيئة.',
    loginTitle: 'مرحباً بعودتك', loginText: 'سجّل الدخول لإدارة يوم قوبا.', email: 'البريد الإلكتروني',
    password: 'كلمة المرور', login: 'تسجيل الدخول', loginError: 'تعذّر تسجيل الدخول. تحقق من بياناتك.',
    logoutError: 'تعذّر تسجيل الخروج. حاول مرة أخرى.',
    notOwner: 'هذا الحساب غير مخوّل بالدخول.', reportTitle: 'تقرير النشاط',
    from: 'من', to: 'إلى', ordersCount: 'عدد الطلبات', expensesCount: 'عدد المصروفات', sortOrder: 'الترتيب',
    net: 'صافي الإيراد', restaurant: 'اسم المطعم', defaultLanguage: 'اللغة الافتراضية',
    saved: 'تم الحفظ', saveSettings: 'حفظ الإعدادات', serverError: 'حدث خطأ',
    firestoreDenied: 'تم رفض الوصول؛ تحقق من قواعد Firestore وحساب المالك.',
    firestoreReadWarning: 'تعذرت قراءة بيانات Firestore؛ السبب:',
    noResults: 'لم يتم العثور على نتائج', filterDate: 'تصفية حسب التاريخ', allOrders: 'كل الطلبات',
    todayLabel: 'اليوم', goodMorning: 'صباح الخير', goodEvening: 'مساء الخير',
    tableAvailable: 'متاح', tableOccupied: 'مشغول', tableReserved: 'محجوز', tableClosed: 'مغلق',
    orderNew: 'جديد', orderPreparing: 'قيد التحضير', orderReady: 'جاهز', orderDelivered: 'تم التوصيل', orderPaid: 'مدفوع', orderCancelled: 'ملغي',
    statusFilter: 'تصفية حسب الحالة', updateStatus: 'تحديث الحالة', customerDetails: 'تفاصيل العميل', customerName: 'اسم العميل', customerPhone: 'رقم الهاتف',
    liveTables: 'الحالات الحالية', activeOrders: 'الطلبات النشطة', unpaidOrders: 'الطلبات غير المدفوعة', completedOrders: 'الطلبات المكتملة',
    mostPopular: 'الأكثر طلباً', weeklySales: 'المبيعات الأسبوعية', monthlySales: 'المبيعات الشهرية', salesRange: 'نطاق المبيعات',
    noCustomer: 'لا يوجد عميل', tableState: 'حالة الطاولة', orderTime: 'وقت الطلب', paymentStatus: 'حالة الدفع',
  },
} as const;

const navItems = [
  { path: '/', key: 'tables', icon: Utensils },
  { path: '/reports', key: 'reports', icon: LayoutDashboard },
  { path: '/archive', key: 'archive', icon: Archive },
  { path: '/menu', key: 'products', icon: Coffee },
  { path: '/service', key: 'service', icon: Coffee },
  { path: '/employees', key: 'employees', icon: Users },
  { path: '/admins', key: 'admins', icon: BriefcaseBusiness },
] as const;

function formatIQD(value: number | undefined, locale: Locale) {
  return `${new Intl.NumberFormat(locale === 'ku' ? 'ckb-IQ' : 'ar-IQ', { maximumFractionDigits: 0 }).format(value || 0)} د.ع`;
}
function localized(value: AnyRecord | null | undefined, locale: Locale, prefix = 'name') {
  return value?.[`${prefix}${locale === 'ku' ? 'Ku' : 'Ar'}`] || value?.[`${prefix}${locale === 'ku' ? 'Ar' : 'Ku'}`] || '';
}
function asDate(value: any): Date {
  return value?.toDate ? value.toDate() : new Date(value || 0);
}
function dateText(value: any, locale: Locale) {
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale === 'ku' ? 'ckb-IQ' : 'ar-IQ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
function todayKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function titleFor(path: string, t: any) {
  const normalizedPath = path === '/products' ? '/menu' : path;
  const item = navItems.find((candidate) => candidate.path === normalizedPath);
  return item ? t[item.key] : t.dashboard;
}
function tableStatusLabel(status: string | null | undefined, locale: Locale, t: any) {
  const value = normalizeTableStatus(status, undefined); 
  const map = {
    available: t.tableAvailable,
    occupied: t.tableOccupied,
    reserved: t.tableReserved,
    closed: t.tableClosed,
  };
  return map[value] || t.tableAvailable;
}
function orderStatusLabel(status: string | null | undefined, locale: Locale, t: any) {
  const value = normalizeOrderStatus(status);
  const map = {
    new: t.orderNew,
    preparing: t.orderPreparing,
    ready: t.orderReady,
    delivered: t.orderDelivered,
    paid: t.orderPaid,
    cancelled: t.orderCancelled,
  };
  return map[value] || t.orderNew;
}
function App() {
  const [locale, setLocale] = useState<Locale>('ku');
  const [user, setUser] = useState<User | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<AnyRecord | null>(null);
  const [isOwnerUser, setIsOwnerUser] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    document.documentElement.lang = locale === 'ku' ? 'ckb' : 'ar';
    document.documentElement.dir = 'rtl';
  }, [locale]);
  useEffect(() => {
    if (!isFirebaseConfigured) { setAuthReady(true); return; }
    return listenForAppAuth(async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setEmployeeProfile(null);
        setIsOwnerUser(false);
        setAuthReady(true);
        return;
      }
      if (nextUser.uid === ownerUid) {
        setUser(nextUser);
        setEmployeeProfile(null);
        setIsOwnerUser(true);
        setAuthReady(true);
        return;
      }
      try {
        const adminProfile = await getActiveAdminProfile(nextUser);
        if (adminProfile) { setUser(nextUser); setEmployeeProfile(null); setIsOwnerUser(false); setAuthReady(true); return; }
        const profile = await getActiveEmployeeProfile(nextUser);
        if (profile) {
          setUser(nextUser);
          setEmployeeProfile(profile);
          setIsOwnerUser(false);
          setAuthReady(true);
        } else {
          await signOutOwner();
          setUser(null);
          setEmployeeProfile(null);
          setAuthError(copy[locale].notOwner);
          setAuthReady(true);
        }
      } catch {
        await signOutOwner();
        setUser(null);
        setEmployeeProfile(null);
        setAuthError(copy[locale].notOwner);
        setAuthReady(true);
      }
    });
  }, []);

  const t = copy[locale];
  async function handleSignOut() {
    await signOutOwner();
    setAuthError('');
    setUser(null);
    setAuthReady(true);
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
    const loginPath = new URL('login', baseUrl).pathname;
    window.history.replaceState(null, '', loginPath);
  }
  if (!isFirebaseConfigured) return <SetupNotice locale={locale} onLocale={setLocale} />;
  if (!authReady) return <LoadingScreen locale={locale} />;
  if (!user) return <LoginScreen locale={locale} onLocale={setLocale} authError={authError} onSignIn={async (email, password) => {
    try {
      setAuthError('');
      const signed = await signInOwner(email, password);
      if (ownerUid && signed?.uid !== ownerUid) {
        await signOutOwner();
        setAuthError(t.notOwner);
      }
    } catch { setAuthError(t.loginError); }
  }} onEmployeeSignIn={async (phone, employeePassword) => { setAuthError(''); try { await signInAdmin(phone, employeePassword); } catch (adminError) { try { await signInEmployee(phone, employeePassword); } catch (employeeError) { throw employeeError || adminError; } } }} />;
  if (employeeProfile) return <EmployeeOrdersScreen profile={employeeProfile} locale={locale} onLocale={setLocale} onSignOut={handleSignOut} />;
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <RoutedBoundary>
            <AuthenticatedApp locale={locale} setLocale={setLocale} onSignOut={handleSignOut} t={t} isOwner={isOwnerUser} />
          </RoutedBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function RoutedBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function LocaleSwitch({ locale, onLocale }: { locale: Locale; onLocale: (locale: Locale) => void }) {
  return <div className="locale-switch" aria-label={copy[locale].language}>
    <button type="button" data-testid="button-locale-ku" aria-pressed={locale === 'ku'} onClick={() => onLocale('ku')}>کوردی</button>
    <button type="button" data-testid="button-locale-ar" aria-pressed={locale === 'ar'} onClick={() => onLocale('ar')}>العربية</button>
  </div>;
}

function SetupNotice({ locale, onLocale }: { locale: Locale; onLocale: (locale: Locale) => void }) {
  const t = copy[locale];
  const isKu = locale === 'ku';
  const requiredVariables = isKu
    ? [
        ['VITE_FIREBASE_API_KEY', 'لە Firebase Console → Project settings → General → Your apps → Web app، بەهای apiKey.'],
        ['VITE_FIREBASE_AUTH_DOMAIN', 'لە هەمان شوێن، بەهای authDomain.'],
        ['VITE_FIREBASE_PROJECT_ID', 'لە هەمان شوێن، بەهای projectId.'],
        ['VITE_FIREBASE_APP_ID', 'لە هەمان شوێن، بەهای appId.'],
        ['VITE_CAFE_OWNER_UID', 'لە Firebase Console → Authentication → Users، UIDی هەژماری خاوەن.'],
      ]
    : [
        ['VITE_FIREBASE_API_KEY', 'من Firebase Console → Project settings → General → Your apps → Web app، قيمة apiKey.'],
        ['VITE_FIREBASE_AUTH_DOMAIN', 'من المكان نفسه، قيمة authDomain.'],
        ['VITE_FIREBASE_PROJECT_ID', 'من المكان نفسه، قيمة projectId.'],
        ['VITE_FIREBASE_APP_ID', 'من المكان نفسه، قيمة appId.'],
        ['VITE_CAFE_OWNER_UID', 'من Firebase Console → Authentication → Users، معرّف UID لحساب المالك.'],
      ];
  const optionalVariables = isKu
    ? [
        ['VITE_FIREBASE_STORAGE_BUCKET', 'storageBucket ـە؛ ئەگەر لە Web app config ـەکەدا هەبوو.'],
        ['VITE_FIREBASE_MESSAGING_SENDER_ID', 'messagingSenderId ـە؛ ئەگەر لە Web app config ـەکەدا هەبوو.'],
        ['VITE_FIREBASE_MEASUREMENT_ID', 'measurementId ـە؛ تەنها بۆ Analytics، پێویست نییە.'],
      ]
    : [
        ['VITE_FIREBASE_STORAGE_BUCKET', 'القيمة storageBucket، إذا ظهرت في إعدادات تطبيق الويب.'],
        ['VITE_FIREBASE_MESSAGING_SENDER_ID', 'القيمة messagingSenderId، إذا ظهرت في إعدادات تطبيق الويب.'],
        ['VITE_FIREBASE_MEASUREMENT_ID', 'القيمة measurementId، للتحليلات فقط وليست مطلوبة.'],
      ];
  return <main className="gate-shell" dir="rtl">
    <div className="gate-top"><Brand locale={locale} /><LocaleSwitch locale={locale} onLocale={onLocale} /></div>
    <section className="gate-card setup-card" data-testid="status-firebase-not-configured">
      <span className="gate-icon"><CircleAlert size={23} /></span>
      <p className="eyebrow">QUBA · {t.ownerDesk}</p>
      <h1>{t.firebaseMissing}</h1>
      <p className="gate-copy">{isKu ? 'پشکنین کردم: ئەم خانانە لە Replit ڕێک نەخراون. ٥ خانە پێویستن بۆ چوونەژوورەوە و داتاکان؛ بەهاکان لە Firebase بگرە.' : 'تحققت من الإعدادات: هذه الحقول غير مضبوطة في Replit. الحقول الخمسة أدناه مطلوبة للدخول والبيانات؛ خذ القيم من Firebase.'}</p>
      <h2>{isKu ? 'خانە پێویستەکان' : 'الحقول المطلوبة'}</h2>
      <ul className="setup-vars">
        {requiredVariables.map(([name, source]) => <li key={name}><code dir="ltr">{name}</code><span>{source}</span></li>)}
      </ul>
      <h2>{isKu ? 'خانەی هەڵبژاردەیی' : 'حقول اختيارية'}</h2>
      <ul className="setup-vars setup-vars-optional">
        {optionalVariables.map(([name, source]) => <li key={name}><code dir="ltr">{name}</code><span>{source}</span></li>)}
      </ul>
      <section className="setup-rules">
        <h2>{isKu ? 'بڵاوکردنەوەی ڕێساکانی Firestore' : 'نشر قواعد Firestore'}</h2>
        <p>{isKu ? 'لە Firebase Console → Firestore Database → Rules، یاساکانی ئێستا بخوێنەوە.' : 'في Firebase Console ← Firestore Database ← Rules، راجع القواعد الحالية.'}</p>
      </section>
    </section>
  </main>;
}

function LoginScreen({ locale, onLocale, authError, onSignIn, onEmployeeSignIn }: { locale: Locale; onLocale: (locale: Locale) => void; authError: string; onSignIn: (email: string, password: string) => Promise<void>; onEmployeeSignIn: (phone: string, password: string) => Promise<void> }) {
  const t = copy[locale];
  const [mode, setMode] = useState<'owner' | 'employee'>('owner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [localError, setLocalError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitOwner(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    await onSignIn(email.trim(), password);
    setBusy(false);
  }
  async function submitEmployee(event: FormEvent) {
    event.preventDefault(); setBusy(true); setLocalError('');
    try {
      await onEmployeeSignIn(phone.trim(), password);
    } catch (error) {
      const detail = error && typeof error === 'object' ? error as { code?: string; message?: string } : {};
      const reason = detail.code || detail.message || String(error || 'unknown-error');
      setLocalError(locale === 'ku'
        ? `چوونەژوورەوە سەرکەوتوو نەبوو. هۆکاری تەکنیکی: ${reason}`
        : `تعذّر تسجيل الدخول. السبب التقني: ${reason}`);
    } finally { setBusy(false); }
  }
  return <main className="gate-shell" dir="rtl">
    <div className="gate-top"><Brand locale={locale} /><LocaleSwitch locale={locale} onLocale={onLocale} /></div>
    <div className="login-layout">
      <section className="login-story">
        <div className="story-mark"><span /><span /><span /></div>
        <p className="eyebrow">QUBA · {t.ownerDesk}</p>
        <h1>{locale === 'ku' ? 'هەموو ڕۆژێک،' : 'كل يوم،'}<br /><em>{locale === 'ku' ? 'لە یەک شوێنەوە.' : 'في مكان واحد.'}</em></h1>
        <p>{locale === 'ku' ? 'لە مێزەوە تا پارەدان، بە ڕوونی بەڕێوەی بەرە.' : 'من الطاولة إلى الدفع، إدارة واضحة من البداية.'}</p>
        <div className="story-line"><span /> {locale === 'ku' ? 'ئامادەیە بۆ ڕۆژێکی باش' : 'جاهز ليوم عمل هادئ'}</div>
      </section>
      <section className="gate-card login-card">
        <span className="gate-icon"><Coffee size={23} /></span>
        <h2>{t.loginTitle}</h2><p className="gate-copy">{t.loginText}</p>
        <div className="login-mode-tabs">
          <button type="button" className={mode === 'owner' ? 'active' : ''} onClick={() => { setMode('owner'); setLocalError(''); }}>{locale === 'ku' ? 'خاوەن' : 'المالك'}</button>
          <button type="button" className={mode === 'employee' ? 'active' : ''} onClick={() => { setMode('employee'); setLocalError(''); }}>{locale === 'ku' ? 'کارمەند / بەڕێوەبەر' : 'موظف / مدير'}</button>
        </div>
        {mode === 'owner' ? <form onSubmit={submitOwner}>
          <label className="field-label" htmlFor="owner-email">{t.email}</label>
          <input id="owner-email" data-testid="input-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
          <label className="field-label" htmlFor="owner-password">{t.password}</label>
          <input id="owner-password" data-testid="input-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
          {authError && <div className="inline-error" role="alert" data-testid="status-auth-error">{authError}</div>}
          <button className="button button-primary login-submit" type="submit" disabled={busy} data-testid="button-login">{busy && <LoaderCircle className="spin" size={16} />}{t.login}<ArrowUpRight size={16} /></button>
        </form> : <form onSubmit={submitEmployee}>
          <p className="employee-login-hint">{locale === 'ku' ? 'کارمەند یان بەڕێوەبەر: ژمارەی مۆبایل و وشەی نهێنی بنووسە.' : 'للموظف أو المدير: أدخل رقم الهاتف وكلمة المرور.'}</p>
          <label className="field-label" htmlFor="employee-phone">{t.phone}</label>
          <input id="employee-phone" data-testid="input-employee-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+9647XXXXXXXXX" required value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
          <label className="field-label" htmlFor="employee-password">{t.password}</label>
          <input id="employee-password" data-testid="input-employee-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
          {(localError || authError) && <div className="inline-error" role="alert" data-testid="status-auth-error">{localError || authError}</div>}
          <button className="button button-primary login-submit" type="submit" disabled={busy || !phone.trim() || !password}>{busy && <LoaderCircle className="spin" size={16} />}{locale === 'ku' ? 'چوونەژوورەوە' : 'تسجيل الدخول'}<ArrowUpRight size={16} /></button>
        </form>}
      </section>
    </div>
  </main>;
}
function Brand({ locale }: { locale: Locale }) {
  return <div className="brand"><span className="brand-symbol"><span /><span /><span /></span><span className="brand-type"><b>QUBA</b><small>{copy[locale].subbrand}</small></span></div>;
}


function EmployeeOrdersScreen({ profile, locale, onLocale, onSignOut }: { profile: AnyRecord; locale: Locale; onLocale: (locale: Locale) => void; onSignOut: () => Promise<void> }) {
  const [orders, setOrders] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const assignedIds: string[] = Array.isArray(profile.assignedTableIds) ? profile.assignedTableIds : [];
  const tableLabels = new Map((profile.assignedTables || []).map((table: AnyRecord) => [table.id, table.label]));
  const t = copy[locale];

  useEffect(() => {
    if (!db || !ownerUid || !profile.phoneE164) { setLoading(false); return; }
    const firestore = db;
    const employeeRef = doc(firestore, 'owners', ownerUid, 'employeeAccess', profile.authUid);
    const stopEmployee = onSnapshot(employeeRef, (snapshot) => {
      if (!snapshot.exists() || snapshot.data().active !== true) void signOutOwner();
    }, () => { void signOutOwner(); });
    if (assignedIds.length === 0) {
      setOrders([]);
      setLoading(false);
      return () => stopEmployee();
    }
    const groups = new Map<number, AnyRecord[]>();
    const stops: (() => void)[] = [];
    const chunks: string[][] = [];
    for (let i = 0; i < assignedIds.length; i += 7) chunks.push(assignedIds.slice(i, i + 7));
    chunks.forEach((chunk, index) => {
      const ordersQuery = query(collection(firestore, 'owners', ownerUid, 'orders'), where('tableId', 'in', chunk), where('status', 'in', ['new', 'preparing', 'ready', 'delivered']));
      const stop = onSnapshot(ordersQuery, (snapshot) => {
        groups.set(index, snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setOrders([...groups.values()].flat().filter((order) => !['paid', 'cancelled'].includes(normalizeOrderStatus(order.status))).sort((a, b) => asDate(b.createdAt).getTime() - asDate(a.createdAt).getTime()));
        setLoading(false);
        setError('');
      }, (snapshotError) => { setError(snapshotError.message); setLoading(false); });
      stops.push(stop);
    });
    return () => { stopEmployee(); stops.forEach((stop) => stop()); };
  }, [profile.authUid, assignedIds.join('|')]);

  async function leave() { if (signingOut) return; setSigningOut(true); try { await onSignOut(); } finally { setSigningOut(false); } }
  return <main className="gate-shell employee-orders-shell" dir="rtl">
    <div className="gate-top"><Brand locale={locale} /><div className="employee-top-actions"><LocaleSwitch locale={locale} onLocale={onLocale} /><button className="signout-button employee-logout" type="button" onClick={() => void leave()} disabled={signingOut}>{signingOut ? <LoaderCircle className="spin" size={15} /> : <LogOut size={15} />}{t.signOut}</button></div></div>
    <section className="employee-orders-wrap">
      <div className="employee-welcome"><span className="gate-icon"><ClipboardList size={22} /></span><p className="eyebrow">QUBA · {locale === 'ku' ? 'شاشەی کارمەند' : 'واجهة الموظف'}</p><h1>{profile.name || (locale === 'ku' ? 'کارمەند' : 'موظف')}</h1><p>{locale === 'ku' ? 'تەنها داواکاریی مێزە دیاریکراوەکانت دەبینیت.' : 'تظهر هنا طلبات الطاولات المخصصة لك فقط.'}</p></div>
      {loading ? <LoadingContent locale={locale} /> : error ? <ErrorContent locale={locale} message={error} onRetry={() => window.location.reload()} /> : orders.length === 0 ? <EmptyState locale={locale} title={locale === 'ku' ? 'داواکاریی چالاک نییە' : 'لا توجد طلبات نشطة'} /> : <div className="employee-order-list">
        {orders.map((order) => <article className="panel employee-order-card" key={order.id}>
          <div className="employee-order-head"><b>{locale === 'ku' ? 'مێزی' : 'الطاولة'} {String(tableLabels.get(order.tableId) || '—')}</b><span className="status-badge badge-open">{orderStatusLabel(order.status, locale, t)}</span></div>
          <small>{dateText(order.createdAt, locale)}</small>
          {(() => {
            const items = combineOrderItems(order.items || []);
            const beverages = items.filter((item: AnyRecord) => item.categoryId === '__quba_beverage__');
            const foods = items.filter((item: AnyRecord) => item.categoryId !== '__quba_beverage__');
            return <div className="employee-order-items employee-order-items-split">
              {foods.length > 0 && <section><b className="employee-order-kind"><Utensils size={14} />{locale === 'ku' ? 'خواردن' : 'الطعام'}</b>{foods.map((item: AnyRecord, index: number) => <div key={'food-' + index}><span>{localized(item, locale) || item.nameKu || item.nameAr}</span><b>× {item.quantity}</b></div>)}</section>}
              {beverages.length > 0 && <section><b className="employee-order-kind"><Coffee size={14} />{locale === 'ku' ? 'خواردنەوە' : 'المشروبات'}</b>{beverages.map((item: AnyRecord, index: number) => <div key={'drink-' + index}><span>{localized(item, locale) || item.nameKu || item.nameAr}</span><b>× {item.quantity}</b></div>)}</section>}
            </div>;
          })()}
          {order.notes && <p className="order-note">{order.notes}</p>}
        </article>)}
      </div>}
    </section>
  </main>;
}

function EmployeesPage({ employees, tables, locale, t, actions, notify }: { employees: AnyRecord[]; tables: AnyRecord[]; locale: Locale; t: any; actions: AnyRecord; notify: (message: string) => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [employeePassword, setEmployeePassword] = useState('');
  const [assigned, setAssigned] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const isKu = locale === 'ku';
  const availableTables = tables.filter((table: AnyRecord) => table.active !== false).sort((a: AnyRecord,b: AnyRecord) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }));
  function open(employee?: AnyRecord) {
    setEditing(employee || null);
    setName(employee?.name || '');
    setPhone(employee?.phoneE164 || '');
    setEmployeePassword('');
    setAssigned(employee?.assignedTableIds || []);
    setActive(employee?.active !== false);
    setDialogOpen(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const assignedTables = availableTables.filter((table: AnyRecord) => assigned.includes(table.id)).map((table: AnyRecord) => ({ id: table.id, label: table.label }));
      if (editing?.authUid) await actions.updateEmployee(editing.phoneE164, { name: name.trim(), assignedTableIds: assigned, assignedTables, active });
      else await actions.createEmployee({ name: name.trim(), phoneE164: phone.trim(), password: employeePassword, assignedTableIds: assigned, assignedTables, active });
      setDialogOpen(false); notify(t.saved);
    } catch (error) { notify(error instanceof Error ? error.message : t.serverError); }
    finally { setBusy(false); }
  }
  async function toggle(employee: AnyRecord) {
    try { await actions.updateEmployee(employee.phoneE164, { active: employee.active === false }); notify(t.saved); }
    catch { notify(t.serverError); }
  }
  return <>
    <div className="list-toolbar"><div className="employee-page-hint">{isKu ? 'ژمارەی مۆبایل و مێزەکانی کارمەند دیاری بکە.' : 'حدد رقم الهاتف والطاولات المخصصة للموظف.'}</div><button className="button button-primary" type="button" onClick={() => open()}><Plus size={16} />{t.add}</button></div>
    {employees.length === 0 ? <EmptyState locale={locale} title={isKu ? 'هێشتا کارمەند تۆمار نەکراوە' : 'لم يتم تسجيل موظفين بعد'} /> : <div className="employee-admin-list">{employees.map((employee) => <article className="panel employee-admin-card" key={employee.phoneE164}>
      <div><b>{employee.name}</b><small dir="ltr">{employee.phoneE164}</small><small>{isKu ? 'مێزەکان: ' : 'الطاولات: '}{(employee.assignedTables || []).map((x: AnyRecord) => x.label).join('، ') || (isKu ? 'هیچ مێزێک دیاری نەکراوە' : 'لم تُحدد طاولات')}</small></div>
      <span className={`status-badge ${employee.active === false ? 'badge-cancelled' : 'badge-paid'}`}>{employee.active === false ? t.inactive : t.active}</span>
      <div className="row-actions"><button className="button button-quiet small-button" type="button" onClick={() => open(employee)}>{t.edit}</button><button className="button button-secondary small-button" type="button" onClick={() => void toggle(employee)}>{employee.active === false ? (isKu ? 'چالاککردن' : 'تفعيل') : (isKu ? 'ناچالاککردن' : 'إيقاف')}</button><button className="button button-secondary small-button" type="button" onClick={() => { const message = isKu ? 'دڵنیایت دەتەوێت تۆماری ئەم کارمەندە بسڕیتەوە؟' : 'هل تريد حذف سجل هذا الموظف؟'; if (window.confirm(message)) void actions.deleteEmployee(employee.phoneE164).then(() => notify(isKu ? 'کارمەند سڕایەوە' : 'تم حذف الموظف')).catch(() => notify(t.serverError)); }}>{isKu ? 'سڕینەوە' : 'حذف'}</button></div>
    </article>)}</div>}
    {dialogOpen && <Modal title={editing ? t.edit : (isKu ? 'زیادکردنی کارمەند' : 'إضافة موظف')} onClose={() => setDialogOpen(false)}>
      <form className="dialog-form" onSubmit={save}>
        <label className="form-field"><span>{t.name}</span><input required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="form-field"><span>{t.phone} (+964...)</span><input required disabled={!!editing} type="tel" inputMode="tel" placeholder="+9647XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" /></label>
        {!editing?.authUid && <label className="form-field"><span>{isKu ? 'وشەی نهێنیی کارمەند (لانیکەم ٦ پیت)' : 'كلمة مرور الموظف (6 أحرف على الأقل)'}</span><input required minLength={6} type="password" autoComplete="new-password" value={employeePassword} onChange={(e) => setEmployeePassword(e.target.value)} dir="ltr" /></label>}
        <div className="employee-table-picker"><b>{isKu ? 'ئەو مێزانەی کارمەند دەیبینێت' : 'الطاولات التي يمكن للموظف رؤيتها'}</b>
          {availableTables.map((table: AnyRecord) => <label key={table.id}><input type="checkbox" checked={assigned.includes(table.id)} onChange={(e) => setAssigned((prev) => e.target.checked ? [...prev, table.id] : prev.filter((id) => id !== table.id))} /><span>{isKu ? 'مێزی' : 'طاولة'} {table.label}</span></label>)}
        </div>
        {editing && <label className="check-line"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />{t.active}</label>}
        <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={() => setDialogOpen(false)}>{t.cancel}</button><button className="button button-primary" disabled={busy || !name.trim() || !phone.trim() || (!editing?.authUid && employeePassword.length < 6)} type="submit">{busy && <LoaderCircle className="spin" size={15} />}{t.save}</button></div>
      </form>
    </Modal>}
  </>;
}


function AdminsPage({ locale, actions, notify }: { locale: Locale; actions: AnyRecord; notify: (message: string) => void }) {
  const [admins, setAdmins] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const isKu = locale === 'ku';
  useEffect(() => {
    if (!db || !ownerUid) { setLoading(false); return; }
    return onSnapshot(collection(db, 'owners', ownerUid, 'admins'), (snapshot) => { setAdmins(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))); setLoading(false); }, () => { setLoading(false); notify(isKu ? 'نەتوانرا بەڕێوەبەرەکان بخوێندرێنەوە؛ یاساکانی Firebase بپشکنە.' : 'تعذرت قراءة المديرين؛ تحقق من قواعد Firebase.'); });
  }, []);
  async function add(event: FormEvent) { event.preventDefault(); setBusy(true); try { await actions.createAdmin({ name: name.trim(), phoneE164: phone.trim(), password }); setDialogOpen(false); setName(''); setPhone(''); setPassword(''); notify(isKu ? 'بەڕێوەبەر زیادکرا' : 'تمت إضافة المدير'); } catch (error) { notify(error instanceof Error ? error.message : (isKu ? 'هەڵە ڕوویدا' : 'حدث خطأ')); } finally { setBusy(false); } }
  return <>
    <div className="list-toolbar"><div className="employee-page-hint">{isKu ? 'تەنها خاوەن دەتوانێت بەڕێوەبەر زیاد بکات و دەسەڵاتیان بەڕێوە ببات.' : 'المالك فقط يستطيع إضافة المديرين وإدارة صلاحياتهم.'}</div><button className="button button-primary" type="button" onClick={() => setDialogOpen(true)}><Plus size={16} />{isKu ? 'زیادکردنی بەڕێوەبەر' : 'إضافة مدير'}</button></div>
    {loading ? <LoadingContent locale={locale} /> : admins.length === 0 ? <EmptyState locale={locale} title={isKu ? 'هێشتا بەڕێوەبەرێک نییە' : 'لا يوجد مديرون بعد'} /> : <div className="employee-admin-list">{admins.map((admin) => <article className="panel employee-admin-card" key={admin.id}><div><b>{admin.name}</b><small dir="ltr">{admin.phoneE164}</small></div><span className={`status-badge ${admin.active === false ? 'badge-cancelled' : 'badge-paid'}`}>{admin.active === false ? (isKu ? 'ناچالاک' : 'غير نشط') : (isKu ? 'چالاک' : 'نشط')}</span><div className="row-actions"><button className="button button-secondary small-button" type="button" onClick={() => void actions.updateAdmin(admin.phoneE164, admin.active === false).then(() => notify(isKu ? 'نوێکرایەوە' : 'تم التحديث')).catch(() => notify(isKu ? 'هەڵە ڕوویدا' : 'حدث خطأ'))}>{admin.active === false ? (isKu ? 'چالاککردن' : 'تفعيل') : (isKu ? 'ناچالاککردن' : 'إيقاف')}</button><button className="button button-secondary small-button" type="button" onClick={() => { if (window.confirm(isKu ? 'دڵنیایت لە سڕینەوەی ئەم بەڕێوەبەرە؟' : 'هل تريد حذف هذا المدير؟')) void actions.deleteAdmin(admin.phoneE164).then(() => notify(isKu ? 'سڕایەوە' : 'تم الحذف')).catch(() => notify(isKu ? 'هەڵە ڕوویدا' : 'حدث خطأ')); }}>{isKu ? 'سڕینەوە' : 'حذف'}</button></div></article>)}</div>}
    {dialogOpen && <Modal title={isKu ? 'زیادکردنی بەڕێوەبەر' : 'إضافة مدير'} onClose={() => setDialogOpen(false)}><form className="dialog-form" onSubmit={add}><label className="form-field"><span>{isKu ? 'ناو' : 'الاسم'}</span><input required value={name} onChange={(e) => setName(e.target.value)} /></label><label className="form-field"><span>{isKu ? 'ژمارەی مۆبایل (+964...)' : 'رقم الهاتف (+964...)'}</span><input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="+9647XXXXXXXXX" /></label><label className="form-field"><span>{isKu ? 'وشەی نهێنی (لانیکەم ٦ پیت)' : 'كلمة المرور (6 أحرف على الأقل)'}</span><input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" /></label><div className="dialog-actions"><button className="button button-quiet" type="button" onClick={() => setDialogOpen(false)}>{isKu ? 'پاشگەزبوونەوە' : 'إلغاء'}</button><button className="button button-primary" disabled={busy || !name.trim() || !phone.trim() || password.length < 6} type="submit">{busy ? <LoaderCircle className="spin" size={15} /> : null}{isKu ? 'پاشەکەوت' : 'حفظ'}</button></div></form></Modal>}
  </>;
}

function AuthenticatedApp({ locale, setLocale, onSignOut, t, isOwner }: { locale: Locale; setLocale: (locale: Locale) => void; onSignOut: () => Promise<void>; t: any; isOwner: boolean }) {
  const dataState = useCafeData();
  const { data, loading, error } = dataState;
  const [path, setPath] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => { try { return localStorage.getItem('quba-theme') === 'dark'; } catch { return false; } });
  const [toast, setToast] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    try { localStorage.setItem('quba-theme', darkMode ? 'dark' : 'light'); } catch { /* storage may be unavailable */ }
  }, [darkMode]);
  useEffect(() => {
    if (data?.settings?.defaultLocale && (data.settings.defaultLocale === 'ku' || data.settings.defaultLocale === 'ar')) setLocale(data.settings.defaultLocale);
  }, [data?.settings?.defaultLocale, setLocale]);
  useEffect(() => {
    if (['/login', '/orders'].includes(path)) setPath('/');
    else if (path === '/products') setPath('/menu');
  }, [path, setPath]);
  const snap = data || { categories: [], products: [], tables: [], orders: [], expenses: [], customers: [], settings: null };
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2400); };
  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await onSignOut();
    } catch {
      notify(t.logoutError);
      setSigningOut(false);
    }
  }
  const pageTitle = path === '/admins' ? (locale === 'ku' ? 'بەڕێوەبەرەکان' : 'المديرون') : titleFor(path, t);
  const content = () => {
    if (loading) return <LoadingContent locale={locale} />;
    if (path === '/menu' || path === '/products') return <><DataPage kind="products" records={snap.products} categories={snap.categories} locale={locale} t={t} actions={dataState} notify={notify} /></>;
    if (error) return <ErrorContent locale={locale} message={error} onRetry={() => window.location.reload()} />;
    if (path === '/') return <TablesPage data={snap} locale={locale} t={t} actions={dataState} notify={notify} />;
    if (path === '/archive') return <ArchivePage data={snap} locale={locale} t={t} actions={dataState} notify={notify} />;
    if (path === '/tables') return <TablesPage data={snap} locale={locale} t={t} actions={dataState} notify={notify} />;
    if (path === '/reports') return <Dashboard data={snap} locale={locale} t={t} />;
    if (path === '/categories') return <DataPage kind="categories" records={snap.categories} locale={locale} t={t} actions={dataState} notify={notify} />;
    if (path === '/customers') return <DataPage kind="customers" records={snap.customers} locale={locale} t={t} actions={dataState} notify={notify} />;
    if (path === '/service') return <ServicePage data={snap} locale={locale} t={t} />;
    if (path === '/admins' && isOwner) return <AdminsPage locale={locale} actions={dataState} notify={notify} />;
    if (path === '/employees') return <EmployeesPage employees={snap.employees || []} tables={snap.tables} locale={locale} t={t} actions={dataState} notify={notify} />;
    if (path === '/expenses') return <DataPage kind="expenses" records={snap.expenses} locale={locale} t={t} actions={dataState} notify={notify} />;
    if (path === '/settings') return <SettingsPage settings={snap.settings} locale={locale} onLocale={setLocale} actions={dataState} notify={notify} t={t} />;
    return <NotFound locale={locale} />;
  };
  return <div className="app-shell" dir="rtl">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-head"><Brand locale={locale} /><button className="icon-button sidebar-close" type="button" aria-label={t.close} onClick={() => setMenuOpen(false)}><X size={19} /></button></div>
      <div className="sidebar-content">
        <div className="sidebar-restaurant"><span className="restaurant-avatar">Q</span><div><b>{localized(snap.settings, locale, 'restaurantName') || 'QUBA'}</b><small>{t.owner}</small></div><ChevronDown size={15} /></div>
        <p className="nav-caption">{locale === 'ku' ? 'بەڕێوەبردن' : 'الإدارة'}</p>
        <nav className="main-nav">
          {navItems.filter((item) => item.path !== '/admins' || isOwner).map(({ path: itemPath, key, icon: Icon }) => <Link key={itemPath} href={itemPath} className={`nav-link ${path === itemPath ? 'nav-active' : ''}`} onClick={() => setMenuOpen(false)}>
            <Icon size={18} strokeWidth={1.8} /><span>{t[key]}</span>
          </Link>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-status"><span className="status-dot" /><span>{locale === 'ku' ? 'هەموو زانیارییەکان پاشەکەوت دەبن' : 'يتم حفظ البيانات تلقائياً'}</span></div>
          <LocaleSwitch locale={locale} onLocale={setLocale} />
          <button className="signout-button" type="button" onClick={() => { void handleSignOut(); }} disabled={signingOut} data-testid="button-signout">
            {signingOut ? <LoaderCircle className="spin" size={16} /> : <LogOut size={16} />}{t.signOut}
          </button>
        </div>
      </div>
    </aside>
    {menuOpen && <button className="mobile-scrim" aria-label="Close menu" type="button" onClick={() => setMenuOpen(false)} />}
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button mobile-menu" type="button" onClick={() => setMenuOpen(true)} aria-label={t.open} data-testid="button-open-menu"><Menu size={21} /></button>
        <div className="crumb"><span>{t.brand}</span><span className="crumb-slash">/</span><b>{pageTitle}</b></div>
        <div className="topbar-right"><button className="theme-toggle" type="button" onClick={() => setDarkMode((value) => !value)} aria-label={darkMode ? (locale === 'ku' ? 'گۆڕین بۆ ڕۆشنایی' : 'التبديل إلى الفاتح') : (locale === 'ku' ? 'گۆڕین بۆ تاریکی' : 'التبديل إلى الداكن')} title={darkMode ? (locale === 'ku' ? 'ڕۆشنایی' : 'فاتح') : (locale === 'ku' ? 'تاریکی' : 'داكن')}><span>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</span><b>{darkMode ? (locale === 'ku' ? 'ڕۆشنایی' : 'فاتح') : (locale === 'ku' ? 'تاریکی' : 'داكن')}</b></button><span className="today-pill"><CalendarDays size={15} />{new Intl.DateTimeFormat(locale === 'ku' ? 'ckb-IQ' : 'ar-IQ', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</span></div>
      </header>
      <div className="page-wrap">
        
        {content()}
      </div>
    </main>
    {toast && <div className="toast-message" role="status" data-testid="status-toast">{toast}</div>}
  </div>;
}

function LoadingScreen({ locale }: { locale: Locale }) {
  return <main className="loading-screen" dir="rtl"><div className="loading-brand"><Brand locale={locale} /></div><div className="loading-pulse"><span /><span /><span /></div><p>{copy[locale].loading}</p></main>;
}
function LoadingContent({ locale }: { locale: Locale }) {
  return <div className="loading-content" aria-label={copy[locale].loading}><div className="skeleton skeleton-title" /><div className="skeleton-row"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div></div>;
}
function ErrorContent({ locale, message, onRetry }: { locale: Locale; message: string; onRetry: () => void }) {
  return <section className="state-panel error-panel" role="alert" data-testid="status-data-error"><CircleAlert size={24} /><h2>{copy[locale].serverError}</h2><p>{message}</p><button type="button" className="button button-primary" onClick={onRetry}>{copy[locale].retry}</button></section>;
}
function FirestoreReadWarning({ locale, message, onRetry }: { locale: Locale; message: string; onRetry: () => void }) {
  return <section className="firestore-read-warning" role="alert" data-testid="status-menu-firestore-error"><CircleAlert size={17} /><div><b>{copy[locale].firestoreReadWarning}</b><code dir="ltr">{message}</code></div><button type="button" className="button button-secondary" onClick={onRetry}>{copy[locale].retry}</button></section>;
}
function NotFound({ locale }: { locale: Locale }) {
  return <section className="state-panel"><Search size={24} /><h2>{copy[locale].noResults}</h2></section>;
}
function EmptyState({ locale, title, detail }: { locale: Locale; title?: string; detail?: string }) {
  const t = copy[locale];
  return <div className="empty-state"><span className="empty-mark"><Activity size={21} /></span><h3>{title || t.emptyTitle}</h3><p>{detail || t.emptyText}</p></div>;
}

function Dashboard({ data, locale, t }: { data: AnyRecord; locale: Locale; t: any }) {
  const today = todayKey();
  const activeOrders = data.orders.filter((o: AnyRecord) => !['paid', 'cancelled'].includes(normalizeOrderStatus(o.status)));
  const todaysOrders = data.orders.filter((o: AnyRecord) => todayKey(asDate(o.createdAt)) === today && normalizeOrderStatus(o.status) !== 'cancelled');
  const todaysExpenses = data.expenses.filter((e: AnyRecord) => String(e.date || '').slice(0, 10) === today);
  const salesToday = data.orders.filter((order: AnyRecord) => normalizeOrderStatus(order.status) !== 'cancelled').reduce((sum: number, order: AnyRecord) => sum + (order.payments || []).reduce((paymentSum: number, payment: AnyRecord) => todayKey(asDate(payment.createdAt || order.createdAt)) === today ? paymentSum + Number(payment.amountIqd || 0) : paymentSum, 0), 0);
  const expenseTotal = todaysExpenses.reduce((sum: number, e: AnyRecord) => sum + Number(e.amountIqd || 0), 0);
  // Derive table occupancy from live orders as well as the saved table status.
  // This keeps the dashboard accurate if an older order exists while a table status is stale.
  const activeTableIds = new Set(activeOrders.map((order: AnyRecord) => order.tableId).filter(Boolean));
  const activeTables = data.tables.filter((table: AnyRecord) => table.active !== false);
  const occupiedTables = activeTables.filter((table: AnyRecord) =>
    activeTableIds.has(table.id) || getTableState(table) === 'occupied' || getTableState(table) === 'reserved'
  ).length;
  const availableTables = activeTables.filter((table: AnyRecord) =>
    !activeTableIds.has(table.id) && getTableState(table) === 'available'
  ).length;
  const totalTables = activeTables.length;
  const todayLabel = new Intl.DateTimeFormat(locale === 'ku' ? 'ckb-IQ' : 'ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const hour = new Date().getHours();
  const popular: Record<string, number> = {};
  todaysOrders.forEach((order: AnyRecord) => (order.items || []).forEach((item: AnyRecord) => {
    const name = localized(item, locale) || item.nameKu || item.nameAr || t.items;
    popular[name] = (popular[name] || 0) + Number(item.quantity || 0);
  }));
  const topProduct = Object.entries(popular).sort((a, b) => b[1] - a[1])[0];
  const isKu = locale === 'ku';
  return <div className="dashboard-content dashboard-redesign">
    <section className="dashboard-hero">
      <div className="dashboard-hero-copy">
        <span className="dashboard-live"><i />{isKu ? 'بەخێربێیت بۆ بەڕێوەبردنی قوبە' : 'مرحباً بك في إدارة قوبا'}</span>
        <p>{todayLabel}</p>
        <h2>{hour < 17 ? t.goodMorning : t.goodEvening}، <strong>{localized(data.settings, locale, 'restaurantName') || 'QUBA'}</strong></h2>
        <small>{isKu ? 'هەموو ڕۆژەکەت لە یەک شوێنەوە بەڕێوەببە.' : 'تابع تفاصيل يومك وأدر المقهى من مكان واحد.'}</small>
      </div>
      <div className="dashboard-hero-mark"><Coffee size={38} strokeWidth={1.35} /><b>QUBA</b><span>CAFE & RESTAURANT</span></div>
    </section>

    <section className="dashboard-quick-actions" aria-label={isKu ? 'کردارە خێراکان' : 'إجراءات سريعة'}>
      <Link href="/tables" className="quick-action"><span><Utensils size={20} /></span><b>{isKu ? 'مێزەکان' : 'الطاولات'}</b><small>{isKu ? 'بینینی دۆخی مێز' : 'عرض حالة الطاولات'}</small></Link>
      <Link href="/employees" className="quick-action"><span><Users size={20} /></span><b>{isKu ? 'کارمەندان' : 'الموظفون'}</b><small>{isKu ? 'بەڕێوەبردنی کارمەندان' : 'إدارة الموظفين'}</small></Link>
    </section>

    <div className="dashboard-section-title"><div><span>{isKu ? 'پوختەی کار' : 'نظرة عامة'}</span><h3>{isKu ? 'بارودۆخی ئەمڕۆ' : 'ملخص اليوم'}</h3></div><span className="dashboard-date-chip"><CalendarDays size={14} />{todayLabel}</span></div>
    <section className="metric-grid dashboard-metrics">
      <MetricCard icon={Banknote} label={t.revenue} value={formatIQD(salesToday, locale)} note={`${todaysOrders.length} ${t.ordersCount}`} tone="green" />
      <MetricCard icon={ClipboardList} label={t.openOrders} value={String(activeOrders.length)} note={t.activeOrders} tone="blue" />
      <MetricCard icon={Utensils} label={t.tablesOccupied} value={`${occupiedTables} / ${totalTables}`} note={`${availableTables} ${isKu ? 'مێز بەردەستە' : 'طاولة متاحة'}`} tone="amber" />
      <MetricCard icon={ArrowDownLeft} label={t.costs} value={formatIQD(expenseTotal, locale)} note={`${todaysExpenses.length} ${t.expensesCount}`} tone="rose" />
    </section>

    <section className="panel" style={{ padding: 16, marginBottom: 18 }}>
      <div className="panel-heading">
        <div><span className="panel-kicker">{isKu ? 'مێزەکانی کڕیار' : 'طاولات الزبائن'}</span><h3>{isKu ? 'مێزە چالاکەکان' : 'الطاولات النشطة'}</h3></div>
        <Link href="/tables" className="text-link">{t.viewAll}<ArrowUpRight size={15} /></Link>
      </div>
      {(() => {
        const activeTableOrders = activeOrders
          .filter((order: AnyRecord) => order.tableId)
          .reduce((list: AnyRecord[], order: AnyRecord) => {
            const table = data.tables.find((item: AnyRecord) => item.id === order.tableId && item.active !== false);
            if (table && !list.some((entry) => entry.table.id === table.id)) list.push({ table, order });
            return list;
          }, [])
          .sort((a: AnyRecord, b: AnyRecord) => Number(String(a.table.label || '').match(/\\d+/)?.[0] || 999) - Number(String(b.table.label || '').match(/\\d+/)?.[0] || 999));
        return activeTableOrders.length === 0
          ? <p style={{ color: 'var(--muted, #777)', margin: '12px 0 2px' }}>{isKu ? 'هیچ مێزێک ئێستا چالاک نییە.' : 'لا توجد طاولات نشطة حالياً.'}</p>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 10, marginTop: 12 }}>
              {activeTableOrders.map(({ table, order }: AnyRecord) => <Link href="/tables" key={table.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 10px', border: '1px solid var(--border, #e5e7eb)', borderRadius: 12, color: 'inherit', textDecoration: 'none', background: 'var(--surface, #fff)' }}>
                <span aria-label={isKu ? 'چالاک' : 'نشط'} title={isKu ? 'چالاک' : 'نشط'} style={{ width: 9, height: 9, minWidth: 9, borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 0 3px rgba(22,163,74,.13)' }} />
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <b>{table.label}</b>
                  <small style={{ color: 'var(--muted, #777)' }}>{(order.items || []).length} {t.items}</small>
                </span>
              </Link>)}
            </div>;
      })()}
    </section>

    <section className="dashboard-lower dashboard-redesign-lower">
      <aside className="panel dashboard-insights">
        <div className="panel-heading"><div><span className="panel-kicker">{isKu ? 'زانیارییە خێراکان' : 'معلومات سريعة'}</span><h3>{isKu ? 'دۆخی قوبە' : 'حالة قوبا'}</h3></div><span className="insight-coffee"><Coffee size={18} /></span></div>
        <div className="insight-row"><span className="insight-icon"><Utensils size={17} /></span><div><small>{isKu ? 'مێزی بەکارهاتوو' : 'الطاولات المستخدمة'}</small><b>{occupiedTables} / {totalTables}</b></div></div>
        <div className="insight-row"><span className="insight-icon"><ClipboardList size={17} /></span><div><small>{isKu ? 'داواکارییەکانی ئەمڕۆ' : 'طلبات اليوم'}</small><b>{todaysOrders.length}</b></div></div>
        <div className="insight-row"><span className="insight-icon"><Banknote size={17} /></span><div><small>{isKu ? 'زۆرترین فرۆشراو' : 'الأكثر مبيعاً'}</small><b>{topProduct ? topProduct[0] : '—'}</b></div></div>
      </aside>
    </section>
  </div>;
}
function MetricCard({ icon: Icon, label, value, note, tone }: { icon: any; label: string; value: string; note: string; tone: string }) {
  return <article className="metric-card" data-testid={`metric-${tone}`}><div className="metric-top"><span>{label}</span><span className={`metric-icon metric-${tone}`}><Icon size={17} /></span></div><b>{value}</b><small>{note}</small></article>;
}
function OrderCompact({ order, data, locale, t }: { order: AnyRecord; data: AnyRecord; locale: Locale; t: any }) {
  const table = data.tables.find((x: AnyRecord) => x.id === order.tableId);
  const paid = (order.payments || []).reduce((s: number, p: AnyRecord) => s + Number(p.amountIqd || 0), 0);
  const status = normalizeOrderStatus(order.status);
  return <div className="order-compact" data-testid={`order-summary-${order.id}`}><span className={`order-status-dot ${status === 'paid' ? 'is-paid' : status === 'cancelled' ? 'is-cancelled' : 'is-open'}`} /><div><b>{table?.label || t.noCustomer}</b><small>{orderStatusLabel(status, locale, t)} · {formatIQD(order.totalIqd, locale)}</small></div><span className="mini-total">{formatIQD(paid, locale)}</span></div>;
}

const fieldText = (key: string, t: any) => {
  const fields: Record<string, string> = { name: t.name, nameKu: t.nameKu, nameAr: t.nameAr, sortOrder: t.sortOrder, priceIqd: t.price, categoryId: t.category, label: t.label, seats: t.seats, phone: t.phone, notes: t.notes, titleKu: t.titleKu, titleAr: t.titleAr, amountIqd: t.amount, status: t.status };
  return fields[key] || key;
};
function recordActionError(error: unknown, t: any) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : '';
  console.error('QUBA record action failed:', error);
  return code === 'permission-denied' || message.toLowerCase().includes('insufficient permissions')
    ? t.firestoreDenied
    : (message || t.serverError);
}
const schemas: Record<RecordKind, string[]> = {
  categories: ['nameKu', 'nameAr', 'sortOrder'],
  products: ['nameKu', 'nameAr', 'categoryId', 'priceIqd', 'active'],
  tables: ['label', 'seats', 'status', 'active'],
  customers: ['name', 'phone', 'notes'],
  expenses: ['titleKu', 'titleAr', 'category', 'amountIqd', 'date', 'notes'],
};
const PRODUCT_CATEGORY_PRESETS = [
  { id: '__quba_food__', labelKey: 'foodCategory' },
  { id: '__quba_beverage__', labelKey: 'beverageCategory' },
] as const;

function productCategoryLabel(categoryId: string | null | undefined, categories: AnyRecord[], locale: Locale, t: any) {
  const preset = PRODUCT_CATEGORY_PRESETS.find((item) => item.id === categoryId);
  if (preset) return t[preset.labelKey];
  return localized(categories.find((category) => category.id === categoryId), locale) || t.noCategory;
}

function DataPage({ kind, records, categories, locale, t, actions, notify }: { kind: RecordKind; records: AnyRecord[]; categories?: AnyRecord[]; locale: Locale; t: any; actions: AnyRecord; notify: (message: string) => void }) {
  const [search, setSearch] = useState('');
  const [formRecord, setFormRecord] = useState<AnyRecord | null>(null);
  const [deleting, setDeleting] = useState<AnyRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const filtered = records.filter((record) => JSON.stringify(record).toLowerCase().includes(search.toLowerCase()));
  const fields = schemas[kind];
  async function save(values: AnyRecord) {
    setBusy(true);
    try {
      const payload = { ...values };
      delete payload.id;
      if (kind === 'tables') {
        payload.status = normalizeTableStatus(payload.status, payload.active);
      }
      if (formRecord?.id) await actions.updateRecord(kind, formRecord.id, payload);
      else await actions.createRecord(kind, { ...(kind === 'categories' ? { sortOrder: 0 } : {}), ...(kind === 'tables' ? { status: 'available' } : {}), ...payload });
      setFormRecord(null); notify(t.saved);
    } catch (error) { notify(recordActionError(error, t)); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try { await actions.deleteRecord(kind, deleting.id); setDeleting(null); notify(t.saved); }
    catch (error) { notify(recordActionError(error, t)); }
    finally { setBusy(false); }
  }
  return <>
    <div className="list-toolbar"><label className="search-box"><Search size={17} /><input data-testid={`input-search-${kind}`} placeholder={t.search} value={search} onChange={(e) => setSearch(e.target.value)} /></label><button className="button button-primary" type="button" data-testid={`button-add-${kind}`} onClick={() => setFormRecord({ ...(kind === 'tables' ? { status: 'available' } : {}), ...(kind === 'expenses' ? { date: todayKey() } : {}), active: true })}>{t.add}</button></div>
    {filtered.length === 0 ? <EmptyState locale={locale} title={search ? t.noResults : undefined} /> : <div className="data-table-wrap"><table className="data-table"><thead><tr>{fields.map((field) => <th key={field}>{fieldText(field, t)}</th>)}<th>{t.actions}</th></tr></thead><tbody>{filtered.map((record) => <tr key={record.id} data-testid={`row-${kind}-${record.id}`}>{fields.map((field) => <td key={field}>{field === 'active' ? <span className={`status-badge ${record.active === false ? 'badge-cancelled' : 'badge-paid'}`}>{record.active === false ? t.inactive : t.active}</span> : field === 'status' ? <span className="status-badge badge-paid">{tableStatusLabel(record.status || (record.active === false ? 'closed' : 'available'), locale, t)}</span> : (record[field] ?? '')}</td>)}<td><div className="row-actions"><button className="icon-button" type="button" title={t.edit} aria-label={t.edit} onClick={() => setFormRecord(record)} data-testid={`button-edit-${kind}-${record.id}`}><Pencil size={15} /></button>{!['customers'].includes(kind) && <button className="icon-button" type="button" title={kind === 'products' ? t.deactivateProduct : t.delete} aria-label={kind === 'products' ? t.deactivateProduct : t.delete} onClick={() => setDeleting(record)} data-testid={`button-delete-${kind}-${record.id}`}><Trash2 size={15} /></button>}</div></td></tr>)}</tbody></table></div>}
    {formRecord && <RecordDialog kind={kind} record={formRecord} categories={categories || []} locale={locale} t={t} busy={busy} onClose={() => setFormRecord(null)} onSave={save} />}
    {deleting && <ConfirmDialog t={t} busy={busy} onClose={() => setDeleting(null)} onConfirm={remove} prompt={kind === 'products' ? t.confirmDeactivateProduct : undefined} title={kind === 'products' ? t.deactivateProduct : undefined} />}
  </>;
}

function RecordDialog({ kind, record, categories, locale, t, busy, onClose, onSave }: { kind: RecordKind; record: AnyRecord; categories: AnyRecord[]; locale: Locale; t: any; busy: boolean; onClose: () => void; onSave: (values: AnyRecord) => Promise<void> | void }) {
  const [values, setValues] = useState<AnyRecord>(() => ({ ...record, ...(record.id ? {} : { active: true, status: 'available', ...(kind === 'expenses' ? { date: todayKey() } : {}) }) }));
  const fields = schemas[kind];
  const title = record.id ? t.edit : t.add;
  function submit(event: FormEvent) {
    event.preventDefault();
    const payload: AnyRecord = { ...values };
    ['priceIqd', 'seats', 'amountIqd', 'sortOrder'].forEach((key) => {
      if (key === 'sortOrder' && payload[key] === '') payload[key] = 0;
      else if (payload[key] !== undefined && payload[key] !== '') payload[key] = Number(payload[key]);
    });
    void onSave(payload);
  }
  return <Modal title={title} onClose={onClose}><form onSubmit={submit} className="dialog-form">
    <div className="form-grid">{fields.map((field) => <label key={field} className={`form-field ${field === 'notes' ? 'field-wide' : ''}`}><span>{fieldText(field, t)}</span>{field === 'categoryId' ? <select required value={values[field] || ''} onChange={(e) => setValues({ ...values, [field]: e.target.value })}><option value="">{t.category}</option>{PRODUCT_CATEGORY_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{t[preset.labelKey]}</option>)}{categories.map((category) => <option key={category.id} value={category.id}>{localized(category, locale)}</option>)}</select> : field === 'active' ? <span className="check-line"><input type="checkbox" checked={values.active !== false} onChange={(e) => setValues({ ...values, active: e.target.checked })} />{t.active}</span> : field === 'status' ? <select value={values.status || 'available'} onChange={(e) => setValues({ ...values, status: e.target.value, active: e.target.value !== 'closed' })}><option value="available">{t.tableAvailable}</option><option value="occupied">{t.tableOccupied}</option><option value="reserved">{t.tableReserved}</option><option value="closed">{t.tableClosed}</option></select> : field === 'notes' ? <textarea value={values[field] || ''} onChange={(e) => setValues({ ...values, [field]: e.target.value })} rows={3} /> : <input required={['name', 'nameKu', 'nameAr', 'titleKu', 'titleAr', 'priceIqd', 'label', 'seats', 'amountIqd'].includes(field)} type={field === 'priceIqd' || field === 'amountIqd' ? 'number' : 'text'} value={values[field] ?? ''} onChange={(e) => setValues({ ...values, [field]: e.target.value })} />}</label>)}</div>
    <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onClose}>{t.cancel}</button><button className="button button-primary" disabled={busy} data-testid="button-save-record" type="submit">{busy && <LoaderCircle className="spin" size={15} />}{t.save}</button></div>
  </form></Modal>;
}

function ConfirmDialog({ t, busy, onClose, onConfirm, prompt = t.confirmDelete, title = t.delete }: { t: any; busy: boolean; onClose: () => void; onConfirm: () => void; prompt?: string; title?: string }) {
  return <Modal title={title} onClose={onClose}><div className="confirm-content"><span className="confirm-icon"><Trash2 size={20} /></span><p>{prompt}</p></div><div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onClose}>{t.cancel}</button><button className="button button-primary" disabled={busy} onClick={onConfirm}>{t.yesDelete}</button></div></Modal>;
}
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => { const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle); }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-head"><h3>{title}</h3><button className="icon-button" type="button" aria-label="Close" onClick={onClose}><X size={17} /></button></div>{children}</section></div>;
}

function TablesPage({ data, locale, t, actions, notify }: { data: AnyRecord; locale: Locale; t: any; actions: AnyRecord; notify: (message: string) => void }) {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<AnyRecord | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [tableFilter, setTableFilter] = useState<'all' | 'busy' | 'free'>('all');
  const [tableSearch, setTableSearch] = useState('');
  const [menuDialog, setMenuDialog] = useState(false);
  const [menuNameKu, setMenuNameKu] = useState('');
  const [menuNameAr, setMenuNameAr] = useState('');
  const [menuPrice, setMenuPrice] = useState('');
  const [menuKind, setMenuKind] = useState<'food' | 'beverage'>('food');
  useEffect(() => {
    let active = true;
    actions.ensureDefaultTables().catch(() => { if (active) notify(t.serverError); }).finally(() => { if (active) setPreparing(false); });
    return () => { active = false; };
  }, []);
  const allTables = [...data.tables];
  const selectedTable = allTables.find((table: AnyRecord) => table.id === selectedTableId) || null;
  const tables = allTables.filter((table: AnyRecord) => table.active !== false).sort((a: AnyRecord, b: AnyRecord) => Number(String(a.label || '').match(/\d+/)?.[0] || 999) - Number(String(b.label || '').match(/\d+/)?.[0] || 999));
  // Only show orders that still belong to the table's open bill.
  // Paid orders remain in the database and reports, but are cleared from the table view.
  const tableOrders = selectedTable ? data.orders.filter((order: AnyRecord) => order.tableId === selectedTable.id && !['paid', 'cancelled'].includes(normalizeOrderStatus(order.status))).sort((a: AnyRecord, b: AnyRecord) => asDate(b.createdAt).getTime() - asDate(a.createdAt).getTime()) : [];
  const activeOrders = tableOrders.filter((order: AnyRecord) => !['paid', 'cancelled'].includes(normalizeOrderStatus(order.status)));
  const currentTotal = activeOrders.reduce((sum: number, order: AnyRecord) => sum + Number(order.totalIqd || 0), 0);
  const currentPaid = activeOrders.reduce((sum: number, order: AnyRecord) => sum + (order.payments || []).reduce((paid: number, payment: AnyRecord) => paid + Number(payment.amountIqd || 0), 0), 0);
  const remaining = Math.max(0, currentTotal - currentPaid);
  const historyTotal = tableOrders.reduce((sum: number, order: AnyRecord) => sum + Number(order.totalIqd || 0), 0);
  const historyPaid = tableOrders.reduce((sum: number, order: AnyRecord) => sum + (order.payments || []).reduce((paid: number, payment: AnyRecord) => paid + Number(payment.amountIqd || 0), 0), 0);
  const historyRemaining = Math.max(0, historyTotal - historyPaid);
  async function payTableOrder(amount: number, method: string) {
    if (!paymentOrder || busy) return;
    setBusy(true);
    try {
      if (paymentOrder.isWholeTablePayment) {
        await actions.addTablePayment(paymentOrder.tableId, { amountIqd: amount, method });
        setSelectedTableId(null);
      } else {
        await actions.addPayment(paymentOrder.id, { amountIqd: amount, method });
        const orderDue = Math.max(0, Number(paymentOrder.totalIqd || 0) - (paymentOrder.payments || []).reduce((sum: number, payment: AnyRecord) => sum + Number(payment.amountIqd || 0), 0));
        const thisOrderWillBePaid = amount >= orderDue;
        const noOtherOpenOrders = activeOrders.every((order: AnyRecord) => order.id === paymentOrder.id);
        if (thisOrderWillBePaid && noOtherOpenOrders) setSelectedTableId(null);
      }
      setPaymentOrder(null);
      notify(t.saved);
    } catch (error) { notify(recordActionError(error, t)); }
    finally { setBusy(false); }
  }
  async function saveQuickMenuItem(event: FormEvent) {
    event.preventDefault();
    const price = Number(menuPrice);
    if (!menuNameKu.trim() || !Number.isSafeInteger(price) || price < 0) return;
    setBusy(true);
    try {
      await actions.createRecord('products', {
        nameKu: menuNameKu.trim(),
        nameAr: menuNameAr.trim(),
        categoryId: menuKind === 'beverage' ? '__quba_beverage__' : '__quba_food__',
        priceIqd: price,
        active: true,
      });
      setMenuDialog(false);
      setMenuNameKu(''); setMenuNameAr(''); setMenuPrice(''); setMenuKind('food');
      notify(t.saved);
    } catch (error) { notify(recordActionError(error, t)); }
    finally { setBusy(false); }
  }
  async function closeSelectedTable() {
    if (!selectedTable || busy) return;
    const allActiveOrdersPaid = activeOrders.every((order: AnyRecord) => {
      const paid = (order.payments || []).reduce((sum: number, payment: AnyRecord) => sum + Number(payment.amountIqd || 0), 0);
      return paid >= Number(order.totalIqd || 0);
    });
    if (!allActiveOrdersPaid) {
      notify(locale === 'ku' ? 'سەرەتا هەموو حیسابەکانی ئەم مێزە تەواو بکە.' : 'يرجى تسديد جميع حسابات هذه الطاولة أولاً.');
      return;
    }
    if (!window.confirm(t.confirmCloseTable)) return;
    setBusy(true);
    try {
      for (const order of activeOrders) await actions.updateOrderStatus(order.id, 'paid');
      await actions.updateTableStatus(selectedTable.id, 'available');
      notify(t.tableClosedSuccess);
      setSelectedTableId(null);
    } catch (error) {
      notify(recordActionError(error, t));
    } finally {
      setBusy(false);
    }
  }
  async function submitItems(payload: AnyRecord) {
    if (!selectedTable) return;
    setBusy(true);
    try { await actions.createOrder(payload); setAdding(false); notify(t.saved); }
    catch (error) { notify(recordActionError(error, t)); }
    finally { setBusy(false); }
  }
  if (preparing && tables.length === 0) return <div className="tables-loading">{t.tableAutoCreate}</div>;
  if (selectedTable) return <section className="table-detail-page">
    <div className="table-detail-head">
      <button type="button" className="button button-quiet" onClick={() => setSelectedTableId(null)}>‹ {t.backToTables}</button>
      <div><span className="table-detail-kicker">QUBA · {t.tableNumber}</span><h2>{selectedTable.label}</h2><span className={activeOrders.length ? 'table-detail-state is-busy' : 'table-detail-state'}><i />{activeOrders.length ? t.tableOccupied : t.tableAvailable}</span></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" className="button button-secondary" disabled={busy} onClick={() => void closeSelectedTable()}>{busy ? <LoaderCircle className="spin" size={15} /> : <X size={15} />}{t.closeTable}</button></div>
    </div>
    <div className="table-detail-summary">
      <div><small>{locale === 'ku' ? 'کۆی داواکارییەکان' : 'عدد الطلبات'}</small><b>{tableOrders.length}</b></div>
      <div><small>{locale === 'ku' ? 'کۆی گشتی هەموو داواکارییەکان' : 'إجمالي كل الطلبات'}</small><b>{formatIQD(historyTotal, locale)}</b></div>
      <div><small>{t.paidAmount}</small><b>{formatIQD(historyPaid, locale)}</b></div>
      <div className="table-detail-due"><small>{locale === 'ku' ? 'ماوەی هەموو حیسابەکان' : 'المتبقي على كل الطلبات'}</small><b>{formatIQD(historyRemaining, locale)}</b></div>
    </div>
    {activeOrders.length > 0 && <div className="table-detail-footer"><div><small>{locale === 'ku' ? 'حیسابی داواکارییە چالاکەکان' : 'رصيد الطلبات النشطة'}</small><b>{formatIQD(remaining, locale)}</b></div></div>}
    {tableOrders.length === 0 ? <EmptyState locale={locale} title={t.tableNoOrder} detail={locale === 'ku' ? 'داواکارییەک زیاد بکە بۆ ئەم مێزە.' : 'أضف طلباً لهذه الطاولة.'} /> :
      <div className="table-order-history">{tableOrders.map((order: AnyRecord) => {
        const paid = (order.payments || []).reduce((sum: number, payment: AnyRecord) => sum + Number(payment.amountIqd || 0), 0);
        return <article className="table-history-card" key={order.id}>
          <div className="table-history-head"><div><b>{t.tableCurrentOrder}</b><small>{dateText(order.createdAt, locale)}</small></div><span className={normalizeOrderStatus(order.status) === 'paid' ? 'status-badge badge-paid' : 'status-badge badge-open'}>{orderStatusLabel(order.status, locale, t)}</span></div>
          {combineOrderItems(order.items || []).map((item: AnyRecord, index: number) => <div className="table-history-line" key={item.productId + '-' + index}><span>{localized(item, locale) || item.nameKu || item.nameAr} <small>× {item.quantity}</small></span><b>{formatIQD(Number(item.unitPriceIqd || 0) * Number(item.quantity || 0), locale)}</b></div>)}
          <div className="table-history-total"><span>{t.tableTotal}</span><b>{formatIQD(order.totalIqd, locale)}</b></div><small className="table-history-paid">{t.paidAmount}: {formatIQD(paid, locale)}</small>{normalizeOrderStatus(order.status) !== 'paid' && paid < Number(order.totalIqd || 0) && <button type="button" className="button button-secondary small-button" disabled={busy} onClick={() => setPaymentOrder(order)}>{t.addPayment}</button>}
        </article>;
      })}</div>}
    <div className="table-detail-footer"><div><small>{t.currentBalance}</small><b>{formatIQD(remaining, locale)}</b></div><button className="button button-primary" type="button" onClick={() => setAdding(true)}><Plus size={16} />{t.tableAddItems}</button></div>
    {paymentOrder && <PaymentDialog order={paymentOrder} locale={locale} t={t} busy={busy} onClose={() => setPaymentOrder(null)} onPay={payTableOrder} />}
    {adding && <NewOrderDialog data={data} locale={locale} t={t} busy={busy} initialTableId={selectedTable.id} lockTable currentOrder={activeOrders[0] || null} onClose={() => setAdding(false)} onCreate={submitItems} />}
  </section>;
  const sortedTables = allTables.filter((table: AnyRecord) => table.active !== false).sort((a: AnyRecord, b: AnyRecord) => Number(String(a.label || '').match(/\d+/)?.[0] || 999) - Number(String(b.label || '').match(/\d+/)?.[0] || 999));
  const tableCards = sortedTables.map((table: AnyRecord) => {
    const openOrders = data.orders.filter((item: AnyRecord) => item.tableId === table.id && !['paid', 'cancelled'].includes(normalizeOrderStatus(item.status)));
    const order = openOrders[0];
    const due = openOrders.reduce((sum: number, activeOrder: AnyRecord) => {
      const paid = (activeOrder.payments || []).reduce((paidSum: number, payment: AnyRecord) => paidSum + Number(payment.amountIqd || 0), 0);
      return sum + Math.max(0, Number(activeOrder.totalIqd || 0) - paid);
    }, 0);
    const tablePaymentOrder = openOrders.length ? {
      id: `table-${table.id}`,
      tableId: table.id,
      totalIqd: due,
      payments: [],
      isWholeTablePayment: true,
    } : null;
    return { table, order: tablePaymentOrder, due, isActive: openOrders.length > 0 };
  });
  const activeTableCards = tableCards.filter((item: AnyRecord) => item.isActive);
  const freeTableCards = tableCards.filter((item: AnyRecord) => !item.isActive);
  const visibleTableCards = tableCards.filter((item: AnyRecord) => {
    const matchesFilter = tableFilter === 'all' || (tableFilter === 'busy' ? item.isActive : !item.isActive);
    const matchesSearch = String(item.table.label || '').toLocaleLowerCase().includes(tableSearch.trim().toLocaleLowerCase());
    return matchesFilter && matchesSearch;
  });
  const renderTableButton = (item: AnyRecord) => <article className={`quba-table-card ${item.isActive ? 'table-tile-busy' : ''}`} key={item.table.id}>
    <button type="button" className="quba-table-open" onClick={() => setSelectedTableId(item.table.id)} data-testid={`button-table-${String(item.table.label).replace(/\D/g, '')}`}>
      <strong className="table-tile-number">{item.table.label}</strong>
      <span className={`quba-table-state ${item.isActive ? 'is-active' : 'is-inactive'}`}>{item.isActive ? (locale === 'ku' ? 'بەکارهاتوو' : 'مشغولة') : (locale === 'ku' ? 'بەتاڵ' : 'متاحة')}</span>
      {item.isActive ? <><b className="table-tile-balance">{formatIQD(item.due, locale)}</b><small>{t.tableBalance}</small></> : <small>{locale === 'ku' ? 'ئامادەی وەرگرتنی میوان' : 'جاهزة لاستقبال الزبائن'}</small>}
      <span className="table-tile-action">{item.isActive ? t.tableCurrentOrder : t.newOrder}<Plus size={14} /></span>
    </button>
    {item.isActive && item.due > 0 && <button type="button" className="quba-table-pay" onClick={() => setPaymentOrder(item.order)} disabled={busy}><Banknote size={15} />{locale === 'ku' ? 'وەرگرتنی پارە' : 'استلام دفعة'}</button>}
  </article>;
  if (preparing && tableCards.length === 0) return <div className="tables-loading">{t.tableAutoCreate}</div>;
  return <section className="quba-tables-only quba-luxury-tables">
    <div className="quba-tables-section">
      <header className="quba-tables-heading">
        <div><h2>{locale === 'ku' ? 'مێزەکانی قوبا' : 'طاولات قوبا'}</h2><p>{locale === 'ku' ? 'مێزە بەکارهاتوو و بەتاڵەکان لە یەک شاشەدا.' : 'الطاولات المشغولة والمتاحة في شاشة واحدة.'}</p></div>
        <div className="quba-main-actions"><span>{tableCards.length} {locale === 'ku' ? 'مێز' : 'طاولة'}</span><button type="button" className="button button-primary" onClick={() => setMenuDialog(true)}><Plus size={16} />{locale === 'ku' ? 'زیادکردنی بەرهەم بۆ مێنیو' : 'إضافة صنف للقائمة'}</button></div>
      </header>
      <div className="quba-table-toolbar">
        <label className="quba-table-search"><Search size={17} /><input value={tableSearch} onChange={(event) => setTableSearch(event.target.value)} placeholder={locale === 'ku' ? 'گەڕان بە ژمارەی مێز...' : 'ابحث برقم الطاولة...'} /></label>
        <div className="quba-table-filters">
          <button type="button" className={tableFilter === 'all' ? 'is-selected' : ''} onClick={() => setTableFilter('all')}>{locale === 'ku' ? 'هەموو' : 'الكل'} <b>{tableCards.length}</b></button>
          <button type="button" className={tableFilter === 'busy' ? 'is-selected' : ''} onClick={() => setTableFilter('busy')}>{locale === 'ku' ? 'بەکارهاتوو' : 'مشغولة'} <b>{activeTableCards.length}</b></button>
          <button type="button" className={tableFilter === 'free' ? 'is-selected' : ''} onClick={() => setTableFilter('free')}>{locale === 'ku' ? 'بەتاڵ' : 'متاحة'} <b>{freeTableCards.length}</b></button>
        </div>
      </div>
      {visibleTableCards.length ? <div className="tables-grid quba-tables-grid">{visibleTableCards.map(renderTableButton)}</div> : <p className="quba-empty-tables">{locale === 'ku' ? 'هیچ مێزێک نەدۆزرایەوە.' : 'لا توجد طاولات مطابقة.'}</p>}
    </div>
    {paymentOrder && <PaymentDialog order={paymentOrder} locale={locale} t={t} busy={busy} onClose={() => setPaymentOrder(null)} onPay={payTableOrder} />}
    {menuDialog && <Modal title={locale === 'ku' ? 'زیادکردنی بەرهەم بۆ مێنیو' : 'إضافة صنف إلى القائمة'} onClose={() => setMenuDialog(false)}><form className="dialog-form" onSubmit={saveQuickMenuItem}>
      <label className="form-field"><span>{locale === 'ku' ? 'ناوی بەرهەم بە کوردی' : 'اسم الصنف بالكردية'}</span><input required value={menuNameKu} onChange={(e) => setMenuNameKu(e.target.value)} /></label>
      <label className="form-field"><span>{locale === 'ku' ? 'ناوی بەرهەم بە عەرەبی (ئارەزوومەندانە)' : 'اسم الصنف بالعربية (اختياري)'}</span><input value={menuNameAr} onChange={(e) => setMenuNameAr(e.target.value)} /></label>
      <label className="form-field"><span>{t.category}</span><select value={menuKind} onChange={(e) => setMenuKind(e.target.value as 'food' | 'beverage')}><option value="food">{t.foodService}</option><option value="beverage">{t.beverageService}</option></select></label>
      <label className="form-field"><span>{t.price}</span><input required type="number" min="0" step="1" value={menuPrice} onChange={(e) => setMenuPrice(e.target.value)} /></label>
      <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={() => setMenuDialog(false)}>{t.cancel}</button><button className="button button-primary" type="submit" disabled={busy || !menuNameKu.trim() || menuPrice === ''}>{busy ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}{t.save}</button></div>
    </form></Modal>}
  </section>;
}
function ServicePage({ data, locale, t }: { data: AnyRecord; locale: Locale; t: any }) {
  const [kind, setKind] = useState<'food' | 'beverage'>('food');
  const [selectedTableId, setSelectedTableId] = useState('all');
  const activeOrders = data.orders.filter((order: AnyRecord) => !['paid', 'cancelled'].includes(normalizeOrderStatus(order.status)) && order.tableId && (selectedTableId === 'all' || order.tableId === selectedTableId));
  const rawRows = activeOrders.flatMap((order: AnyRecord) => {
    const table = data.tables.find((entry: AnyRecord) => entry.id === order.tableId);
    return combineOrderItems(order.items || []).filter((item: AnyRecord) => {
      const product = data.products.find((entry: AnyRecord) => entry.id === item.productId);
      const categoryId = product?.categoryId || item.categoryId || '';
      return kind === 'beverage' ? categoryId === '__quba_beverage__' : categoryId !== '__quba_beverage__';
    }).map((item: AnyRecord) => ({ ...item, orderId: order.id, tableId: order.tableId, tableLabel: table?.label || '—', status: order.status }));
  });
  const serviceGroups = new Map<string, AnyRecord>();
  for (const item of rawRows) {
    const key = [item.tableId, item.productId || item.nameKu || item.nameAr, item.unitPriceIqd ?? 0, item.status].join('::');
    const existing = serviceGroups.get(key);
    if (existing) existing.quantity = Number(existing.quantity || 0) + Number(item.quantity || 0);
    else serviceGroups.set(key, { ...item, rowKey: key });
  }
  const rows = Array.from(serviceGroups.values());
  return <div className="service-page">
    <div className="service-page-intro"><div><span>QUBA · {t.serviceTitle}</span><h2>{t.serviceTitle}</h2><small>{locale === 'ku' ? 'داواکارییە چالاکەکان بە جۆری خواردن جیاکراونەتەوە.' : 'الطلبات النشطة مفصولة حسب نوع الصنف.'}</small></div><b>{rows.length}</b></div>
    <label className="form-field service-table-filter"><span>{locale === 'ku' ? 'هەڵبژاردنی مێز' : 'اختر الطاولة'}</span><select value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)}><option value="all">{locale === 'ku' ? 'هەموو مێزەکان' : 'كل الطاولات'}</option>{data.tables.filter((table: AnyRecord) => table.active !== false).sort((a: AnyRecord,b: AnyRecord) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true })).map((table: AnyRecord) => <option key={table.id} value={table.id}>{locale === 'ku' ? 'مێزی' : 'طاولة'} {table.label}</option>)}</select></label>
    <div className="service-tabs"><button type="button" className={kind === 'food' ? 'active' : ''} onClick={() => setKind('food')}><Utensils size={17} />{t.foodService}</button><button type="button" className={kind === 'beverage' ? 'active' : ''} onClick={() => setKind('beverage')}><Coffee size={17} />{t.beverageService}</button></div>
    <div className="service-section-heading"><h3>{kind === 'food' ? t.foodService : t.beverageService}</h3><span>{rows.length} {t.items}</span></div>
    {rows.length === 0 ? <EmptyState locale={locale} title={t.noServiceItems} /> : <div className="service-order-list">{rows.map((item: AnyRecord) => <article className="service-order-row" key={item.rowKey}><div className="service-table-number"><small>{t.table}</small><b>{item.tableLabel}</b></div><div className="service-item-name"><b>{localized(item, locale) || item.nameKu || item.nameAr}</b><small>{orderStatusLabel(item.status, locale, t)}</small></div><strong>× {item.quantity}</strong></article>)}</div>}
  </div>;
}


function ArchivePage({ data, locale, t, actions, notify }: { data: AnyRecord; locale: Locale; t: any; actions: AnyRecord; notify: (message: string) => void }) {
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState<AnyRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const archivedOrders = data.orders
    .filter((order: AnyRecord) => ['paid', 'cancelled'].includes(normalizeOrderStatus(order.status)) && order.archiveHidden !== true)
    .filter((order: AnyRecord) => JSON.stringify(order).toLowerCase().includes(search.toLowerCase()))
    .sort((a: AnyRecord, b: AnyRecord) => asDate(b.paidAt || b.updatedAt || b.createdAt).getTime() - asDate(a.paidAt || a.updatedAt || a.createdAt).getTime());
  async function removeFromArchive() {
    if (!removing) return;
    setBusy(true);
    try {
      // Hide only from the archive; retain the original order and payments for reports.
      await actions.updateRecord('orders', removing.id, { archiveHidden: true });
      setRemoving(null);
      notify(t.saved);
    } catch (error) {
      notify(recordActionError(error, t));
    } finally {
      setBusy(false);
    }
  }
  return <>
    <div className="list-toolbar orders-toolbar">
      <label className="search-box"><Search size={17} /><input placeholder={t.search} value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-archive" /></label>
      <span className="status-badge badge-paid">{archivedOrders.length} · {t.archive}</span>
    </div>
    {archivedOrders.length === 0
      ? <EmptyState locale={locale} title={search ? t.noResults : t.emptyTitle} detail={search ? '' : t.emptyText} />
      : <div className="order-cards">{archivedOrders.map((order: AnyRecord) => {
          const table = data.tables.find((item: AnyRecord) => item.id === order.tableId);
          const customer = data.customers.find((item: AnyRecord) => item.id === order.customerId);
          const paid = (order.payments || []).reduce((sum: number, payment: AnyRecord) => sum + Number(payment.amountIqd || 0), 0);
          const status = normalizeOrderStatus(order.status);
          return <article className="order-card" key={order.id} data-testid={`archive-order-${order.id}`}>
            <div className="order-card-top"><div className="order-card-meta"><span className={`status-badge ${status === 'paid' ? 'badge-paid' : 'badge-cancelled'}`}>{orderStatusLabel(status, locale, t)}</span><b>{t.table} {table?.label || '—'}</b></div><small>{dateText(order.paidAt || order.updatedAt || order.createdAt, locale)}</small></div>
            <div className="order-card-body">
              <div className="customer-callout"><strong>{customer?.name || t.noCustomer}</strong><small>{customer?.phone || ''}</small></div>
              <div className="order-lines">{combineOrderItems(order.items || []).map((item: AnyRecord, index: number) => <div key={`${item.productId || item.nameKu || index}-${index}`}><span>{localized(item, locale) || item.nameKu || item.nameAr} <small>× {item.quantity}</small></span><b>{formatIQD(Number(item.unitPriceIqd || 0) * Number(item.quantity || 0), locale)}</b></div>)}</div>
              <div className="order-card-bottom"><div><small>{t.total}</small><b>{formatIQD(order.totalIqd, locale)}</b><small className="paid-note">{t.paidAmount}: {formatIQD(paid, locale)}</small></div>
                <div className="order-actions"><button className="button button-quiet small-button" type="button" onClick={() => setRemoving(order)} data-testid={`button-remove-archive-${order.id}`}><Trash2 size={14} />{t.archiveRemove}</button></div>
              </div>
            </div>
          </article>;
        })}</div>}
    {removing && <ConfirmDialog t={t} busy={busy} title={t.archiveRemove} prompt={t.archiveConfirm} onClose={() => setRemoving(null)} onConfirm={() => void removeFromArchive()} />}
  </>;
}

function OrderCard({ order, data, locale, t, onPay, onCancel, busy, actions, notify }: { order: AnyRecord; data: AnyRecord; locale: Locale; t: any; onPay: () => void; onCancel: () => void; busy: boolean; actions: AnyRecord; notify: (message: string) => void }) {
  const table = data.tables.find((x: AnyRecord) => x.id === order.tableId);
  const paid = (order.payments || []).reduce((s: number, p: AnyRecord) => s + Number(p.amountIqd || 0), 0);
  const status = normalizeOrderStatus(order.status);
  const customer = data.customers.find((c: AnyRecord) => c.id === order.customerId);
  const nextStatusOptions = status === 'paid' || status === 'cancelled' ? [status] : ['new', 'preparing', 'ready', 'delivered'];
  return <article className="order-card" data-testid={`card-order-${order.id}`}>
    <div className="order-card-top"><div className="order-card-meta"><span className={`status-badge ${status === 'paid' ? 'badge-paid' : status === 'cancelled' ? 'badge-cancelled' : 'badge-open'}`}>{orderStatusLabel(status, locale, t)}</span><b>{table?.label || t.table}</b></div><small>{dateText(order.createdAt, locale)}</small></div>
    <div className="order-card-body">
      <div className="customer-callout"><strong>{customer?.name || t.noCustomer}</strong><small>{customer?.phone || ''}</small></div>
      <div className="order-lines">{combineOrderItems(order.items || []).map((item: AnyRecord, i: number) => <div key={`${item.productId}-${i}`}><span>{localized(item, locale)} <small>× {item.quantity}</small></span><b>{formatIQD(item.unitPriceIqd * item.quantity, locale)}</b></div>)}</div>
      {order.notes && <p className="order-note">{order.notes}</p>}
      <div className="order-card-bottom"><div><small>{t.total}</small><b>{formatIQD(order.totalIqd, locale)}</b><small className="paid-note">{t.paidAmount}: {formatIQD(paid, locale)}</small></div>
      <div className="order-actions">
        <select value={status} disabled={busy || status === 'paid' || status === 'cancelled'} onChange={async (e) => { try { await actions.updateOrderStatus(order.id, e.target.value as OrderStatus); notify(t.saved); } catch { notify(t.serverError); } }}>
          {nextStatusOptions.map((option) => <option value={option} key={option}>{orderStatusLabel(option, locale, t)}</option>)}
        </select>
        {status !== 'paid' && status !== 'cancelled' && <button className="button button-secondary small-button" onClick={onPay} data-testid={`button-payment-${order.id}`}>{t.addPayment}</button>}
        {status !== 'paid' && status !== 'cancelled' && <button className="button button-quiet small-button" onClick={onCancel} data-testid={`button-cancel-${order.id}`}>{t.cancelOrder}</button>}
      </div>
      </div>
    </div>
  </article>;
}

function NewOrderDialog({ data, locale, t, busy, onClose, onCreate, initialTableId = '', lockTable = false, currentOrder = null }: { data: AnyRecord; locale: Locale; t: any; busy: boolean; onClose: () => void; onCreate: (payload: AnyRecord) => void; initialTableId?: string; lockTable?: boolean; currentOrder?: AnyRecord | null }) {
  const [tableId, setTableId] = useState(initialTableId);
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [kind, setKind] = useState<'food' | 'beverage'>('food');
  const products = data.products.filter((p: AnyRecord) => p.active !== false);
  const total = products.reduce((sum: number, p: AnyRecord) => sum + Number(p.priceIqd || 0) * (quantities[p.id] || 0), 0);
  const selectedItems = products.filter((p: AnyRecord) => quantities[p.id] > 0).map((p: AnyRecord) => ({ productId: p.id, nameKu: p.nameKu, nameAr: p.nameAr, categoryId: p.categoryId || '', quantity: quantities[p.id], unitPriceIqd: Number(p.priceIqd || 0) }));
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!tableId || !selectedItems.length) return;
    onCreate({ tableId, customerId: customerId || null, items: selectedItems, notes, status: 'new' });
  }
  return <Modal title={t.newOrder} onClose={onClose}><form className="dialog-form" onSubmit={submit}>
    <div className="form-grid"><label className="form-field"><span>{t.selectTable}</span><select required disabled={lockTable} value={tableId} onChange={(e) => setTableId(e.target.value)}><option value="">{t.selectTable}</option>{data.tables.filter((table: AnyRecord) => table.active !== false).map((table: AnyRecord) => <option key={table.id} value={table.id}>{table.label}</option>)}</select></label><label className="form-field"><span>{t.customer}</span><select value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">{t.customer}</option>{data.customers.map((customer: AnyRecord) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label></div>
    {currentOrder && <section className="panel" style={{ padding: 14, marginBottom: 12 }}>
      <b>{locale === 'ku' ? 'داواکاریی ئێستای ئەم مێزە' : 'الطلب الحالي لهذه الطاولة'}</b>
      <div className="employee-order-items" style={{ marginTop: 8 }}>{combineOrderItems(currentOrder.items || []).map((item: AnyRecord, index: number) => <div key={`${item.productId || item.nameKu || index}-${index}`}><span>{localized(item, locale) || item.nameKu || item.nameAr}</span><b>× {item.quantity}</b></div>)}</div>
      <small style={{ display: 'block', marginTop: 8 }}>{t.tableTotal}: {formatIQD(currentOrder.totalIqd, locale)}</small>
    </section>}
    <div className="product-picker-head"><b>{currentOrder ? (locale === 'ku' ? 'خواردنی زیاتر زیاد بکە' : 'أضف أصنافاً أخرى') : t.chooseProducts}</b><span>{selectedItems.length} {t.items}</span></div>
    <div className="service-tabs picker-service-tabs"><button type="button" className={kind === 'food' ? 'active' : ''} onClick={() => setKind('food')}><Utensils size={15} />{t.foodService}</button><button type="button" className={kind === 'beverage' ? 'active' : ''} onClick={() => setKind('beverage')}><Coffee size={15} />{t.beverageService}</button></div>
    {products.filter((product: AnyRecord) => kind === 'beverage' ? product.categoryId === '__quba_beverage__' : product.categoryId !== '__quba_beverage__').length === 0 ? <EmptyState locale={locale} title={t.noProducts} /> : <div className="product-picker">{products.filter((product: AnyRecord) => kind === 'beverage' ? product.categoryId === '__quba_beverage__' : product.categoryId !== '__quba_beverage__').map((product: AnyRecord) => <div className="picker-product" key={product.id}><div><b>{localized(product, locale)}</b><small>{formatIQD(product.priceIqd, locale)}</small></div><div className="qty-control"><button type="button" onClick={() => setQuantities((prev) => ({ ...prev, [product.id]: Math.max(0, (prev[product.id] || 0) - 1) }))}>-</button><span>{quantities[product.id] || 0}</span><button type="button" onClick={() => setQuantities((prev) => ({ ...prev, [product.id]: (prev[product.id] || 0) + 1 }))}>+</button></div></div>)}</div>}
    <label className="form-field"><span>{t.noteOrder}</span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
    <div className="order-total"><span>{t.total}</span><b>{formatIQD(total, locale)}</b></div>
    <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onClose}>{t.cancel}</button><button className="button button-primary" disabled={busy || !tableId || !selectedItems.length} type="submit">{t.createOrder}</button></div>
  </form></Modal>;
}
function PaymentDialog({ order, locale, t, busy, onClose, onPay }: { order: AnyRecord; locale: Locale; t: any; busy: boolean; onClose: () => void; onPay: (amount: number, method: string) => void }) {
  const paid = (order.payments || []).reduce((s: number, p: AnyRecord) => s + Number(p.amountIqd || 0), 0);
  const remaining = Math.max(0, Number(order.totalIqd || 0) - paid);
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState('cash');
  return <Modal title={t.addPayment} onClose={onClose}><form className="dialog-form" onSubmit={(e) => { e.preventDefault(); if (Number.isSafeInteger(Number(amount)) && Number(amount) > 0 && Number(amount) <= remaining) onPay(Number(amount), method); }}>
    <div className="payment-summary"><small>{t.pending}</small><strong>{formatIQD(remaining, locale)}</strong></div>
    <label className="form-field"><span>{t.amount}</span><input required type="number" min="1" max={remaining} step="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
    <label className="form-field"><span>{t.paymentMethod}</span><select value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">{t.cash}</option><option value="card">{t.card}</option><option value="other">{t.other}</option></select></label>
    <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onClose}>{t.cancel}</button><button className="button button-primary" disabled={busy || !Number(amount) || Number(amount) > remaining} type="submit">{t.save}</button></div>
  </form></Modal>;
}

function SettingsPage({ settings, locale, onLocale, actions, notify, t }: { settings: AnyRecord | null; locale: Locale; onLocale: (locale: Locale) => void; actions: AnyRecord; notify: (message: string) => void; t: any }) {
  const [values, setValues] = useState<AnyRecord>({ restaurantNameKu: settings?.restaurantNameKu || '', restaurantNameAr: settings?.restaurantNameAr || '', defaultLocale: settings?.defaultLocale || 'ku' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setValues({ restaurantNameKu: settings?.restaurantNameKu || '', restaurantNameAr: settings?.restaurantNameAr || '', defaultLocale: settings?.defaultLocale || 'ku' }); }, [settings]);
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await actions.saveSettings(values); onLocale(values.defaultLocale); notify(t.saved); }
    catch { notify(t.serverError); } finally { setBusy(false); }
  }
  return <div className="settings-layout"><section className="panel settings-panel"><div className="panel-heading"><div><span className="panel-kicker">QUBA · {t.restaurant}</span><h3>{t.restaurant}</h3></div></div><form className="dialog-form" onSubmit={save}><label className="form-field"><span>{t.nameKu}</span><input value={values.restaurantNameKu} onChange={(e) => setValues({ ...values, restaurantNameKu: e.target.value })} /></label><label className="form-field"><span>{t.nameAr}</span><input value={values.restaurantNameAr} onChange={(e) => setValues({ ...values, restaurantNameAr: e.target.value })} /></label><label className="form-field"><span>{t.defaultLanguage}</span><select value={values.defaultLocale} onChange={(e) => setValues({ ...values, defaultLocale: e.target.value })}><option value="ku">کوردی</option><option value="ar">العربية</option></select></label><div className="settings-note"><Globe2 size={17} /><span>{locale === 'ku' ? 'هەردوو زمانەکە بە ئاراستەی ڕاست بۆ چەپ نیشان دەدرێن.' : 'تُعرض اللغتان في الاتجاه من اليمين إلى اليسار.'}</span></div><button className="button button-primary" type="submit" disabled={busy} data-testid="button-save-settings">{busy && <LoaderCircle className="spin" size={15} />}{t.saveSettings}</button></form></section><aside className="panel settings-aside"><span className="settings-emblem"><Coffee size={22} /></span><p className="eyebrow">QUBA · {t.ownerDesk}</p><h3>{localized(settings, locale, 'restaurantName') || 'QUBA'}</h3><p>{locale === 'ku' ? 'ڕێکخستنێک لەسەر خاوەنەکان لەسەر Firebase.' : 'إعدادات المالك تُحفظ في Firebase.'}</p></aside></div>;
}

export default App;