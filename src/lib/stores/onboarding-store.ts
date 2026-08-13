import { writable } from 'svelte/store';

export type OnboardingStep = 'ai' | 'pluggy';

interface OnboardingState {
	open: boolean;
	step: OnboardingStep;
}

export const onboarding = writable<OnboardingState>({ open: false, step: 'ai' });

export function openOnboarding(step: OnboardingStep = 'ai') {
	onboarding.set({ open: true, step });
}

export function closeOnboarding() {
	onboarding.set({ open: false, step: 'ai' });
}
