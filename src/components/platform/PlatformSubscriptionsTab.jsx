import { useEffect, useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const DEFAULT_PRICING = {
  starter: { monthlyPrice: 0, docLimit: 200, additionalUsers: 0 },
  standard: { monthlyPrice: 1500, docLimit: -1, additionalUsers: 3 },
  premium: { monthlyPrice: 3500, docLimit: -1, additionalUsers: -1 },
};

const TIER_META = {
  starter: { label: 'Starter', tone: 'bg-slate-50 border-slate-200 text-slate-700' },
  standard: { label: 'Standard', tone: 'bg-blue-50 border-blue-200 text-blue-700' },
  premium: { label: 'Premium', tone: 'bg-purple-50 border-purple-200 text-purple-700' },
};

function normalizePricing(raw = {}) {
  return {
    starter: {
      monthlyPrice: Number(raw.starter?.monthlyPrice ?? DEFAULT_PRICING.starter.monthlyPrice),
      docLimit: Number(raw.starter?.docLimit ?? DEFAULT_PRICING.starter.docLimit),
      additionalUsers: 0,
    },
    standard: {
      monthlyPrice: Number(raw.standard?.monthlyPrice ?? DEFAULT_PRICING.standard.monthlyPrice),
      docLimit: Number(raw.standard?.docLimit ?? DEFAULT_PRICING.standard.docLimit),
      additionalUsers: Number(raw.standard?.additionalUsers ?? DEFAULT_PRICING.standard.additionalUsers),
    },
    premium: {
      monthlyPrice: Number(raw.premium?.monthlyPrice ?? DEFAULT_PRICING.premium.monthlyPrice),
      docLimit: Number(raw.premium?.docLimit ?? DEFAULT_PRICING.premium.docLimit),
      additionalUsers: Number(raw.premium?.additionalUsers ?? DEFAULT_PRICING.premium.additionalUsers),
    },
  };
}

function formatDateInput(value) {
  if (!value) return '';
  const dateValue = typeof value?.toDate === 'function'
    ? value.toDate()
    : value?.seconds
      ? new Date(value.seconds * 1000)
      : new Date(value);
  if (Number.isNaN(dateValue.getTime())) return '';
  return dateValue.toISOString().slice(0, 10);
}

function tierBadge(tier = 'starter') {
  const safeTier = TIER_META[tier] ? tier : 'starter';
  return TIER_META[safeTier];
}

function formatCurrency(amount = 0) {
  if (Number(amount) <= 0) return 'Free';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function quotaLabel(limit = 0) {
  return Number(limit) < 0 ? 'Unlimited' : `${limit} docs`;
}

function usersLabel(count = 0) {
  return Number(count) < 0 ? 'Unlimited users' : `${count} additional users`;
}

export default function PlatformSubscriptionsTab({
  lguRegistry,
  setupSettings,
  refreshPlatformData,
  showToast,
  user,
}) {
  const [pricing, setPricing] = useState(() => normalizePricing(setupSettings?.subscriptionPricing));
  const [savingPricing, setSavingPricing] = useState(false);
  const [savingLguId, setSavingLguId] = useState('');

  useEffect(() => {
    setPricing(normalizePricing(setupSettings?.subscriptionPricing));
  }, [setupSettings]);

  const sortedRegistry = useMemo(() => (
    [...lguRegistry].sort((a, b) => (a.displayName || a.lguName || a.id).localeCompare(b.displayName || b.lguName || b.id))
  ), [lguRegistry]);

  const handlePricingChange = (tier, key, value) => {
    setPricing((current) => ({
      ...current,
      [tier]: {
        ...current[tier],
        [key]: Number(value),
      },
    }));
  };

  const savePricing = async () => {
    setSavingPricing(true);
    try {
      await setDoc(doc(db, 'setup', 'bootstrapped'), {
        subscriptionPricing: pricing,
        pricingUpdatedAt: serverTimestamp(),
        pricingUpdatedBy: user?.uid || null,
      }, { merge: true });
      showToast('Platform pricing saved.', 'success');
      await refreshPlatformData(false);
    } catch (error) {
      console.error('[PlatformSubscriptionsTab.savePricing]', error);
      showToast('Unable to save pricing.', 'error');
    } finally {
      setSavingPricing(false);
    }
  };

  const saveLguSubscription = async (entryId) => {
    const tier = document.getElementById(`platform-tier-${entryId}`)?.value || 'starter';
    const expiry = document.getElementById(`platform-expiry-${entryId}`)?.value || '';
    const paid = Boolean(document.getElementById(`platform-paid-${entryId}`)?.checked);
    const advancedAnalytics = Boolean(document.getElementById(`platform-feature-analytics-${entryId}`)?.checked);
    const additionalUsers = Boolean(document.getElementById(`platform-feature-users-${entryId}`)?.checked);
    const barangayPortals = Boolean(document.getElementById(`platform-feature-barangays-${entryId}`)?.checked);

    setSavingLguId(entryId);
    try {
      await setDoc(doc(db, 'lguRegistry', entryId), {
        tier,
        paid,
        subscriptionExpiry: expiry ? new Date(`${expiry}T00:00:00`) : null,
        features: {
          advancedAnalytics,
          additionalUsers,
          barangayPortals,
        },
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || null,
      }, { merge: true });
      showToast(`Subscription updated for ${entryId}.`, 'success');
      await refreshPlatformData(false);
    } catch (error) {
      console.error('[PlatformSubscriptionsTab.saveLguSubscription]', error);
      showToast('Unable to save LGU subscription.', 'error');
    } finally {
      setSavingLguId('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-black text-slate-900">Service Packages</h3>
        <p className="text-sm text-slate-500">Restore pricing and LGU subscription controls from the legacy platform dashboard.</p>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Tier Pricing Configuration</p>
            <p className="mt-1 text-sm text-slate-500">Saved in `setup/bootstrapped.subscriptionPricing`.</p>
          </div>
          <button
            type="button"
            onClick={savePricing}
            disabled={savingPricing}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <i className={`fas ${savingPricing ? 'fa-spinner fa-spin' : 'fa-save'} mr-2 text-xs`} />
            Save Pricing
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {Object.entries(pricing).map(([tier, values]) => {
            const meta = tierBadge(tier);
            return (
              <div key={tier} className={`rounded-3xl border p-5 shadow-sm ${meta.tone}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">{meta.label}</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(values.monthlyPrice)}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-700">
                    {quotaLabel(values.docLimit)}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-400">Monthly Price</label>
                    <input
                      type="number"
                      min="0"
                      value={values.monthlyPrice}
                      onChange={(event) => handlePricingChange(tier, 'monthlyPrice', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-400">Document Limit</label>
                    <input
                      type="number"
                      value={values.docLimit}
                      onChange={(event) => handlePricingChange(tier, 'docLimit', event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">Use `-1` for unlimited documents.</p>
                  </div>
                  {tier !== 'starter' ? (
                    <div>
                      <label className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-400">Additional Users</label>
                      <input
                        type="number"
                        value={values.additionalUsers}
                        onChange={(event) => handlePricingChange(tier, 'additionalUsers', event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">Use `-1` for unlimited users.</p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 rounded-2xl bg-white/80 px-4 py-3 text-sm font-semibold text-slate-600">
                  {usersLabel(values.additionalUsers)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">LGU Subscription Assignments</p>
          <p className="mt-1 text-sm text-slate-500">Set tier, expiry, payment status, and feature flags per LGU.</p>
        </div>

        <div className="space-y-4">
          {sortedRegistry.map((entry) => {
            const tier = entry.tier || 'starter';
            const meta = tierBadge(tier);
            return (
              <div key={entry.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-900">{entry.displayName || entry.lguName || entry.id}</p>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${meta.tone.replace('border-', 'bg-').replace(' p-5 shadow-sm', '')}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{entry.adminEmail || 'No admin email recorded'}</p>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[180px_160px_auto] xl:min-w-[580px]">
                    <select
                      id={`platform-tier-${entry.id}`}
                      defaultValue={tier}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    >
                      {Object.entries(TIER_META).map(([key, value]) => (
                        <option key={key} value={key}>{value.label}</option>
                      ))}
                    </select>
                    <input
                      id={`platform-expiry-${entry.id}`}
                      type="date"
                      defaultValue={formatDateInput(entry.subscriptionExpiry)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                    />
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <input id={`platform-paid-${entry.id}`} type="checkbox" defaultChecked={Boolean(entry.paid)} className="h-4 w-4 accent-emerald-600" />
                      <label htmlFor={`platform-paid-${entry.id}`} className="text-sm font-semibold text-slate-700">Paid subscription</label>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                    <input
                      id={`platform-feature-analytics-${entry.id}`}
                      type="checkbox"
                      defaultChecked={entry.features?.advancedAnalytics !== false && tier !== 'starter'}
                      className="h-4 w-4 accent-blue-600"
                    />
                    Advanced analytics
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                    <input
                      id={`platform-feature-users-${entry.id}`}
                      type="checkbox"
                      defaultChecked={entry.features?.additionalUsers !== false && tier !== 'starter'}
                      className="h-4 w-4 accent-blue-600"
                    />
                    Additional users
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                    <input
                      id={`platform-feature-barangays-${entry.id}`}
                      type="checkbox"
                      defaultChecked={entry.features?.barangayPortals !== false && tier !== 'starter'}
                      className="h-4 w-4 accent-blue-600"
                    />
                    Barangay portals
                  </label>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => saveLguSubscription(entry.id)}
                    disabled={savingLguId === entry.id}
                    className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-sm font-bold text-white transition-all hover:from-blue-700 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <i className={`fas ${savingLguId === entry.id ? 'fa-spinner fa-spin' : 'fa-save'} mr-2 text-xs`} />
                    Save LGU Subscription
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
