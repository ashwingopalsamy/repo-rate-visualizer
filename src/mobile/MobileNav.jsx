export default function MobileNav({ activeTab, onTabChange }) {
  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      id: 'changes',
      label: 'Changes',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="20" x2="12" y2="10" />
          <line x1="18" y1="20" x2="18" y2="4" />
          <line x1="6" y1="20" x2="6" y2="16" />
        </svg>
      ),
    },
    {
      id: 'more',
      label: 'More',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
          <circle cx="5" cy="12" r="1" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="mobile-nav" role="tablist" aria-label="Main navigation">
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          className={`mobile-nav__tab ${activeTab === tab.id ? 'mobile-nav__tab--active' : ''}`}
          aria-selected={activeTab === tab.id}
          aria-label={tab.label}
          onClick={() => onTabChange(tab.id)}
        >
          <span className="mobile-nav__icon">{tab.icon}</span>
          <span className="mobile-nav__label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
