import { lazy, Suspense, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGetSettings } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/i18n";
import { AuthProvider, useAuth, canAccess } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/app-layout";
import { SetupWizardOverlay } from "@/components/SetupWizardOverlay";
import { BranchSelectOverlay } from "@/components/BranchSelectOverlay";

// Route-level code splitting: each page becomes its own chunk instead of one
// ~1.15MB bundle loaded up front for every user regardless of which pages
// they ever visit. Only NotFound (tiny, always the Switch's fallback route)
// stays a static import — everything else is fetched on first navigation to
// that route and cached by the browser after.
const LoginPage = lazy(() => import("@/pages/login"));
const SignupPage = lazy(() => import("@/pages/signup"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));

const Dashboard = lazy(() => import("@/pages/dashboard"));
const PosPage = lazy(() => import("@/pages/pos"));
const RepairsPage = lazy(() => import("@/pages/repairs"));
const NewRepairPage = lazy(() => import("@/pages/repairs/new"));
const RepairDetailPage = lazy(() => import("@/pages/repairs/detail"));
const InventoryPage = lazy(() => import("@/pages/inventory"));
const NewProductPage = lazy(() => import("@/pages/inventory/new"));
const EditProductPage = lazy(() => import("@/pages/inventory/edit"));
const CategoriesPage = lazy(() => import("@/pages/inventory/categories"));
const BrandsPage = lazy(() => import("@/pages/inventory/brands"));
const ManageProductPage = lazy(() => import("@/pages/inventory/manage"));
const ImportExportPage = lazy(() => import("@/pages/settings/import-export"));
const AuditLogPage = lazy(() => import("@/pages/settings/audit-log"));
const RolesPage = lazy(() => import("@/pages/settings/roles"));
const StockMovementsPage = lazy(() => import("@/pages/inventory/movements"));
const CustomersPage = lazy(() => import("@/pages/customers"));
const CustomerDetailPage = lazy(() => import("@/pages/customers/detail"));
const AccountingPage = lazy(() => import("@/pages/accounting"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const UsersSettingsPage = lazy(() => import("@/pages/settings/users"));
const PaymentMethodsSettingsPage = lazy(() => import("@/pages/settings/payment-methods"));
const WarehousesSettingsPage = lazy(() => import("@/pages/settings/warehouses"));
const InvoiceBuilderPage = lazy(() => import("@/pages/settings/invoice-builder"));
const IntegrationsPage = lazy(() => import("@/pages/settings/integrations"));
const BranchesSettingsPage = lazy(() => import("@/pages/settings/branches"));
const InstallmentPlansSettingsPage = lazy(() => import("@/pages/settings/installment-plans"));
const SuppliersPage = lazy(() => import("@/pages/suppliers"));
const PurchasesPage = lazy(() => import("@/pages/purchases"));
const SalesPage = lazy(() => import("@/pages/sales"));
const SalesReturnsModule = lazy(() => import("@/pages/sales/returns"));
const VouchersPage = lazy(() => import("@/pages/vouchers"));

function PageLoadingSpinner() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

// staleTime > 0 so cached data is served without a network round-trip for a
// short window — the default (staleTime: 0) means every single render of
// every component that calls the same query hook can trigger its own
// "refetch on mount" check, which is normally harmless (react-query dedupes
// concurrent identical requests) but turns pathological under a render storm
// (several components sharing one query key, each mounting/unmounting
// rapidly) into a real request flood that trips rate limiting. Read data
// this stale-tolerant is fine for settings/catalog data that changes rarely;
// mutations still invalidate immediately.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function AccessDenied() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center p-8">
      <div className="text-5xl">🔒</div>
      <h2 className="text-xl font-bold">Access Denied</h2>
      <p className="text-muted-foreground text-sm">You don't have permission to view this page.</p>
    </div>
  );
}

function GuardedPage({ component: Component, basePath, adminOnly }: { component: React.ComponentType; basePath: string; adminOnly?: boolean }) {
  const { user } = useAuth();
  if (!user) return <Redirect to="/login" />;
  if (!canAccess(user.role, basePath)) return <AccessDenied />;
  if (adminOnly && user.role !== "admin") return <AccessDenied />;
  return <Component />;
}

function AppRouter() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (location === "/login") {
    if (user) return <Redirect to="/" />;
    return (
      <Suspense fallback={<PageLoadingSpinner />}>
        <LoginPage />
      </Suspense>
    );
  }

  if (location === "/signup") {
    if (user) return <Redirect to="/" />;
    return (
      <Suspense fallback={<PageLoadingSpinner />}>
        <SignupPage />
      </Suspense>
    );
  }

  if (location === "/forgot-password") {
    if (user) return <Redirect to="/" />;
    return (
      <Suspense fallback={<PageLoadingSpinner />}>
        <ForgotPasswordPage />
      </Suspense>
    );
  }

  if (!user) return <Redirect to="/login" />;

  return <AuthenticatedApp />;
}

// Isolated from AppRouter on purpose: AppRouter re-renders on every route
// change (useLocation), and this component's own useGetSettings call/state
// don't need to. Hoisting the settings fetch + wizard-gate state into
// AppRouter caused a request burst on every navigation in testing — mounting
// it once here, below the route switch, keeps the settings query's
// lifecycle tied to "authenticated session", not "current URL".
// Persisted by signup.tsx right before navigation so the first-run setup
// wizard can pre-fill its business-type step with what the merchant chose at
// signup (it would otherwise default to "other" and silently overwrite the
// real choice). Read-once: removed here so re-renders don't re-apply it.
function readSignupBusinessType(): string | null {
  const saved = localStorage.getItem("spruvex_signup_business_type");
  if (saved) localStorage.removeItem("spruvex_signup_business_type");
  return saved;
}

// Two routes, one page: the same list rendered with a different title/filter
// intent — returned invoices (/sales/returns) vs. the credit notes they
// produce (/sales/credit-notes). No duplicated page code.
function SalesReturns() {
  return <SalesReturnsModule variant="returns" />;
}
function CreditNotes() {
  return <SalesReturnsModule variant="credit-notes" />;
}

function AuthenticatedApp() {
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const { data: settings } = useGetSettings();
  const { pendingBranches } = useAuth();

  if (pendingBranches) {
    return <BranchSelectOverlay branches={pendingBranches} />;
  }

  if (settings && settings.setupCompleted === false && !wizardDismissed) {
    return <SetupWizardOverlay initialBusinessType={readSignupBusinessType()} onFinished={() => setWizardDismissed(true)} />;
  }

  return (
    <AppLayout>
      <Suspense fallback={<PageLoadingSpinner />}>
      <Switch>
        <Route path="/"><GuardedPage component={Dashboard} basePath="/" /></Route>
        <Route path="/pos"><GuardedPage component={PosPage} basePath="/pos" /></Route>
        <Route path="/sales"><GuardedPage component={SalesPage} basePath="/sales" /></Route>
        <Route path="/sales/returns"><GuardedPage component={SalesReturns} basePath="/sales" /></Route>
        <Route path="/sales/credit-notes"><GuardedPage component={CreditNotes} basePath="/sales" /></Route>
        <Route path="/repairs/new"><GuardedPage component={NewRepairPage} basePath="/repairs" /></Route>
        <Route path="/repairs/:id"><GuardedPage component={RepairDetailPage} basePath="/repairs" /></Route>
        <Route path="/repairs"><GuardedPage component={RepairsPage} basePath="/repairs" /></Route>
        <Route path="/inventory/new"><GuardedPage component={NewProductPage} basePath="/inventory" /></Route>
        <Route path="/inventory/:id/edit"><GuardedPage component={EditProductPage} basePath="/inventory" /></Route>
        <Route path="/inventory/categories"><GuardedPage component={CategoriesPage} basePath="/inventory" /></Route>
        <Route path="/inventory/brands"><GuardedPage component={BrandsPage} basePath="/inventory" /></Route>
        <Route path="/inventory/:id/manage"><GuardedPage component={ManageProductPage} basePath="/inventory" /></Route>
        <Route path="/inventory/movements"><GuardedPage component={StockMovementsPage} basePath="/inventory" /></Route>
        <Route path="/inventory"><GuardedPage component={InventoryPage} basePath="/inventory" /></Route>
        <Route path="/customers/:id"><GuardedPage component={CustomerDetailPage} basePath="/customers" /></Route>
        <Route path="/customers"><GuardedPage component={CustomersPage} basePath="/customers" /></Route>
        <Route path="/suppliers"><GuardedPage component={SuppliersPage} basePath="/suppliers" /></Route>
        <Route path="/purchases"><GuardedPage component={PurchasesPage} basePath="/purchases" /></Route>
        <Route path="/vouchers"><GuardedPage component={VouchersPage} basePath="/vouchers" /></Route>
        <Route path="/accounting"><GuardedPage component={AccountingPage} basePath="/accounting" /></Route>
        <Route path="/reports"><GuardedPage component={ReportsPage} basePath="/reports" /></Route>
        <Route path="/settings/users"><GuardedPage component={UsersSettingsPage} basePath="/settings" adminOnly /></Route>
        <Route path="/settings/payment-methods"><GuardedPage component={PaymentMethodsSettingsPage} basePath="/settings" /></Route>
        <Route path="/settings/invoice-builder"><GuardedPage component={InvoiceBuilderPage} basePath="/settings" /></Route>
        <Route path="/settings/integrations"><GuardedPage component={IntegrationsPage} basePath="/settings" /></Route>
        <Route path="/settings/warehouses"><GuardedPage component={WarehousesSettingsPage} basePath="/settings" /></Route>
        <Route path="/settings/branches"><GuardedPage component={BranchesSettingsPage} basePath="/settings" adminOnly /></Route>
        <Route path="/settings/installment-plans"><GuardedPage component={InstallmentPlansSettingsPage} basePath="/settings" /></Route>
        <Route path="/settings/import-export"><GuardedPage component={ImportExportPage} basePath="/settings" /></Route>
        <Route path="/settings/audit-log"><GuardedPage component={AuditLogPage} basePath="/settings" adminOnly /></Route>
        <Route path="/settings/roles"><GuardedPage component={RolesPage} basePath="/settings" adminOnly /></Route>
        <Route path="/settings"><GuardedPage component={SettingsPage} basePath="/settings" /></Route>
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </AppLayout>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AuthProvider>
                <AppRouter />
              </AuthProvider>
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
