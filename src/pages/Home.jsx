import Dropdown from '../components/molecules/Dropdown.jsx'
import ToggleSwitch from '../components/atoms/ToggleSwitch.jsx'
import { useAppSettings, setAppSetting } from '../lib/appSettings.js'
import { RATIO_ASPECTS } from './_shared/exportSpecs.js'
import { THEME_OPTIONS } from '../lib/themes.js'

// Global default export aspect: 'native' (each page keeps its own Fill/Source
// row) or one of the /export-specs ratios. Default is 4:5.
const ASPECT_OPTIONS = [
  { value: 'native', label: 'Native (per page)' },
  ...RATIO_ASPECTS.map((a) => ({ value: a.value, label: a.label })),
]

export default function Home() {
  const { defaultAspect, defaultTheme, autoplay, clipToFrame } = useAppSettings()
  return (
    <main className="flex min-h-screen">
      <div className="p-8 md:p-12 w-1/2 bg-surface-primary">
      <p className="kol-helper-12 text-meta uppercase mb-2">kol-labs</p>
      <h1 className="kol-sans-display-01 text-emphasis mb-4">Experiments.</h1>
      <p className="kol-sans-body-01 text-body max-w-prose">
        A single self-contained lab — the KOL design system inlined as source,
        experiments mounted as routes behind the sidenav. Galleries, editor
        tools, and generative toys share one shell, one rail, one build.
      </p>

      <section className="mt-12 border-t border-fg-08 pt-6">
        <p className="kol-helper-12 text-meta uppercase mb-4">Settings</p>
        <div className="flex flex-col gap-1.5 max-w-xs">
          <label className="kol-helper-12 uppercase tracking-widest text-body">Default aspect</label>
          <Dropdown
            size="sm"
            variant="subtle"
            className="w-full"
            options={ASPECT_OPTIONS}
            value={defaultAspect}
            onChange={(v) => setAppSetting('defaultAspect', v)}
          />
          <p className="kol-mono-12 text-meta mt-1">
            The export frame every page opens with. Takes effect on pages you open next.
          </p>

          <label className="kol-helper-12 uppercase tracking-widest text-body mt-4">Default theme</label>
          <Dropdown
            size="sm"
            variant="subtle"
            className="w-full"
            options={THEME_OPTIONS}
            value={defaultTheme}
            onChange={(v) => setAppSetting('defaultTheme', v)}
          />
          <p className="kol-mono-12 text-meta mt-1">
            The theme every page opens with. Takes effect on pages you open next.
          </p>

          <div className="flex items-center justify-between mt-4">
            <label className="kol-helper-12 uppercase tracking-widest text-body">Autoplay on launch</label>
            <ToggleSwitch
              variant="plain"
              checked={!!autoplay}
              onChange={(v) => setAppSetting('autoplay', v)}
            />
          </div>
          <p className="kol-mono-12 text-meta mt-1">
            Pages start playing when you open them. Off by default.
          </p>

          <div className="flex items-center justify-between mt-4">
            <label className="kol-helper-12 uppercase tracking-widest text-body">Clip to frame</label>
            <ToggleSwitch
              variant="plain"
              checked={clipToFrame !== false}
              onChange={(v) => setAppSetting('clipToFrame', v)}
            />
          </div>
          <p className="kol-mono-12 text-meta mt-1">
            Exports crop to the chosen aspect frame. On by default.
          </p>
        </div>
      </section>
      </div>
      <img
        src="/images/kol-images/kol-radar-ascii-1781429047679.png"
        alt=""
        className="w-1/2 object-cover"
      />
    </main>
  )
}
