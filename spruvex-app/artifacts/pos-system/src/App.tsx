import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/i18n";
import { AuthProvider, useAuth, canAccess } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/app-layout";

// Route-level code splitting: each page becomes its own chunk instead of one
// ~1.15MB bundle loaded up front for every user regardless of which pages
// they ever visit. Only NotFound (tiny, always the Switch's fallback route)
// stays a static import — everything else is fetched on first navigation to
// that route and cached by the browser after.
const LoginPage = lazy(() => import("@/pages/login"));
const SignupPage = lazy(() => import("@/pages/signup"));

const Dashboard = lazy(() => import("@/pages/dashboard"));
const PosPage = lazy(() => import("@/pages/pos"));
const RepairsPage = lazy(() => import("@/pages/repairs"));
const NewRepairPage = lazy(() => import("@/pages/repairs/new"));
const RepairDetailPage = lazy(() => import("@/pages/repairs/detail"));
const InventoryPage = lazy(() => import("@/pages/inventory"));
const NewProductPage = lazy(() => import("@/pages/inventory/new"));
const StockMovementsPage = lazy(() => import("@/pages/inventory/movements"));
const CustomersPage = lazy(() => import("@/pages/customers"));
const CustomerDetailPage = lazy(() => import("@/pages/customers/detail"));
const AccountingPage = lazy(() => import("@/pages/accounting"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const UsersSettingsPage = lazy(() => import("@/pages/settings/users"));
const PaymentMethodsSettingsPage = lazy(() => import("@/pages/settings/payment-methods"));
const WarehousesSettingsPage = lazy(() => import("@/pages/settings/warehouses"));
const InstallmentPlansSettingsPage = lazy(() => import("@/pages/settings/installment-plans"));
const SuppliersPage = lazy(() => import("@/pages/suppliers"));
const PurchasesPage = lazy(() => import("@/pages/purchases"));
const SalesPage = lazy(() => import("@/pages/sales"));
const VouchersPage = lazy(() => import("@/pages/vouchers"));

function PageLoadingSpinner() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

const queryClient = new QueryClient();

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

  if (!user) return <Redirect to="/login" />;

  return (
    <AppLayout>
      <Suspense fallback={<PageLoadingSpinner />}>
      <Switch>
        <Route path="/" component={() => <GuardedPage component={Dashboard} basePath="/" />} />
        <Route path="/pos" component={() => <GuardedPage component={PosPage} basePath="/pos" />} />
        <Route path="/sales" component={() => <GuardedPage component={SalesPage} basePath="/sales" />} />
        <Route path="/repairs/new" component={() => <GuardedPage component={NewRepairPage} basePath="/repairs" />} />
        <Route path="/repairs/:id" component={() => <GuardedPage component={RepairDetailPage} basePath="/repairs" />} />
        <Route path="/repairs" component={() => <GuardedPage component={RepairsPage} basePath="/repairs" />} />
        <Route path="/inventory/new" component={() => <GuardedPage component={NewProductPage} basePath="/inventory" />} />
        <Route path="/inventory/movements" component={() => <GuardedPage component={StockMovementsPage} basePath="/inventory" />} />
        <Route path="/inventory" component={() => <GuardedPage component={InventoryPage} basePath="/inventory" />} />
        <Route path="/customers/:id" component={() => <GuardedPage component={CustomerDetailPage} basePath="/customers" />} />
        <Route path="/customers" component={() => <GuardedPage component={CustomersPage} basePath="/customers" />} />
        <Route path="/suppliers" component={() => <GuardedPage component={SuppliersPage} basePath="/suppliers" />} />
        <Route path="/purchases" component={() => <GuardedPage component={PurchasesPage} basePath="/purchases" />} />
        <Route path="/vouchers" component={() => <GuardedPage component={VouchersPage} basePath="/vouchers" />} />
        <Route path="/accounting" component={() => <GuardedPage component={AccountingPage} basePath="/accounting" />} />
        <Route path="/reports" component={() => <GuardedPage component={ReportsPage} basePath="/reports" />} />
        <Route path="/settings/users" component={() => <GuardedPage component={UsersSettingsPage} basePath="/settings" adminOnly />} />
        <Route path="/settings/payment-methods" component={() => <GuardedPage component={PaymentMethodsSettingsPage} basePath="/settings" />} />
        <Route path="/settings/warehouses" component={() => <GuardedPage component={WarehousesSettingsPage} basePath="/settings" />} />
        <Route path="/settings/installment-plans" component={() => <GuardedPage component={InstallmentPlansSettingsPage} basePath="/settings" />} />
        <Route path="/settings" component={() => <GuardedPage component={SettingsPage} basePath="/settings" />} />
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
