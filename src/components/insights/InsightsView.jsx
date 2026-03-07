import InsightsDashboard from './InsightsDashboard';

export default function InsightsView({ documents, members, navigateTo, showToast }) {
  return (
    <InsightsDashboard
      documents={documents}
      members={members}
      title="Public Insights"
      subtitle="Document performance, sponsor activity, and committee trends."
      showBack
      onBack={() => navigateTo('public')}
      showToast={showToast}
    />
  );
}
