import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/i18n";
import { AuthProvider, useAuth, canAccess } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/app-layout";
import LoginPage from "@/pages/login";

import Dashboard from "@/pages/dashboard";
import PosPage from "@/pages/pos";
import RepairsPage from "@/pages/repairs";
import NewRepairPage from "@/pages/repairs/new";
import RepairDetailPage from "@/pages/repairs/detail";
import InventoryPage from "@/pages/inventory";
import NewProductPage from "@/pages/inventory/new";
import CustomersPage from "@/pages/customers";
import CustomerDetailPage from "@/pages/customers/detail";
import AccountingPage from "@/pages/accounting";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import UsersSettingsPage from "@/pages/settings/users";
import PaymentMethodsSettingsPage from "@/pages/settings/payment-methods";
import WarehousesSettingsPage from "@/pages/settings/warehouses";
import InstallmentPlansSettingsPage from "@/pages/settings/installment-plans";
import SuppliersPage from "@/pages/suppliers";
import PurchasesPage from "@/pages/purchases";
import SalesPage from "@/pages/sales";
import VouchersPage from "@/pages/vouchers";

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
    return <LoginPage />;
  }

  if (!user) return <Redirect to="/login" />;

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={() => <GuardedPage component={Dashboard} basePath="/" />} />
        <Route path="/pos" component={() => <GuardedPage component={PosPage} basePath="/pos" />} />
        <Route path="/sales" component={() => <GuardedPage component={SalesPage} basePath="/sales" />} />
        <Route path="/repairs/new" component={() => <GuardedPage component={NewRepairPage} basePath="/repairs" />} />
        <Route path="/repairs/:id" component={() => <GuardedPage component={RepairDetailPage} basePath="/repairs" />} />
        <Route path="/repairs" component={() => <GuardedPage component={RepairsPage} basePath="/repairs" />} />
        <Route path="/inventory/new" component={() => <GuardedPage component={NewProductPage} basePath="/inventory" />} />
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
