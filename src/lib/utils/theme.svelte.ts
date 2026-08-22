// Theme (light/dark) — owned by the app.
//
// There used to be two owners fighting. The `ThemeToggle` from
// `@tabeladev/tabelawebui` is hardcoded inside `AppShellSidebar` (no prop, no
// snippet to replace it) and on click writes straight to the root element and to
// `localStorage['theme']`. In parallel, `mode-watcher` decided the theme from ITS
// own key (`mode-watcher-mode`). Neither read the other's: the user's explicit
// choice did not survive a reload (mode-watcher recomputed from the OS preference
// on hydration) and `mode.current` — which picks the chart palette — never
// followed the click.
//
// Aligning the two keys did not fix it: mode-watcher's `UserPrefersMode` reads
// storage at module import, before the `modeStorageKey` prop is applied, and on a
// key change it carries the OLD key's value in as the new one's default. Since
// nothing else in the app used the library, it was dropped: one owner, one key.
//
// The root element is the source of truth because it is what the library's toggle
// writes, and what the pre-paint script in `app.html` has already resolved before
// the first frame (which is why there is no flash). This module only observes it.
import { browser } from '$app/environment';

export type Mode = 'light' | 'dark';

/** The same key the tabelawebui ThemeToggle writes. */
const STORAGE_KEY = 'theme';

function readFromDom(): Mode {
	return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

// Mirrors exactly what the inline script in `app.html` does. The duplication is
// inherent to the problem: that script has to run before any module loads, so it
// cannot import from here.
//
// The attribute writes are guarded on an actual change: re-assigning
// `style.colorScheme` rewrites the style attribute even when the value is
// identical, and this runs from a MutationObserver callback on every class
// change. `classList.toggle` already no-ops when the class list is unchanged.
function applyToDom(next: Mode): void {
	const el = document.documentElement;
	el.classList.toggle('dark', next === 'dark');
	el.classList.toggle('light', next === 'light');
	if (el.getAttribute('data-theme') !== next) el.setAttribute('data-theme', next);
	if (el.style.colorScheme !== next) el.style.colorScheme = next;
}

class ThemeState {
	// There is no way to know the theme during SSR; the real value lands on
	// hydration, when `start()` reads the root element the pre-paint script fixed.
	#current = $state<Mode>('dark');

	get current(): Mode {
		return this.#current;
	}

	/** Applies a mode and persists the choice. */
	set(next: Mode): void {
		if (!browser) return;
		localStorage.setItem(STORAGE_KEY, next);
		applyToDom(next);
		this.#current = next;
	}

	toggle(): void {
		this.set(this.#current === 'dark' ? 'light' : 'dark');
	}

	/**
	 * Starts mirroring the root element. Called once from the root layout; returns
	 * the cleanup function.
	 */
	start(): () => void {
		this.#current = readFromDom();

		// The library's toggle mutates the class without telling anyone — observing
		// is the only coupling point available. This goes away once tabelawebui
		// accepts a callback on the toggle (request
		// 20260817-theme-toggle-integravel.md).
		//
		// It also only touches `dark` and `data-theme`: it never adds the `light`
		// class nor fixes `color-scheme`, so the scrollbar and native controls stayed
		// dark under the light theme. `applyToDom` normalises that — it is idempotent,
		// and since only the class is observed it converges in one step instead of
		// feeding the observer back into itself.
		const observer = new MutationObserver(() => {
			const observed = readFromDom();
			this.#current = observed;
			applyToDom(observed);
		});
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

		// The OS can switch theme while the tab is open. It only counts when the user
		// has not chosen anything — an explicit choice beats the system preference.
		const query = window.matchMedia('(prefers-color-scheme: dark)');
		const onSystemChange = () => {
			if (localStorage.getItem(STORAGE_KEY)) return;
			applyToDom(query.matches ? 'dark' : 'light');
		};
		query.addEventListener('change', onSystemChange);

		return () => {
			observer.disconnect();
			query.removeEventListener('change', onSystemChange);
		};
	}
}

export const theme = new ThemeState();
