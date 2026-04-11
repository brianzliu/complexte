import { useNavigate } from '@tanstack/react-router'
import { useDocumentStore } from '../store/useDocumentStore'
import type { Theme } from '../store/useDocumentStore'

const THEME_OPTIONS: { value: Theme; label: string; description: string }[] = [
  { value: 'dark', label: 'Dark', description: 'Dark background, light text' },
  { value: 'light', label: 'Light', description: 'Light background, dark text' },
  { value: 'auto', label: 'Auto', description: 'Follows your system setting' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { theme, setTheme } = useDocumentStore()

  return (
    <div className="settings-page">
      <div className="settings-topbar">
        <button className="settings-back-btn" onClick={() => navigate({ to: '/' })}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back
        </button>
        <h1 className="settings-title">Settings</h1>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-section-header">
            <h2 className="settings-section-title">Appearance</h2>
            <p className="settings-section-desc">Customize how Complexte looks on your device.</p>
          </div>

          <div className="settings-field">
            <div className="settings-field-label">Theme</div>
            <div className="theme-option-grid">
              {THEME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`theme-option ${theme === opt.value ? 'active' : ''}`}
                  onClick={() => setTheme(opt.value)}
                >
                  <div className="theme-preview theme-preview-dark">
                    {opt.value === 'dark' && <DarkPreview />}
                    {opt.value === 'light' && <LightPreview />}
                    {opt.value === 'auto' && <AutoPreview />}
                    {theme === opt.value && (
                      <div className="theme-check">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <span className="theme-label">{opt.label}</span>
                  <span className="theme-desc">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-header">
            <h2 className="settings-section-title">About</h2>
          </div>
          <div className="settings-about">
            <div className="settings-about-logo">
              <img src="/favicon.svg" alt="Complexte" draggable={false} />
            </div>
            <div className="settings-about-info">
              <span className="settings-about-name">Complexte</span>
              <span className="settings-about-version">Version 1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DarkPreview() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="80" rx="4" fill="#0d0d0d" />
      <rect x="0" y="0" width="36" height="80" fill="#111" />
      <rect x="6" y="10" width="24" height="3" rx="1.5" fill="#333" />
      <rect x="6" y="18" width="18" height="2" rx="1" fill="#252525" />
      <rect x="6" y="23" width="20" height="2" rx="1" fill="#252525" />
      <rect x="6" y="28" width="16" height="2" rx="1" fill="#252525" />
      <rect x="42" y="14" width="50" height="5" rx="2" fill="#222" />
      <rect x="42" y="24" width="66" height="2.5" rx="1" fill="#1a1a1a" />
      <rect x="42" y="30" width="58" height="2.5" rx="1" fill="#1a1a1a" />
      <rect x="42" y="36" width="62" height="2.5" rx="1" fill="#1a1a1a" />
      <rect x="42" y="46" width="38" height="2.5" rx="1" fill="#1e1e1e" />
    </svg>
  )
}

function LightPreview() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="80" rx="4" fill="#fafafa" />
      <rect x="0" y="0" width="36" height="80" fill="#f4f4f4" />
      <rect x="6" y="10" width="24" height="3" rx="1.5" fill="#bbb" />
      <rect x="6" y="18" width="18" height="2" rx="1" fill="#d4d4d4" />
      <rect x="6" y="23" width="20" height="2" rx="1" fill="#d4d4d4" />
      <rect x="6" y="28" width="16" height="2" rx="1" fill="#d4d4d4" />
      <rect x="42" y="14" width="50" height="5" rx="2" fill="#e5e5e5" />
      <rect x="42" y="24" width="66" height="2.5" rx="1" fill="#e8e8e8" />
      <rect x="42" y="30" width="58" height="2.5" rx="1" fill="#e8e8e8" />
      <rect x="42" y="36" width="62" height="2.5" rx="1" fill="#e8e8e8" />
      <rect x="42" y="46" width="38" height="2.5" rx="1" fill="#efefef" />
    </svg>
  )
}

function AutoPreview() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="left-half">
          <rect x="0" y="0" width="60" height="80" />
        </clipPath>
        <clipPath id="right-half">
          <rect x="60" y="0" width="60" height="80" />
        </clipPath>
      </defs>
      {/* Dark half */}
      <g clipPath="url(#left-half)">
        <rect width="120" height="80" rx="4" fill="#0d0d0d" />
        <rect x="0" y="0" width="36" height="80" fill="#111" />
        <rect x="6" y="10" width="24" height="3" rx="1.5" fill="#333" />
        <rect x="6" y="18" width="18" height="2" rx="1" fill="#252525" />
        <rect x="6" y="23" width="20" height="2" rx="1" fill="#252525" />
        <rect x="42" y="14" width="50" height="5" rx="2" fill="#222" />
        <rect x="42" y="24" width="66" height="2.5" rx="1" fill="#1a1a1a" />
        <rect x="42" y="30" width="58" height="2.5" rx="1" fill="#1a1a1a" />
      </g>
      {/* Light half */}
      <g clipPath="url(#right-half)">
        <rect width="120" height="80" rx="4" fill="#fafafa" />
        <rect x="0" y="0" width="36" height="80" fill="#f4f4f4" />
        <rect x="6" y="18" width="18" height="2" rx="1" fill="#d4d4d4" />
        <rect x="6" y="23" width="20" height="2" rx="1" fill="#d4d4d4" />
        <rect x="42" y="14" width="50" height="5" rx="2" fill="#e5e5e5" />
        <rect x="42" y="24" width="66" height="2.5" rx="1" fill="#e8e8e8" />
        <rect x="42" y="30" width="58" height="2.5" rx="1" fill="#e8e8e8" />
      </g>
      {/* Divider */}
      <line x1="60" y1="0" x2="60" y2="80" stroke="rgba(128,128,128,0.4)" strokeWidth="1" />
    </svg>
  )
}
