import { CreditCard } from 'lucide-react';
import './AdminDashboard.css';

export default function AdminSubscriptionsPage() {
  return (
    <div className="adm">
      <div className="adm-hdr">
        <div>
          <p className="adm-brand">Apex · Markets</p>
          <h1 className="adm-title">Subscriptions</h1>
        </div>
      </div>
      <div className="adm-empty">
        <CreditCard size={28} style={{ opacity: 0.25 }} />
        <p>Subscriptions management coming soon</p>
      </div>
    </div>
  );
}
