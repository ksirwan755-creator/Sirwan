import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCafeData } from '@/lib/cafe-data';
import { isFirebaseConfigured, listenForOwnerAuth, ownerUid, signInOwner, signOutOwner } from '@/lib/firebase';
import type { User } from 'firebase/auth';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Banknote, Boxes, BriefcaseBusiness, CalendarDays,
  ChevronDown, CircleAlert, ClipboardList, Coffee, CreditCard, FileBarChart2,
  Globe2, LayoutDashboard, LoaderCircle, LogOut, Menu, Pencil, Plus, Search, Settings2,
  Trash2, Users, Utensils, Wallet, X,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
type Locale = 'ku' | 'ar';
type RecordKind = 'categories' | 'products' | 'tables' | 'customers' | 'expenses';
type AnyRecord = Record<string, any>;

const copy = {
  ku: {
    brand: 'QUBA', subbrand: 'کافێ و چێشتخانە',
    dashboard: 'پوختەی ڕۆژ', products: 'بەرهەمەکان', categories: 'جۆرەکان', tables: 'مێزەکان',
    orders: 'داواکارییەکان', customers: 'کڕیارەکان', expenses: 'خەرجییەکان', reports: 'ڕاپۆرتەکان',
    settings: 'ڕێکخستن', signOut: 'چوونەدەرەوە', owner: 'بەڕێوەبەری قوبە',
    today: 'ئەمڕۆ', revenue: 'داهاتی ئەمڕۆ', openOrders: 'داواکارییە چالاکەکان',
    tablesOccupied: 'مێزی بەکارهاتوو', costs: 'خەرجیی ئەمڕۆ', todayFlow: 'ڕەوتی ئەمڕۆ',
    recentOrders: 'دوایین داواکارییەکان', viewAll: 'بینینی هەموو', noOrders: 'هێشتا داواکارییەک نییە',
    startOrder: 'داواکارییەکان لێرە دەردەکەون کاتێک تۆمار کران.',
    emptyTitle: 'هێشتا هیچ تۆمارێک نییە', emptyText: 'کاتێک تۆمارێک زیاد بکەیت، لێرە دەردەکەوێت.',
    add: 'زیادکردن', search: 'گەڕان', name: 'ناو', nameKu: 'ناو بە کوردی', nameAr: 'ناو بە عەرەبی',
    price: 'نرخ (دینار)', category: 'جۆر', seats: 'ژمارەی کورسی', label: 'ژمارە / ناونیشانی مێز',
    phone: 'ژمارەی تەلەفۆن', notes: 'تێبینی', titleKu: 'ناونیشان بە کوردی', titleAr: 'ناونیشان بە عەرەبی',
    expenseCategory: 'جۆری خەرجی', amount: 'بڕ (دینار)', date: 'بەروار', active: 'چالاک',
    actions: 'کردار', save: 'پاشەکەوتکردن', cancel: 'پاشگەزبوونەوە', edit: 'دەستکاریکردن',
    delete: 'سڕینەوە', confirmDelete: 'دڵنیایت لە سڕینەوەی ئەم تۆمارە؟', no: 'نەخێر', yesDelete: 'بەڵێ، بیسڕەوە',
    all: 'هەموو', open: 'کراوە', paid: 'پارەدراو', cancelled: 'هەڵوەشێنراوە', pending: 'ماوە',
    status: 'دۆخ', total: 'کۆی گشتی', table: 'مێز', customer: 'کڕیار', items: 'بەرهەم',
    created: 'کاتی تۆمارکردن', payment: 'پارەدان', addPayment: 'تۆمارکردنی پارەدان',
    paymentMethod: 'شێوازی پارەدان', cash: 'نەقد', card: 'کارت', other: 'تر',
    paidAmount: 'بڕی پارەدراو', cancelOrder: 'هەڵوەشاندنەوەی داواکاری', confirmCancelOrder: 'دڵنیایت لە هەڵوەشاندنەوەی ئەم داواکارییە؟', newOrder: 'داواکاریی نوێ',
    quantity: 'دانە', noteOrder: 'تێبینی بۆ داواکاری', selectTable: 'مێز هەڵبژێرە',
    chooseProducts: 'بەرهەم هەڵبژێرە', createOrder: 'تۆمارکردنی داواکاری', noProducts: 'بەرهەمێک نییە بۆ داواکاری.',
    expense: 'خەرجی', noCategory: 'بێ جۆر', loading: 'تکایە چاوەڕێ بکە...', retry: 'دووبارە هەوڵبدەرەوە', ownerDesk: 'ئامرازی بەڕێوەبەر', close: 'داخستن', openMenu: 'کردنەوەی مێنیو', decrease: 'کەمکردنەوە', increase: 'زیادکردن', language: 'زمان',
    inactive: 'ناچالاک', firebaseMissing: 'بەستەری Firebase ئامادە نییە', firebaseExplain: 'ڕێکخستنی Firebase Web App و UIDی خاوەن وەک گۆڕاوەکانی ژینگە دابنێ، پاشان یاساکانی پاراستنی Firestore بڵاو بکەرەوە. هیچ داتای نموونەیی پیشان نادرێت.',
    loginTitle: 'بەخێربێیتەوە', loginText: 'بچۆ ژوورەوە بۆ بەڕێوەبردنی ڕۆژانەی قوبە.', email: 'ئیمەیڵ',
    password: 'وشەی نهێنی', login: 'چوونەژوورەوە', loginError: 'چوونەژوورەوە سەرکەوتوو نەبوو. زانیارییەکانت بپشکنە.',
    notOwner: 'ئەم هەژمارە ڕێگەی چوونەژوورەوەی نییە.', reportTitle: 'ڕاپۆرتی بازرگانی',
    from: 'لە', to: 'بۆ', ordersCount: 'ژمارەی داواکاری', expensesCount: 'ژمارەی خەرجی', sortOrder: 'ڕیزبەندی',
    net: 'داهاتی پاک', restaurant: 'ناوی چێشتخانە', defaultLanguage: 'زمانی سەرەکی',
    saved: 'پاشەکەوت کرا', saveSettings: 'پاشەکەوتکردنی ڕێکخستن', serverError: 'هەڵەیەک ڕوویدا',
    noResults: 'هیچ ئەنجامێک نەدۆزرایەوە', filterDate: 'پاڵاوتن بە بەروار', allOrders: 'هەموو داواکارییەکان',
    todayLabel: 'ئەمڕۆ', goodMorning: 'بەیانی باش', goodEvening: 'ئێوارە باش',
  },
  ar: {
    brand: 'QUBA', subbrand: 'مقهى ومطعم',
    dashboard: 'ملخص اليوم', products: 'المنتجات', categories: 'الفئات', tables: 'الطاولات',
    orders: 'الطلبات', customers: 'الزبائن', expenses: 'المصروفات', reports: 'التقارير',
    settings: 'الإعدادات', signOut: 'تسجيل الخروج', owner: 'إدارة قوبا',
    today: 'اليوم', revenue: 'إيراد اليوم', openOrders: 'الطلبات النشطة',
    tablesOccupied: 'الطاولات المشغولة', costs: 'مصروفات اليوم', todayFlow: 'حركة اليوم',
    recentOrders: 'أحدث الطلبات', viewAll: 'عرض الكل', noOrders: 'لا توجد طلبات بعد',
    startOrder: 'ستظهر الطلبات هنا عند تسجيلها.',
    emptyTitle: 'لا توجد سجلات بعد', emptyText: 'ستظهر السجلات هنا بعد إضافتها.',
    add: 'إضافة', search: 'بحث', name: 'الاسم', nameKu: 'الاسم بالكردية', nameAr: 'الاسم بالعربية',
    price: 'السعر (دينار)', category: 'الفئة', seats: 'عدد المقاعد', label: 'رقم / اسم الطاولة',
    phone: 'رقم الهاتف', notes: 'ملاحظات', titleKu: 'العنوان بالكردية', titleAr: 'العنوان بالعربية',
    expenseCategory: 'فئة المصروف', amount: 'المبلغ (دينار)', date: 'التاريخ', active: 'نشط',
    actions: 'الإجراءات', save: 'حفظ', cancel: 'إلغاء', edit: 'تعديل', delete: 'حذف',
    confirmDelete: 'هل تريد حذف هذا السجل؟', no: 'لا', yesDelete: 'نعم، احذف',
    all: 'الكل', open: 'مفتوح', paid: 'مدفوع', cancelled: 'ملغي', pending: 'متبقي',
    status: 'الحالة', total: 'الإجمالي', table: 'الطاولة', customer: 'الزبون', items: 'المنتجات',
    created: 'وقت التسجيل', payment: 'الدفع', addPayment: 'تسجيل دفعة',
    paymentMethod: 'طريقة الدفع', cash: 'نقداً', card: 'بطاقة', other: 'أخرى',
    paidAmount: 'المبلغ المدفوع', cancelOrder: 'إلغاء الطلب', confirmCancelOrder: 'هل تريد إلغاء هذا الطلب؟', newOrder: 'طلب جديد',
    quantity: 'الكمية', noteOrder: 'ملاحظات الطلب', selectTable: 'اختر طاولة',
    chooseProducts: 'اختر المنتجات', createOrder: 'تسجيل الطلب', noProducts: 'لا توجد منتجات للطلب.',
    expense: 'مصروف', noCategory: 'بدون فئة', loading: 'يرجى الانتظار...', retry: 'إعادة المحاولة', ownerDesk: 'لوحة المالك', close: 'إغلاق', openMenu: 'فتح القائمة', decrease: 'إنقاص', increase: 'زيادة', language: 'اللغة',
    inactive: 'غير نشط', firebaseMissing: 'Firebase غير مُعدّ', firebaseExplain: 'أضف إعدادات تطبيق Firebase ومعرّف UID للمالك كمتغيرات بيئة، ثم انشر قواعد Firestore المرفقة. لن نعرض أي بيانات تجريبية.',
    loginTitle: 'مرحباً بعودتك', loginText: 'سجّل الدخول لإدارة يوم قوبا.', email: 'البريد الإلكتروني',
    password: 'كلمة المرور', login: 'تسجيل الدخول', loginError: 'تعذّر تسجيل الدخول. تحقق من بياناتك.',
    notOwner: 'هذا الحساب غير مخوّل بالدخول.', reportTitle: 'تقرير النشاط',
    from: 'من', to: 'إلى', ordersCount: 'عدد الطلبات', expensesCount: 'عدد المصروفات', sortOrder: 'الترتيب',
    net: 'صافي الإيراد', restaurant: 'اسم المطعم', defaultLanguage: 'اللغة الافتراضية',
    saved: 'تم الحفظ', saveSettings: 'حفظ الإعدادات', serverError: 'حدث خطأ',
    noResults: 'لم يتم العثور على نتائج', filterDate: 'تصفية حسب التاريخ', allOrders: 'كل الطلبات',
    todayLabel: 'اليوم', goodMorning: 'صباح الخير', goodEvening: 'مساء الخير',
  },
} as const;

const navItems = [
  { path: '/', key: 'dashboard', icon: LayoutDashboard },
  { path: '/orders', key: 'orders', icon: ClipboardList },
  { path: '/products', key: 'products', icon: Coffee },
  { path: '/categories', key: 'categories', icon: Boxes },
  { path: '/tables', key: 'tables', icon: Utensils },
  { path: '/customers', key: 'customers', icon: Users },
  { path: '/expenses', key: 'expenses', icon: Wallet },
  { path: '/reports', key: 'reports', icon: FileBarChart2 },
  { path: '/settings', key: 'settings', icon: Settings2 },
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
  if (!value) return '—';
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ku' ? 'ckb-IQ' : 'ar-IQ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}
function todayKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function titleFor(path: string, t: any) { return navItems.find((item) => item.path === path) ? t[navItems.find((item) => item.path === path)!.key] : t.dashboard; }

function App() {
  const [locale, setLocale] = useState<Locale>('ku');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    document.documentElement.lang = locale === 'ku' ? 'ckb' : 'ar';
    document.documentElement.dir = 'rtl';
  }, [locale]);
  useEffect(() => {
    if (!isFirebaseConfigured) { setAuthReady(true); return; }
    return listenForOwnerAuth((nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
  }, []);

  const t = copy[locale];
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
  }} />;
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <RoutedBoundary>
            <AuthenticatedApp locale={locale} setLocale={setLocale} onSignOut={() => signOutOwner()} t={t} />
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
  return <main className="gate-shell" dir="rtl">
    <div className="gate-top"><Brand locale={locale} /><LocaleSwitch locale={locale} onLocale={onLocale} /></div>
    <section className="gate-card setup-card" data-testid="status-firebase-not-configured">
      <span className="gate-icon"><CircleAlert size={23} /></span>
      <p className="eyebrow">QUBA · {t.ownerDesk}</p>
      <h1>{t.firebaseMissing}</h1>
      <p className="gate-copy">{t.firebaseExplain}</p>
      <div className="setup-foot"><span className="status-dot" /> {locale === 'ku' ? 'پێویستی بە بەستەری Firebase هەیە' : 'يتطلب الاتصال بـ Firebase'}</div>
    </section>
  </main>;
}

function LoginScreen({ locale, onLocale, authError, onSignIn }: { locale: Locale; onLocale: (locale: Locale) => void; authError: string; onSignIn: (email: string, password: string) => Promise<void> }) {
  const t = copy[locale];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    await onSignIn(email.trim(), password);
    setBusy(false);
  }
  return <main className="gate-shell" dir="rtl">
    <div className="gate-top"><Brand locale={locale} /><LocaleSwitch locale={locale} onLocale={onLocale} /></div>
    <div className="login-layout">
      <section className="login-story">
        <div className="story-mark"><span /><span /><span /></div>
        <p className="eyebrow">QUBA · {t.ownerDesk}</p>
        <h1>{locale === 'ku' ? 'هەموو ڕۆژێک،' : 'كل يوم،'}<br /><em>{locale === 'ku' ? 'لە یەک شوێنەوە.' : 'في مكان واحد.'}</em></h1>
        <p>{locale === 'ku' ? 'لە مێزەوە تا پارەدان، بە ڕوونی بەڕێوەی بەرە.' : 'من الطاولة إلى الدفع، إدارة واضحة من البداية للنهاية.'}</p>
        <div className="story-line"><span /> {locale === 'ku' ? 'ئامادەیە بۆ ڕۆژێکی باش' : 'جاهز ليوم عمل هادئ'}</div>
      </section>
      <form className="gate-card login-card" onSubmit={submit}>
        <span className="gate-icon"><Coffee size={23} /></span>
        <h2>{t.loginTitle}</h2><p className="gate-copy">{t.loginText}</p>
        <label className="field-label" htmlFor="owner-email">{t.email}</label>
        <input id="owner-email" data-testid="input-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
        <label className="field-label" htmlFor="owner-password">{t.password}</label>
        <input id="owner-password" data-testid="input-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" />
        {authError && <div className="inline-error" role="alert" data-testid="status-auth-error">{authError}</div>}
        <button className="button button-primary login-submit" type="submit" disabled={busy} data-testid="button-login">{busy && <LoaderCircle className="spin" size={16} />}{t.login}<ArrowUpRight size={17} /></button>
        <div className="login-foot"><span className="status-dot" /> {locale === 'ku' ? 'تەنها هەژماری خاوەن ڕێگەپێدراوە' : 'الدخول لمالك الحساب فقط'}</div>
      </form>
    </div>
  </main>;
}

function Brand({ locale }: { locale: Locale }) {
  return <div className="brand"><span className="brand-symbol"><span /><span /><span /></span><span className="brand-type"><b>QUBA</b><small>{copy[locale].subbrand}</small></span></div>;
}

function AuthenticatedApp({ locale, setLocale, onSignOut, t }: { locale: Locale; setLocale: (locale: Locale) => void; onSignOut: () => void; t: any }) {
  const dataState = useCafeData();
  const { data, loading, error } = dataState;
  const [path, setPath] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  useEffect(() => {
    if (data?.settings?.defaultLocale && (data.settings.defaultLocale === 'ku' || data.settings.defaultLocale === 'ar')) setLocale(data.settings.defaultLocale);
  }, [data?.settings?.defaultLocale, setLocale]);
  useEffect(() => { if (path === '/login') setPath('/'); }, [path, setPath]);
  const snap = data || { categories: [], products: [], tables: [], orders: [], expenses: [], customers: [], settings: null };
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2400); };
  const pageTitle = titleFor(path, t);
  const content = () => {
    if (loading) return <LoadingContent locale={locale} />;
    if (error) return <ErrorContent locale={locale} message={t.serverError} onRetry={() => window.location.reload()} />;
    if (path === '/') return <Dashboard data={snap} locale={locale} t={t} />;
    if (path === '/orders') return <OrdersPage data={snap} locale={locale} t={t} actions={dataState} notify={notify} />;
    if (path === '/products') return <DataPage kind="products" records={snap.products} categories={snap.categories} locale={locale} t={t} actions={dataState} notify={notify} />;
    if (path === '/categories') return <DataPage kind="categories" records={snap.categories} locale={locale} t={t} actions={dataState} notify={notify} />;
    if (path === '/tables') return <DataPage kind="tables" records={snap.tables} locale={locale} t={t} actions={dataState} notify={notify} />;
    if (path === '/customers') return <DataPage kind="customers" records={snap.customers} locale={locale} t={t} actions={dataState} notify={notify} />;
    if (path === '/expenses') return <DataPage kind="expenses" records={snap.expenses} locale={locale} t={t} actions={dataState} notify={notify} />;
    if (path === '/reports') return <Reports data={snap} locale={locale} t={t} />;
    if (path === '/settings') return <SettingsPage settings={snap.settings} locale={locale} onLocale={setLocale} actions={dataState} notify={notify} t={t} />;
    return <NotFound locale={locale} />;
  };
  return <div className="app-shell" dir="rtl">
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
    <div className="sidebar-head"><Brand locale={locale} /><button className="icon-button sidebar-close" type="button" aria-label={t.close} onClick={() => setMenuOpen(false)}><X size={19} /></button></div>
      <div className="sidebar-restaurant"><span className="restaurant-avatar">Q</span><div><b>{localized(snap.settings, locale, 'restaurantName') || 'QUBA'}</b><small>{t.owner}</small></div><ChevronDown size={15} /></div>
      <p className="nav-caption">{locale === 'ku' ? 'بەڕێوەبردن' : 'الإدارة'}</p>
      <nav className="main-nav">
        {navItems.map(({ path: itemPath, key, icon: Icon }) => <Link key={itemPath} href={itemPath} className={`nav-link ${path === itemPath ? 'nav-active' : ''}`} onClick={() => setMenuOpen(false)} data-testid={`link-nav-${key}`}>
          <Icon size={18} strokeWidth={1.8} /><span>{t[key]}</span>{key === 'orders' && snap.orders.filter((o: AnyRecord) => o.status !== 'paid' && o.status !== 'cancelled').length > 0 && <i className="nav-count">{snap.orders.filter((o: AnyRecord) => o.status !== 'paid' && o.status !== 'cancelled').length}</i>}
        </Link>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="side-status"><span className="status-dot" /><span>{locale === 'ku' ? 'هەموو زانیارییەکان پاشەکەوت دەبن' : 'يتم حفظ البيانات تلقائياً'}</span></div>
        <LocaleSwitch locale={locale} onLocale={setLocale} />
        <button className="signout-button" type="button" onClick={onSignOut} data-testid="button-signout"><LogOut size={16} />{t.signOut}</button>
      </div>
    </aside>
    {menuOpen && <button className="mobile-scrim" aria-label="Close menu" type="button" onClick={() => setMenuOpen(false)} />}
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button mobile-menu" type="button" onClick={() => setMenuOpen(true)} aria-label={t.openMenu} data-testid="button-open-menu"><Menu size={21} /></button>
        <div className="crumb"><span>{t.brand}</span><span className="crumb-slash">/</span><b>{pageTitle}</b></div>
        <div className="topbar-right"><span className="today-pill"><CalendarDays size={15} />{new Intl.DateTimeFormat(locale === 'ku' ? 'ckb-IQ' : 'ar-IQ', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date())}</span><span className="topbar-owner"><span className="owner-dot">Q</span><span>{t.owner}</span></span></div>
      </header>
      <div className="page-wrap">
        <div className="page-heading"><div><p className="eyebrow page-eyebrow">QUBA · {t.ownerDesk}</p><h1>{pageTitle}</h1></div>{path === '/orders' && <button className="button button-primary" onClick={() => window.dispatchEvent(new Event('open-new-order'))} data-testid="button-new-order"><Plus size={17} />{t.newOrder}</button>}</div>
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
  return <div className="loading-content" aria-label={copy[locale].loading}><div className="skeleton skeleton-title" /><div className="skeleton-row"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div><div className="skeleton skeleton-table" /></div>;
}
function ErrorContent({ locale, message, onRetry }: { locale: Locale; message: string; onRetry: () => void }) {
  return <section className="state-panel error-panel" role="alert" data-testid="status-data-error"><CircleAlert size={24} /><h2>{copy[locale].serverError}</h2><p>{message}</p><button type="button" className="button button-secondary" onClick={onRetry}>{copy[locale].retry}</button></section>;
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
  const todaysOrders = data.orders.filter((o: AnyRecord) => todayKey(asDate(o.createdAt)) === today && o.status !== 'cancelled');
  const todaysExpenses = data.expenses.filter((e: AnyRecord) => String(e.date || '').slice(0, 10) === today);
  const revenue = data.orders.filter((o: AnyRecord) => o.status !== 'cancelled').reduce((sum: number, o: AnyRecord) => sum + (o.payments || []).filter((p: AnyRecord) => todayKey(asDate(p.createdAt || o.createdAt)) === today).reduce((s: number, p: AnyRecord) => s + Number(p.amountIqd || 0), 0), 0);
  const expenseTotal = todaysExpenses.reduce((sum: number, e: AnyRecord) => sum + Number(e.amountIqd || 0), 0);
  const activeOrders = data.orders.filter((o: AnyRecord) => !['paid', 'cancelled'].includes(o.status));
  const activeTableIds = new Set(activeOrders.map((o: AnyRecord) => o.tableId).filter(Boolean));
  const todayLabel = new Intl.DateTimeFormat(locale === 'ku' ? 'ckb-IQ' : 'ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const hour = new Date().getHours();
  return <div className="dashboard-content">
    <div className="welcome-row"><div><p>{todayLabel}</p><h2>{hour < 17 ? t.goodMorning : t.goodEvening}, <span>{localized(data.settings, locale, 'restaurantName') || t.owner}</span></h2></div><div className="live-indicator"><span className="status-dot" />{locale === 'ku' ? 'ڕاستەوخۆ' : 'مباشر'}</div></div>
    <section className="metric-grid">
      <MetricCard icon={Banknote} label={t.revenue} value={formatIQD(revenue, locale)} note={`${todaysOrders.length} ${t.ordersCount}`} tone="green" />
      <MetricCard icon={ClipboardList} label={t.openOrders} value={String(activeOrders.length)} note={locale === 'ku' ? 'داواکارییەکانی ئێستا' : 'تحتاج للمتابعة'} tone="gold" />
      <MetricCard icon={Utensils} label={t.tablesOccupied} value={`${activeTableIds.size} / ${data.tables.filter((x: AnyRecord) => x.active !== false).length}`} note={locale === 'ku' ? 'مێزی چالاک' : 'طاولة نشطة'} tone="peach" />
      <MetricCard icon={ArrowDownLeft} label={t.costs} value={formatIQD(expenseTotal, locale)} note={`${todaysExpenses.length} ${t.expensesCount}`} tone="rose" />
    </section>
    <section className="dashboard-lower">
      <div className="panel recent-panel">
        <div className="panel-heading"><div><span className="panel-kicker">{t.todayFlow}</span><h3>{t.recentOrders}</h3></div><Link href="/orders" className="text-link">{t.viewAll}<ArrowUpRight size={15} /></Link></div>
        {todaysOrders.length === 0 ? <EmptyState locale={locale} title={t.noOrders} detail={t.startOrder} /> : <div className="order-list">
          {todaysOrders.slice(0, 6).map((order: AnyRecord) => <OrderCompact key={order.id} order={order} data={data} locale={locale} t={t} />)}
        </div>}
      </div>
      <aside className="panel service-panel">
        <div className="panel-heading"><div><span className="panel-kicker">{locale === 'ku' ? 'ئێستا' : 'الآن'}</span><h3>{locale === 'ku' ? 'مێزەکان' : 'الطاولات'}</h3></div><Utensils size={18} /></div>
        {data.tables.filter((table: AnyRecord) => table.active !== false).length === 0 ? <EmptyState locale={locale} title={locale === 'ku' ? 'مێزێک تۆمار نەکراوە' : 'لم تُسجل طاولات'} /> : <div className="table-mini-grid">
          {data.tables.filter((table: AnyRecord) => table.active !== false).slice(0, 8).map((table: AnyRecord) => {
            const occupied = activeTableIds.has(table.id);
            return <div className={`mini-table ${occupied ? 'mini-table-busy' : ''}`} key={table.id}><span className="mini-table-status" /><b>{table.label}</b><small>{occupied ? t.open : (locale === 'ku' ? 'بەتاڵ' : 'متاحة')}</small></div>;
          })}
        </div>}
        <Link href="/tables" className="service-link">{locale === 'ku' ? 'بەڕێوەبردنی مێزەکان' : 'إدارة الطاولات'}<ArrowUpRight size={15} /></Link>
      </aside>
    </section>
  </div>;
}

function MetricCard({ icon: Icon, label, value, note, tone }: { icon: any; label: string; value: string; note: string; tone: string }) {
  return <article className="metric-card" data-testid={`metric-${tone}`}><div className="metric-top"><span>{label}</span><span className={`metric-icon metric-${tone}`}><Icon size={17} /></span></div><strong>{value}</strong><small>{note}</small></article>;
}
function OrderCompact({ order, data, locale, t }: { order: AnyRecord; data: AnyRecord; locale: Locale; t: any }) {
  const table = data.tables.find((x: AnyRecord) => x.id === order.tableId);
  const paid = (order.payments || []).reduce((s: number, p: AnyRecord) => s + Number(p.amountIqd || 0), 0);
  const status = order.status === 'paid' ? t.paid : order.status === 'cancelled' ? t.cancelled : t.open;
  return <div className="order-compact" data-testid={`order-summary-${order.id}`}><span className={`order-status-dot ${order.status === 'paid' ? 'is-paid' : order.status === 'cancelled' ? 'is-cancelled' : ''}`} /><div className="compact-order-info"><b>{table?.label || '—'} <span>· {order.items?.length || 0} {t.items}</span></b><small>{dateText(order.createdAt, locale)}</small></div><span className={`status-badge ${order.status === 'paid' ? 'badge-paid' : order.status === 'cancelled' ? 'badge-cancelled' : 'badge-open'}`}>{status}</span><div className="compact-amount"><b>{formatIQD(order.totalIqd, locale)}</b><small>{formatIQD(paid, locale)} {t.paidAmount}</small></div></div>;
}

const fieldText = (key: string, t: any) => {
  const fields: Record<string, string> = { name: t.name, nameKu: t.nameKu, nameAr: t.nameAr, sortOrder: t.sortOrder, priceIqd: t.price, categoryId: t.category, label: t.label, seats: t.seats, phone: t.phone, notes: t.notes, titleKu: t.titleKu, titleAr: t.titleAr, category: t.expenseCategory, amountIqd: t.amount, date: t.date };
  return fields[key] || key;
};
const schemas: Record<RecordKind, string[]> = {
  categories: ['nameKu', 'nameAr', 'sortOrder'],
  products: ['nameKu', 'nameAr', 'categoryId', 'priceIqd', 'active'],
  tables: ['label', 'seats', 'active'],
  customers: ['name', 'phone', 'notes'],
  expenses: ['titleKu', 'titleAr', 'category', 'amountIqd', 'date', 'notes'],
};

function DataPage({ kind, records, categories, locale, t, actions, notify }: { kind: RecordKind; records: AnyRecord[]; categories?: AnyRecord[]; locale: Locale; t: any; actions: AnyRecord; notify: (message: string) => void }) {
  const [search, setSearch] = useState('');
  const [formRecord, setFormRecord] = useState<AnyRecord | null>(null);
  const [deleting, setDeleting] = useState<AnyRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const titleField = kind === 'customers' ? 'name' : kind === 'expenses' ? 'titleKu' : kind === 'tables' ? 'label' : 'nameKu';
  const filtered = records.filter((record) => JSON.stringify(record).toLowerCase().includes(search.toLowerCase()));
  const fields = schemas[kind];
  async function save(values: AnyRecord) {
    setBusy(true);
    try {
      const payload = { ...values };
      delete payload.id;
      if (formRecord?.id) await actions.updateRecord(kind, formRecord.id, payload);
      else await actions.createRecord(kind, { ...(kind === 'categories' ? { sortOrder: 0 } : {}), ...payload });
      setFormRecord(null); notify(t.saved);
    } catch { notify(t.serverError); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try { await actions.deleteRecord(kind, deleting.id); setDeleting(null); notify(t.saved); }
    catch { notify(t.serverError); }
    finally { setBusy(false); }
  }
  return <>
    <div className="list-toolbar"><label className="search-box"><Search size={17} /><input data-testid={`input-search-${kind}`} placeholder={t.search} value={search} onChange={(e) => setSearch(e.target.value)} /></label><button className="button button-primary" onClick={() => setFormRecord({})} data-testid={`button-add-${kind}`}><Plus size={17} />{t.add}</button></div>
    {filtered.length === 0 ? <EmptyState locale={locale} title={search ? t.noResults : undefined} /> : <div className="data-table-wrap"><table className="data-table"><thead><tr>{fields.map((field) => <th key={field}>{fieldText(field, t)}</th>)}<th>{t.actions}</th></tr></thead><tbody>
      {filtered.map((record) => <tr key={record.id} data-testid={`row-${kind}-${record.id}`}>
        {fields.map((field) => <td key={field}>{field === 'active' ? <span className={`status-badge ${record.active === false ? 'badge-cancelled' : 'badge-paid'}`}>{record.active === false ? t.inactive : t.active}</span> : field === 'categoryId' ? (localized(categories?.find((x) => x.id === record.categoryId), locale) || t.noCategory) : field === 'priceIqd' || field === 'amountIqd' ? formatIQD(Number(record[field]), locale) : field === 'date' ? dateText(record[field], locale) : <span className={field === 'notes' ? 'muted-cell' : ''}>{(field === 'nameKu' && (kind === 'products' || kind === 'categories')) || (field === 'titleKu' && kind === 'expenses') ? localized(record, locale, field === 'titleKu' ? 'title' : 'name') : record[field] || '—'}</span>}</td>)}
        <td><div className="row-actions"><button className="icon-button" type="button" title={t.edit} aria-label={t.edit} onClick={() => setFormRecord(record)} data-testid={`button-edit-${kind}-${record.id}`}><Pencil size={15} /></button><button className="icon-button danger-icon" type="button" title={t.delete} aria-label={t.delete} onClick={() => setDeleting(record)} data-testid={`button-delete-${kind}-${record.id}`}><Trash2 size={15} /></button></div></td>
      </tr>)}
    </tbody></table></div>}
    {formRecord && <RecordDialog kind={kind} record={formRecord} categories={categories || []} locale={locale} t={t} busy={busy} onClose={() => setFormRecord(null)} onSave={save} />}
    {deleting && <ConfirmDialog t={t} busy={busy} onClose={() => setDeleting(null)} onConfirm={remove} />}
  </>;
}

function RecordDialog({ kind, record, categories, locale, t, busy, onClose, onSave }: { kind: RecordKind; record: AnyRecord; categories: AnyRecord[]; locale: Locale; t: any; busy: boolean; onClose: () => void; onSave: (data: AnyRecord) => void }) {
  const [values, setValues] = useState<AnyRecord>(() => ({ ...record, ...(record.id ? {} : { active: true, ...(kind === 'expenses' ? { date: todayKey() } : {}) }) }));
  const fields = schemas[kind];
  const title = record.id ? t.edit : t.add;
  function submit(event: FormEvent) {
    event.preventDefault();
    const payload: AnyRecord = { ...values };
    ['priceIqd', 'seats', 'amountIqd', 'sortOrder'].forEach((key) => {
      if (key === 'sortOrder' && payload[key] === '') payload[key] = 0;
      else if (payload[key] !== undefined && payload[key] !== '') payload[key] = Number(payload[key]);
    });
    onSave(payload);
  }
  return <Modal title={title} onClose={onClose}><form onSubmit={submit} className="dialog-form">
    <div className="form-grid">{fields.map((field) => <label key={field} className={`form-field ${field === 'notes' ? 'field-wide' : ''}`}><span>{fieldText(field, t)}</span>
      {field === 'categoryId' ? <select required value={values[field] || ''} onChange={(e) => setValues({ ...values, [field]: e.target.value })}><option value="">{t.category}</option>{categories.map((category) => <option value={category.id} key={category.id}>{localized(category, locale)}</option>)}</select>
        : field === 'active' ? <span className="check-line"><input type="checkbox" checked={values.active !== false} onChange={(e) => setValues({ ...values, active: e.target.checked })} />{t.active}</span>
          : field === 'notes' ? <textarea value={values[field] || ''} onChange={(e) => setValues({ ...values, [field]: e.target.value })} rows={3} />
             : <input required={['name', 'nameKu', 'nameAr', 'titleKu', 'titleAr', 'priceIqd', 'label', 'seats', 'amountIqd'].includes(field)} type={field === 'priceIqd' || field === 'amountIqd' || field === 'seats' || field === 'sortOrder' ? 'number' : field === 'date' ? 'date' : field === 'phone' ? 'tel' : 'text'} min={field === 'seats' ? 1 : field === 'priceIqd' || field === 'amountIqd' || field === 'sortOrder' ? 0 : undefined} step="1" value={values[field] || ''} onChange={(e) => setValues({ ...values, [field]: e.target.value })} />}
    </label>)}</div>
    <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onClose}>{t.cancel}</button><button className="button button-primary" disabled={busy} data-testid="button-save-record">{busy && <LoaderCircle className="spin" size={15} />}{t.save}</button></div>
  </form></Modal>;
}

function ConfirmDialog({ t, busy, onClose, onConfirm, prompt = t.confirmDelete, title = t.delete }: { t: any; busy: boolean; onClose: () => void; onConfirm: () => void; prompt?: string; title?: string }) {
  return <Modal title={title} onClose={onClose}><div className="confirm-content"><span className="confirm-icon"><Trash2 size={20} /></span><p>{prompt}</p></div><div className="dialog-actions"><button className="button button-quiet" onClick={onClose}>{t.no}</button><button className="button button-danger" disabled={busy} onClick={onConfirm} data-testid="button-confirm-delete">{t.yesDelete}</button></div></Modal>;
}
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => { const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle); }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}><header className="modal-head"><h2>{title}</h2><button className="icon-button" onClick={onClose} type="button" aria-label="Close"><X size={18} /></button></header>{children}</section></div>;
}

function OrdersPage({ data, locale, t, actions, notify }: { data: AnyRecord; locale: Locale; t: any; actions: AnyRecord; notify: (message: string) => void }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [paymentOrder, setPaymentOrder] = useState<AnyRecord | null>(null);
  const [cancelPrompt, setCancelPrompt] = useState<AnyRecord | null>(null);
  const [newOrder, setNewOrder] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { const open = () => setNewOrder(true); window.addEventListener('open-new-order', open); return () => window.removeEventListener('open-new-order', open); }, []);
  const orders = data.orders.filter((o: AnyRecord) => filter === 'all' || o.status === filter).filter((o: AnyRecord) => JSON.stringify(o).toLowerCase().includes(search.toLowerCase()));
  async function pay(amount: number, method: string) {
    if (!paymentOrder) return;
    setBusy(true);
    try { await actions.addPayment(paymentOrder.id, { amountIqd: amount, method, createdAt: new Date() }); setPaymentOrder(null); notify(t.saved); }
    catch { notify(t.serverError); } finally { setBusy(false); }
  }
  async function cancel(order: AnyRecord) {
    setBusy(true);
    try { await actions.cancelOrder(order.id); notify(t.saved); } catch { notify(t.serverError); } finally { setBusy(false); }
  }
  return <>
    <div className="list-toolbar orders-toolbar"><label className="search-box"><Search size={17} /><input placeholder={t.search} value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-orders" /></label><div className="filter-pills">{[['all', t.all], ['open', t.open], ['paid', t.paid], ['cancelled', t.cancelled]].map(([key, label]) => <button key={key} className={filter === key ? 'filter-active' : ''} onClick={() => setFilter(key)} data-testid={`filter-orders-${key}`}>{label}</button>)}</div><button className="button button-primary mobile-order-add" onClick={() => setNewOrder(true)}><Plus size={16} />{t.newOrder}</button></div>
    {orders.length === 0 ? <EmptyState locale={locale} title={search ? t.noResults : t.noOrders} detail={search ? '' : t.startOrder} /> : <div className="order-cards">
      {orders.map((order: AnyRecord) => <OrderCard key={order.id} order={order} data={data} locale={locale} t={t} onPay={() => setPaymentOrder(order)} onCancel={() => setCancelPrompt(order)} busy={busy} />)}
    </div>}
    {paymentOrder && <PaymentDialog order={paymentOrder} locale={locale} t={t} busy={busy} onClose={() => setPaymentOrder(null)} onPay={pay} />}
    {cancelPrompt && <ConfirmDialog t={t} busy={busy} title={t.cancelOrder} prompt={t.confirmCancelOrder} onClose={() => setCancelPrompt(null)} onConfirm={async () => { await cancel(cancelPrompt); setCancelPrompt(null); }} />}
    {newOrder && <NewOrderDialog data={data} locale={locale} t={t} busy={busy} onClose={() => setNewOrder(false)} onCreate={async (payload) => {
      setBusy(true);
      try { await actions.createOrder(payload); setNewOrder(false); notify(t.saved); }
      catch { notify(t.serverError); } finally { setBusy(false); }
    }} />}
  </>;
}
function OrderCard({ order, data, locale, t, onPay, onCancel, busy }: { order: AnyRecord; data: AnyRecord; locale: Locale; t: any; onPay: () => void; onCancel: () => void; busy: boolean }) {
  const table = data.tables.find((x: AnyRecord) => x.id === order.tableId);
  const paid = (order.payments || []).reduce((s: number, p: AnyRecord) => s + Number(p.amountIqd || 0), 0);
  const statusLabel = order.status === 'paid' ? t.paid : order.status === 'cancelled' ? t.cancelled : t.open;
  return <article className="order-card" data-testid={`card-order-${order.id}`}><div className="order-card-top"><div className="order-card-meta"><span className={`status-badge ${order.status === 'paid' ? 'badge-paid' : order.status === 'cancelled' ? 'badge-cancelled' : 'badge-open'}`}>{statusLabel}</span><span className="order-date">{dateText(order.createdAt, locale)}</span></div><span className="order-table-tag"><Utensils size={14} />{table?.label || '—'}</span></div>
    <div className="order-lines">{(order.items || []).map((item: AnyRecord, i: number) => <div key={`${item.productId}-${i}`}><span>{localized(item, locale)} <small>× {item.quantity}</small></span><b>{formatIQD(item.unitPriceIqd * item.quantity, locale)}</b></div>)}</div>
    {order.notes && <p className="order-note">{order.notes}</p>}
    <div className="order-card-bottom"><div><small>{t.total}</small><b>{formatIQD(order.totalIqd, locale)}</b><small className="paid-note">{t.paidAmount}: {formatIQD(paid, locale)} · {t.pending}: {formatIQD(Math.max(0, order.totalIqd - paid), locale)}</small></div>
      {order.status !== 'paid' && order.status !== 'cancelled' && <div className="order-actions"><button className="button button-secondary small-button" onClick={onPay} data-testid={`button-payment-${order.id}`}><CreditCard size={15} />{t.addPayment}</button><button className="icon-button danger-icon" disabled={busy} title={t.cancelOrder} onClick={onCancel} data-testid={`button-cancel-order-${order.id}`}><X size={17} /></button></div>}
    </div>
  </article>;
}

function NewOrderDialog({ data, locale, t, busy, onClose, onCreate }: { data: AnyRecord; locale: Locale; t: any; busy: boolean; onClose: () => void; onCreate: (payload: AnyRecord) => void }) {
  const [tableId, setTableId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const products = data.products.filter((p: AnyRecord) => p.active !== false);
  const total = products.reduce((sum: number, p: AnyRecord) => sum + Number(p.priceIqd || 0) * (quantities[p.id] || 0), 0);
  const selectedItems = products.filter((p: AnyRecord) => quantities[p.id] > 0).map((p: AnyRecord) => ({ productId: p.id, nameKu: p.nameKu, nameAr: p.nameAr, quantity: quantities[p.id], unitPriceIqd: Number(p.priceIqd || 0) }));
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!tableId || !selectedItems.length) return;
    onCreate({ tableId, customerId: customerId || null, items: selectedItems, notes, status: 'open', totalIqd: total, payments: [], createdAt: new Date() });
  }
  return <Modal title={t.newOrder} onClose={onClose}><form className="dialog-form" onSubmit={submit}>
    <div className="form-grid"><label className="form-field"><span>{t.selectTable}</span><select required value={tableId} onChange={(e) => setTableId(e.target.value)}><option value="">{t.selectTable}</option>{data.tables.filter((x: AnyRecord) => x.active !== false).map((table: AnyRecord) => <option key={table.id} value={table.id}>{table.label} · {table.seats}</option>)}</select></label><label className="form-field"><span>{t.customer}</span><select value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">—</option>{data.customers.map((customer: AnyRecord) => <option key={customer.id} value={customer.id}>{customer.name || customer.phone}</option>)}</select></label></div>
    <div className="product-picker-head"><b>{t.chooseProducts}</b><span>{selectedItems.length} {t.items}</span></div>
    {products.length === 0 ? <EmptyState locale={locale} title={t.noProducts} /> : <div className="product-picker">{products.map((product: AnyRecord) => <div className="picker-product" key={product.id}><div><b>{localized(product, locale)}</b><small>{formatIQD(product.priceIqd, locale)}</small></div><div className="quantity-stepper"><button type="button" aria-label="Decrease" onClick={() => setQuantities({ ...quantities, [product.id]: Math.max(0, (quantities[product.id] || 0) - 1) })}>−</button><span>{quantities[product.id] || 0}</span><button type="button" aria-label="Increase" onClick={() => setQuantities({ ...quantities, [product.id]: (quantities[product.id] || 0) + 1 })}>+</button></div></div>)}</div>}
    <label className="form-field"><span>{t.noteOrder}</span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
    <div className="order-total"><span>{t.total}</span><b>{formatIQD(total, locale)}</b></div>
    <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onClose}>{t.cancel}</button><button className="button button-primary" disabled={busy || !tableId || !selectedItems.length} data-testid="button-create-order">{busy && <LoaderCircle className="spin" size={15} />}{t.createOrder}</button></div>
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
    <div className="dialog-actions"><button className="button button-quiet" type="button" onClick={onClose}>{t.cancel}</button><button className="button button-primary" disabled={busy || !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0 || Number(amount) > remaining} data-testid="button-submit-payment">{busy && <LoaderCircle className="spin" size={15} />}{t.addPayment}</button></div>
  </form></Modal>;
}

function Reports({ data, locale, t }: { data: AnyRecord; locale: Locale; t: any }) {
  const [from, setFrom] = useState(todayKey(new Date(Date.now() - 6 * 86400000)));
  const [to, setTo] = useState(todayKey());
  const orders = data.orders.filter((order: AnyRecord) => {
    const key = todayKey(asDate(order.createdAt));
    return key >= from && key <= to && order.status !== 'cancelled';
  });
  const expenses = data.expenses.filter((expense: AnyRecord) => String(expense.date || '').slice(0, 10) >= from && String(expense.date || '').slice(0, 10) <= to);
  const expenseTotal = expenses.reduce((sum: number, expense: AnyRecord) => sum + Number(expense.amountIqd || 0), 0);
  const salesByDay = useMemo(() => {
    const map: Record<string, number> = {};
    data.orders.filter((order: AnyRecord) => order.status !== 'cancelled').forEach((order: AnyRecord) => {
      (order.payments || []).forEach((payment: AnyRecord) => {
        const key = todayKey(asDate(payment.createdAt || order.createdAt));
        if (key >= from && key <= to) map[key] = (map[key] || 0) + Number(payment.amountIqd || 0);
      });
    });
    return map;
  }, [data.orders, from, to]);
  const sales = Object.values(salesByDay).reduce((sum, amount) => sum + amount, 0);
  const days = Object.keys(salesByDay).sort();
  const maxValue = Math.max(1, ...days.map((day) => salesByDay[day]));
  return <div className="reports-content">
    <div className="report-filters"><span><CalendarDays size={16} />{t.filterDate}</span><label>{t.from}<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} data-testid="input-report-from" /></label><label>{t.to}<input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} data-testid="input-report-to" /></label></div>
    <div className="report-metrics"><MetricCard icon={ArrowUpRight} label={t.revenue} value={formatIQD(sales, locale)} note={`${orders.length} ${t.ordersCount}`} tone="green" /><MetricCard icon={Wallet} label={t.costs} value={formatIQD(expenseTotal, locale)} note={`${expenses.length} ${t.expensesCount}`} tone="rose" /><MetricCard icon={Activity} label={t.net} value={formatIQD(sales - expenseTotal, locale)} note={`${from} — ${to}`} tone="gold" /></div>
    <section className="panel report-chart"><div className="panel-heading"><div><span className="panel-kicker">{t.reportTitle}</span><h3>{t.revenue}</h3></div><span className="report-range">{from} — {to}</span></div>
      {days.length === 0 ? <EmptyState locale={locale} /> : <div className="bar-chart">{days.map((day) => <div key={day} className="bar-column"><span className="bar-value">{formatIQD(salesByDay[day], locale)}</span><div className="bar-track"><i style={{ height: `${Math.max(4, (salesByDay[day] / maxValue) * 100)}%` }} /></div><small>{new Intl.DateTimeFormat(locale === 'ku' ? 'ckb-IQ' : 'ar-IQ', { day: 'numeric', month: 'short' }).format(new Date(`${day}T12:00:00`))}</small></div>)}</div>}
    </section>
    <section className="panel report-order-table"><div className="panel-heading"><div><span className="panel-kicker">{t.reportTitle}</span><h3>{t.allOrders}</h3></div><span className="count-tag">{orders.length}</span></div>{orders.length === 0 ? <EmptyState locale={locale} /> : <div className="data-table-wrap"><table className="data-table"><thead><tr><th>{t.created}</th><th>{t.table}</th><th>{t.total}</th><th>{t.paid}</th></tr></thead><tbody>{orders.map((order: AnyRecord) => <tr key={order.id}><td>{dateText(order.createdAt, locale)}</td><td>{data.tables.find((table: AnyRecord) => table.id === order.tableId)?.label || '—'}</td><td>{formatIQD(order.totalIqd, locale)}</td><td>{formatIQD((order.payments || []).reduce((s: number, p: AnyRecord) => s + Number(p.amountIqd || 0), 0), locale)}</td></tr>)}</tbody></table></div>}</section>
  </div>;
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
  return <div className="settings-layout"><section className="panel settings-panel"><div className="panel-heading"><div><span className="panel-kicker">QUBA · {t.restaurant}</span><h3>{t.restaurant}</h3></div><BriefcaseBusiness size={18} /></div><form className="settings-form" onSubmit={save}>
    <label className="form-field"><span>{t.nameKu}</span><input value={values.restaurantNameKu} onChange={(e) => setValues({ ...values, restaurantNameKu: e.target.value })} /></label>
    <label className="form-field"><span>{t.nameAr}</span><input value={values.restaurantNameAr} onChange={(e) => setValues({ ...values, restaurantNameAr: e.target.value })} /></label>
    <label className="form-field"><span>{t.defaultLanguage}</span><select value={values.defaultLocale} onChange={(e) => setValues({ ...values, defaultLocale: e.target.value })}><option value="ku">کوردی</option><option value="ar">العربية</option></select></label>
    <div className="settings-note"><Globe2 size={17} /><span>{locale === 'ku' ? 'هەردوو زمانەکە بە ئاراستەی ڕاست بۆ چەپ نیشان دەدرێن.' : 'تُعرض اللغتان باتجاه الكتابة من اليمين إلى اليسار.'}</span></div>
    <button className="button button-primary" type="submit" disabled={busy} data-testid="button-save-settings">{busy && <LoaderCircle className="spin" size={15} />}{t.saveSettings}</button>
  </form></section>
   <aside className="panel settings-aside"><span className="settings-emblem"><Coffee size={22} /></span><p className="eyebrow">QUBA · {t.ownerDesk}</p><h3>{localized(settings, locale, 'restaurantName') || 'QUBA'}</h3><p>{locale === 'ku' ? 'ئامرازێکی ڕوون بۆ بەڕێوەبردنی کارەکانی ڕۆژانە.' : 'مساحة واضحة لإدارة تفاصيل العمل اليومية.'}</p><div className="settings-aside-line"><span className="status-dot" />{locale === 'ku' ? 'داتاکانت لە Firebase پارێزراون' : 'بياناتك محفوظة في Firebase'}</div></aside></div>;
}

export default App;
