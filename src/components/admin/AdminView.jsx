import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import DocumentsTab from './DocumentsTab';
import { SETTINGS_PANEL_ROLES } from '../../utils/constants';

const BarangaysTab = lazy(() => import('./BarangaysTab'));
const AnalyticsTab = lazy(() => import('./AnalyticsTab'));
const MembersTab = lazy(() => import('./MembersTab'));
const SettingsTab = lazy(() => import('./SettingsTab'));
const ProfileTab = lazy(() => import('./ProfileTab'));
const UsersTab = lazy(() => import('./UsersTab'));
const SubscriptionTab = lazy(() => import('./SubscriptionTab'));
const ActivityLogTab = lazy(() => import('./ActivityLogTab'));

const TABS = [
  { id: 'docs', label: 'Documents', icon: 'fa-file-alt', group: 'records' },
  { id: 'members', label: 'Members', icon: 'fa-users', group: 'records' },
  { id: 'barangays', label: 'Barangays', icon: 'fa-map-marked-alt', group: 'records', roles: SETTINGS_PANEL_ROLES },
  { id: 'settings', label: 'Settings', icon: 'fa-sliders', group: 'administration', roles: SETTINGS_PANEL_ROLES },
  { id: 'profile', label: 'My Profile', icon: 'fa-user-circle', group: 'administration' },
  { id: 'users', label: 'Users', icon: 'fa-users-cog', group: 'administration', roles: SETTINGS_PANEL_ROLES },
  { id: 'analytics', label: 'Advanced Analytics', icon: 'fa-chart-bar', group: 'insights', roles: SETTINGS_PANEL_ROLES },
  { id: 'subscription', label: 'Subscription', icon: 'fa-tags', group: 'insights', roles: SETTINGS_PANEL_ROLES },
  { id: 'activity', label: 'Activity', icon: 'fa-history', group: 'insights', roles: SETTINGS_PANEL_ROLES },
];

const TAB_GROUPS = [
  { id: 'records', label: 'Records' },
  { id: 'administration', label: 'Administration' },
  { id: 'insights', label: 'Insights & Billing' },
];

/**
 * Admin management panel with tab navigation.
 * Phase 3: Replace top tab bar with left sidebar per PROJECT_REVIEW.md §3.
 */
export default function AdminView({ user, userRole, tenantId, documents, members, settings, navigateTo, showToast, publicPortalUrl }) {
  const [activeTab, setActiveTab] = useState('docs');
  const [activeGroup, setActiveGroup] = useState('records');
  const visibleTabs = TABS.filter(tab => !tab.roles || tab.roles.includes(userRole));
  const visibleGroups = useMemo(
    () => TAB_GROUPS.filter(group => visibleTabs.some(tab => tab.group === group.id)),
    [visibleTabs],
  );

  useEffect(() => {
    if (!visibleGroups.some(group => group.id === activeGroup)) {
      setActiveGroup(visibleGroups[0]?.id || 'records');
    }
  }, [activeGroup, visibleGroups]);

  const visibleTabsForGroup = visibleTabs.filter(tab => tab.group === activeGroup);

  useEffect(() => {
    if (visibleTabsForGroup.some(tab => tab.id === activeTab)) return;
    setActiveTab(visibleTabsForGroup[0]?.id || visibleTabs[0]?.id || 'docs');
  }, [activeTab, visibleTabs, visibleTabsForGroup]);

  const tabProps = { user, userRole, tenantId, documents, members, settings, showToast, publicPortalUrl };
  const tabFallback = (
    <div className="rounded-3xl border border-slate-100 bg-white p-10 text-center text-slate-400 shadow-sm">
      <i className="fas fa-spinner fa-spin text-2xl" />
      <p className="mt-3 text-sm font-semibold">Loading panel…</p>
    </div>
  );

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigateTo('public')}
            className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all"
          >
            <i className="fas fa-arrow-left text-sm" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white">
              <i className="fas fa-crown" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Management Panel</h2>
              <p className="text-slate-500 text-sm mt-0.5">Manage members and legislative documents</p>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-100 text-center">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Members</p>
            <p className="text-2xl font-black text-slate-900">{members.filter(m => !m.isArchived).length}</p>
          </div>
          <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-100 text-center">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Documents</p>
            <p className="text-2xl font-black text-slate-900">{documents.length}</p>
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {visibleGroups.map(group => (
          <button
            key={group.id}
            onClick={() => setActiveGroup(group.id)}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${
              activeGroup === group.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
            }`}
          >
            {group.label}
          </button>
        ))}
      </div>

      <div className="mb-8 overflow-x-auto border-b border-slate-200 pb-2">
        <div className="flex min-w-max gap-2">
          {visibleTabsForGroup.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-t-xl border-b-2 px-6 py-3 text-sm font-bold transition-all
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'}`}
            >
              <i className={`fas ${tab.icon} mr-2`} />{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'docs' && <DocumentsTab {...tabProps} />}
      {activeTab === 'members' && (
        <Suspense fallback={tabFallback}>
          <MembersTab {...tabProps} />
        </Suspense>
      )}
      {activeTab === 'barangays' && (
        <Suspense fallback={tabFallback}>
          <BarangaysTab {...tabProps} />
        </Suspense>
      )}
      {activeTab === 'settings' && (
        <Suspense fallback={tabFallback}>
          <SettingsTab {...tabProps} />
        </Suspense>
      )}
      {activeTab === 'profile' && (
        <Suspense fallback={tabFallback}>
          <ProfileTab {...tabProps} />
        </Suspense>
      )}
      {activeTab === 'users' && (
        <Suspense fallback={tabFallback}>
          <UsersTab {...tabProps} />
        </Suspense>
      )}
      {activeTab === 'subscription' && (
        <Suspense fallback={tabFallback}>
          <SubscriptionTab {...tabProps} />
        </Suspense>
      )}
      {activeTab === 'analytics' && (
        <Suspense fallback={tabFallback}>
          <AnalyticsTab {...tabProps} />
        </Suspense>
      )}
      {activeTab === 'activity' && (
        <Suspense fallback={tabFallback}>
          <ActivityLogTab {...tabProps} />
        </Suspense>
      )}

    </section>
  );
}
