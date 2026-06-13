import { App, PluginSettingTab, Setting } from "obsidian";
import type AutoScrollPlugin from "./main";

export interface AutoScrollSettings {
	enabled: boolean;
	requireNearDocumentBottom: boolean;
	documentBottomThresholdPercent: number;
	scrollThresholdPercent: number;
	scrollAmount: number;
	scrollCooldownMs: number;
	smoothScroll: boolean;
}

export const DEFAULT_SETTINGS: AutoScrollSettings = {
	enabled: true,
	requireNearDocumentBottom: false,
	documentBottomThresholdPercent: 80,
	scrollThresholdPercent: 80,
	scrollAmount: 160,
	scrollCooldownMs: 100,
	smoothScroll: true,
};

const MIN_TRIGGER_POINT = 50;
const MAX_TRIGGER_POINT = 95;
const MIN_DOCUMENT_DEPTH = 50;
const MAX_DOCUMENT_DEPTH = 99;
const MIN_SCROLL_AMOUNT = 24;
const MAX_SCROLL_AMOUNT = 800;
const MIN_SCROLL_COOLDOWN = 0;
const MAX_SCROLL_COOLDOWN = 500;

export function clampSettings(
	settings: Partial<AutoScrollSettings>,
): AutoScrollSettings {
	return {
		enabled: settings.enabled ?? DEFAULT_SETTINGS.enabled,
		requireNearDocumentBottom:
			settings.requireNearDocumentBottom ??
			DEFAULT_SETTINGS.requireNearDocumentBottom,
		documentBottomThresholdPercent: clampNumber(
			settings.documentBottomThresholdPercent,
			MIN_DOCUMENT_DEPTH,
			MAX_DOCUMENT_DEPTH,
			DEFAULT_SETTINGS.documentBottomThresholdPercent,
		),
		scrollThresholdPercent: clampNumber(
			settings.scrollThresholdPercent,
			MIN_TRIGGER_POINT,
			MAX_TRIGGER_POINT,
			DEFAULT_SETTINGS.scrollThresholdPercent,
		),
		scrollAmount: clampNumber(
			settings.scrollAmount,
			MIN_SCROLL_AMOUNT,
			MAX_SCROLL_AMOUNT,
			DEFAULT_SETTINGS.scrollAmount,
		),
		scrollCooldownMs: clampNumber(
			settings.scrollCooldownMs,
			MIN_SCROLL_COOLDOWN,
			MAX_SCROLL_COOLDOWN,
			DEFAULT_SETTINGS.scrollCooldownMs,
		),
		smoothScroll: settings.smoothScroll ?? DEFAULT_SETTINGS.smoothScroll,
	};
}

export class AutoScrollSettingTab extends PluginSettingTab {
	plugin: AutoScrollPlugin;

	constructor(app: App, plugin: AutoScrollPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Enable auto-scroll")
			.setDesc("Scroll the editor when typing reaches the configured point.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.enabled = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Trigger point")
			.setDesc("Viewport percentage where auto-scroll starts while typing.")
			.addSlider((slider) =>
				slider
					.setLimits(MIN_TRIGGER_POINT, MAX_TRIGGER_POINT, 1)
					.setDynamicTooltip()
					.setValue(this.plugin.settings.scrollThresholdPercent)
					.onChange(async (value) => {
						this.plugin.settings.scrollThresholdPercent = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Maximum scroll step")
			.setDesc("Maximum pixels to scroll per trigger.")
			.addSlider((slider) =>
				slider
					.setLimits(MIN_SCROLL_AMOUNT, MAX_SCROLL_AMOUNT, 8)
					.setDynamicTooltip()
					.setValue(this.plugin.settings.scrollAmount)
					.onChange(async (value) => {
						this.plugin.settings.scrollAmount = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Scroll cooldown")
			.setDesc("Minimum milliseconds between automatic scrolls.")
			.addSlider((slider) =>
				slider
					.setLimits(MIN_SCROLL_COOLDOWN, MAX_SCROLL_COOLDOWN, 25)
					.setDynamicTooltip()
					.setValue(this.plugin.settings.scrollCooldownMs)
					.onChange(async (value) => {
						this.plugin.settings.scrollCooldownMs = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Only near document bottom")
			.setDesc("Require the editor to be near the configured document depth before scrolling.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.requireNearDocumentBottom)
					.onChange(async (value) => {
						this.plugin.settings.requireNearDocumentBottom = value;
						await this.plugin.saveSettings();
						this.display();
					}),
			);

		if (this.plugin.settings.requireNearDocumentBottom) {
			new Setting(containerEl)
				.setName("Document depth")
				.setDesc("Document percentage where auto-scroll becomes active.")
				.addSlider((slider) =>
					slider
						.setLimits(MIN_DOCUMENT_DEPTH, MAX_DOCUMENT_DEPTH, 1)
						.setDynamicTooltip()
						.setValue(this.plugin.settings.documentBottomThresholdPercent)
						.onChange(async (value) => {
							this.plugin.settings.documentBottomThresholdPercent = value;
							await this.plugin.saveSettings();
						}),
				);
		}

		new Setting(containerEl)
			.setName("Smooth scrolling")
			.setDesc("Animate the scroll movement.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.smoothScroll)
					.onChange(async (value) => {
						this.plugin.settings.smoothScroll = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}

function clampNumber(
	value: number | undefined,
	min: number,
	max: number,
	fallback: number,
): number {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return fallback;
	}

	return Math.min(max, Math.max(min, Math.round(value)));
}
