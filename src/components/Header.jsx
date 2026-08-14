import ThemeToggle from './ThemeToggle.jsx';

export default function Header() {
  return (
    <header className="header">
      <div className="header__title-group">
        <h1 className="header__title">RBI Repo Rate</h1>
        <span className="header__subtitle">
          Official RBI decisions, rate history, and source trail
        </span>
      </div>
      <div className="header__actions">
        <ThemeToggle />
      </div>
    </header>
  );
}
