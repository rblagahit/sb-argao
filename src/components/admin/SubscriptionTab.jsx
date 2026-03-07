import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const PLAN_META = {
  starter: {
    label: 'Starter',
    price: 'Free',
    tone: 'border-slate-200 bg-slate-50',
    badge: 'bg-slate-200 text-slate-700',
    features: [
      'Up to 200 legislative documents',
      '1 admin account',
      'Public document portal',
      'Members directory',
      'Basic branding',
    ],
  },
  standard: {
    label: 'Standard',
    price: 'PHP 1,500/mo',
    tone: 'border-blue-200 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    features: [
      'Unlimited documents',
      '1 admin + additional staff accounts',
      'Barangay sub-portals',
      'Full branding customization',
      'Usage and billing controls',
    ],
  },
  premium: {
    label: 'Premium',
    price: 'PHP 3,500/mo',
    tone: 'border-purple-200 bg-purple-50',
    badge: 'bg-purple-100 text-purple-700',
    features: [
      'Everything in Standard',
      'Unlimited staff accounts',
      'Unlimited barangay portals',
      'Custom domain support',
      'Activity audit log',
    ],
  },
};

function formatDate(value) {
  if (!value) return 'No expiry set';
  const dateValue = typeof value?.toDate === 'function'
    ? value.toDate()
    : value?.seconds
      ? new Date(value.seconds * 1000)
      : new Date(value);

  if (Number.isNaN(dateValue.getTime())) return 'No expiry set';
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(dateValue);
}

export default function SubscriptionTab({ tenantId, documents, members, publicPortalUrl, showToast }) {
  const [registry, setRegistry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      setRegistry(null);
      setLoading(false);
      return;
    }

    let ignore = false;

    const loadSubscription = async () => {
      setLoading(true);
      try {
        const snapshot = await getDoc(doc(db, 'lguRegistry', tenantId));
        if (!ignore) {
          setRegistry(snapshot.exists() ? snapshot.data() : null);
          setLoading(false);
        }
      } catch (error) {
        console.error('[SubscriptionTab]', error);
        if (!ignore) {
          showToast('Unable to load subscription details.', 'error');
          setLoading(false);
        }
      }
    };

    loadSubscription();
    return () => {
      ignore = true;
    };
  }, [showToast, tenantId]);

  const currentTier = registry?.tier || 'starter';
  const currentPlan = PLAN_META[currentTier] || PLAN_META.starter;
  const enabledFeatures = useMemo(() => {
    const raw = registry?.features || {};
    return Object.entries(raw).filter(([, enabled]) => enabled !== false);
  }, [registry]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-black text-slate-900">Subscription</h3>
        <p className="text-sm text-slate-500">Legacy recovery: current plan, tier flags, and quota context for this LGU.</p>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-100 bg-white px-6 py-16 text-center text-slate-400 shadow-sm">
          <i className="fas fa-spinner fa-spin text-2xl" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Current Tier</p>
              <div className="mt-3 flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${currentPlan.badge}`}>{currentPlan.label}</span>
                <span className="text-lg font-black text-slate-900">{currentPlan.price}</span>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Subscription Expiry</p>
              <p className="mt-3 text-lg font-black text-slate-900">{formatDate(registry?.subscriptionExpiry)}</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Documents Uploaded</p>
              <p className="mt-3 text-lg font-black text-slate-900">{documents.length}</p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Active Members</p>
              <p className="mt-3 text-lg font-black text-slate-900">{members.filter((member) => !member.isArchived).length}</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">Current LGU Status</p>
                  <h4 className="mt-2 text-lg font-black text-slate-900">{tenantId}</h4>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${registry?.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {registry?.paid ? 'Paid' : 'Unpaid'}
                </span>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <p><strong>Admin Email:</strong> {registry?.adminEmail || 'Not set'}</p>
                <p><strong>Public URL:</strong> {publicPortalUrl || 'Not available'}</p>
                <p><strong>Document Policy:</strong> {currentTier === 'starter' ? 'Starter quota applies.' : 'Unlimited document uploads on this tier.'}</p>
              </div>

              <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <p className="font-black">Plan features currently enabled</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {enabledFeatures.length ? enabledFeatures.map(([key]) => (
                    <span key={key} className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-wider text-blue-700">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                  )) : (
                    <span className="text-blue-700">No custom feature flags recorded for this LGU.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {Object.entries(PLAN_META).map(([tier, plan]) => (
                <div key={tier} className={`rounded-3xl border p-5 shadow-sm ${plan.tone}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">{plan.label}</p>
                      <p className="mt-1 text-xl font-black text-slate-900">{plan.price}</p>
                    </div>
                    {tier === currentTier ? (
                      <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${plan.badge}`}>Current</span>
                    ) : null}
                  </div>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <i className="fas fa-check mt-0.5 text-emerald-500 text-xs" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
