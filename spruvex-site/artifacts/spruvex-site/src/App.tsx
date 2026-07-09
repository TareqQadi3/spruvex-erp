import { Switch, Route } from 'wouter';
import { LangProvider } from './context/LangContext';
import { useScrollAnimation } from './useScrollAnimation';
import Layout from './components/Layout';
import Home from './pages/Home';
import Erp from './pages/Erp';
import Pos from './pages/Pos';
import Restaurant from './pages/Restaurant';
import SalesRepair from './pages/SalesRepair';
import Pricing from './pages/Pricing';
import Features from './pages/Features';
import Faq from './pages/Faq';
import Contact from './pages/Contact';

export default function App() {
  useScrollAnimation();

  return (
    <LangProvider>
      <Layout>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/erp" component={Erp} />
          <Route path="/pos" component={Pos} />
          <Route path="/restaurant" component={Restaurant} />
          <Route path="/sales-repair" component={SalesRepair} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/features" component={Features} />
          <Route path="/faq" component={Faq} />
          <Route path="/contact" component={Contact} />
          <Route>
            <Home />
          </Route>
        </Switch>
      </Layout>
    </LangProvider>
  );
}
