import { useRef, useState, useEffect, useCallback } from 'react';

export default function MobileNav({ activeTab, onTabChange }) {
  const navRef = useRef(null);
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const [isPressed, setIsPressed] = useState(null);

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

  const updateIndicator = useCallback(() => {
    if (!navRef.current) return;
    const activeIndex = tabs.findIndex(t => t.id === activeTab);
    if (activeIndex < 0) return;

    const tabElements = navRef.current.querySelectorAll('.mobile-nav__tab');
    const activeEl = tabElements[activeIndex];
    if (!activeEl) return;

    const navRect = navRef.current.getBoundingClientRect();
    const tabRect = activeEl.getBoundingClientRect();

    setIndicatorStyle({
      width: `${tabRect.width}px`,
      transform: `translateX(${tabRect.left - navRect.left}px)`,
    });
  }, [activeTab]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  const handleTabPress = (tabId) => {
    setIsPressed(tabId);
    requestAnimationFrame(() => {
      setTimeout(() => {
        onTabChange(tabId);
        setIsPressed(null);
      }, 80);
    });
  };

  return (
    <nav className="mobile-nav" ref={navRef} role="tablist" aria-label="Main navigation">
      {/* Liquid active indicator */}
      <div
        className="mobile-nav__indicator"
        style={indicatorStyle}
        aria-hidden="true"
      />

      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        const pressing = isPressed === tab.id;

        return (
          <button
            key={tab.id}
            role="tab"
            className={[
              'mobile-nav__tab',
              isActive ? 'mobile-nav__tab--active' : '',
              pressing ? 'mobile-nav__tab--pressed' : '',
            ].filter(Boolean).join(' ')}
            aria-selected={isActive}
            aria-label={tab.label}
            onClick={() => handleTabPress(tab.id)}
          >
            <span className="mobile-nav__icon">{tab.icon}</span>
            <span className="mobile-nav__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
