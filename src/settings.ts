import { App, PluginSettingTab, Setting } from "obsidian";
import type AutoScrollPlugin from "./main";

export interface AutoScrollSettings {
	enabled: boolean;
	scrollOnTyping: boolean;
	keepCursorVisible: boolean;
	scrollOnArrowDown: boolean;
	scrollOnArrowUp: boolean;
	arrowDownScrollAmount: number;
	arrowUpScrollAmount: number;
	scrollOnMouseNearBottom: boolean;
	scrollOnMouseNearTop: boolean;
	requireNearDocumentBottom: boolean;
	documentBottomThresholdPercent: number;
	scrollThresholdPercent: number;
	scrollAmount: number;
	scrollCooldownMs: number;
	smoothScroll: boolean;
}

export const DEFAULT_SETTINGS: AutoScrollSettings = {
	enabled: true,
	scrollOnTyping: true,
	keepCursorVisible: true,
	scrollOnArrowDown: false,
	scrollOnArrowUp: false,
	arrowDownScrollAmount: 48,
	arrowUpScrollAmount: 48,
	scrollOnMouseNearBottom: true,
	scrollOnMouseNearTop: false,
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
const MIN_ARROW_DOWN_SCROLL_AMOUNT = 4;
const MAX_ARROW_DOWN_SCROLL_AMOUNT = 240;
const MIN_SCROLL_COOLDOWN = 0;
const MAX_SCROLL_COOLDOWN = 500;

export function clampSettings(
	settings: Partial<AutoScrollSettings>,
): AutoScrollSettings {
	return {
		enabled: settings.enabled ?? DEFAULT_SETTINGS.enabled,
		scrollOnTyping: settings.scrollOnTyping ?? DEFAULT_SETTINGS.scrollOnTyping,
		keepCursorVisible: settings.keepCursorVisible ?? DEFAULT_SETTINGS.keepCursorVisible,
		scrollOnArrowDown:
			settings.scrollOnArrowDown ?? DEFAULT_SETTINGS.scrollOnArrowDown,
		scrollOnArrowUp:
			settings.scrollOnArrowUp ?? DEFAULT_SETTINGS.scrollOnArrowUp,
		arrowDownScrollAmount: clampNumber(
			settings.arrowDownScrollAmount,
			MIN_ARROW_DOWN_SCROLL_AMOUNT,
			MAX_ARROW_DOWN_SCROLL_AMOUNT,
			DEFAULT_SETTINGS.arrowDownScrollAmount,
		),
		arrowUpScrollAmount: clampNumber(
			settings.arrowUpScrollAmount,
			MIN_ARROW_DOWN_SCROLL_AMOUNT,
			MAX_ARROW_DOWN_SCROLL_AMOUNT,
			DEFAULT_SETTINGS.arrowUpScrollAmount,
		),
		scrollOnMouseNearBottom:
			settings.scrollOnMouseNearBottom ??
			DEFAULT_SETTINGS.scrollOnMouseNearBottom,
		scrollOnMouseNearTop:
			settings.scrollOnMouseNearTop ?? DEFAULT_SETTINGS.scrollOnMouseNearTop,
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

		new Setting(containerEl).setName("Master control").setHeading();
		new Setting(containerEl)
			.setName("Enable auto-scroll")
			.setDesc("Turn all automatic scrolling features on or off.")
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
				this.plugin.settings.enabled = value;
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl)
			.setName("Keep Cursor visible during navigation")
			.setDesc("After any Cursor movement, including vim motions, scroll only when the Cursor leaves the band set by trigger point.")
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.keepCursorVisible).onChange(async (value) => {
				this.plugin.settings.keepCursorVisible = value;
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl)
			.setName("Scroll while typing")
			.setDesc("Keep the insertion point in the configured viewport band as you edit.")
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.scrollOnTyping).onChange(async (value) => {
				this.plugin.settings.scrollOnTyping = value;
				await this.plugin.saveSettings();
			}));

		new Setting(containerEl).setName("Arrow key steps").setHeading();
		new Setting(containerEl)
			.setName("Scroll on down arrow")
			.setDesc("Add a fixed viewport step whenever down is pressed.")
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.scrollOnArrowDown).onChange(async (value) => {
				this.plugin.settings.scrollOnArrowDown = value;
				await this.plugin.saveSettings();
				this.display();
			}));
		if (this.plugin.settings.scrollOnArrowDown) this.addArrowAmount(containerEl, "Down");
		new Setting(containerEl)
			.setName("Scroll on up arrow")
			.setDesc("Add a fixed viewport step whenever up is pressed.")
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.scrollOnArrowUp).onChange(async (value) => {
				this.plugin.settings.scrollOnArrowUp = value;
				await this.plugin.saveSettings();
				this.display();
			}));
		if (this.plugin.settings.scrollOnArrowUp) this.addArrowAmount(containerEl, "Up");

		new Setting(containerEl).setName("Viewport and mouse").setHeading();
		new Setting(containerEl)
			.setName("Trigger point")
			.setDesc("Sets the bottom edge of the Cursor's visible band; the top edge mirrors it. Mouse scrolling uses the matching edge zones.")
			.addSlider((slider) => slider.setLimits(MIN_TRIGGER_POINT, MAX_TRIGGER_POINT, 1).setDynamicTooltip()
				.setValue(this.plugin.settings.scrollThresholdPercent).onChange(async (value) => {
					this.plugin.settings.scrollThresholdPercent = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName("Scroll with mouse near bottom")
			.setDesc("Scroll down while the pointer is in the lower edge zone.")
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.scrollOnMouseNearBottom).onChange(async (value) => {
				this.plugin.settings.scrollOnMouseNearBottom = value;
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl)
			.setName("Scroll with mouse near top")
			.setDesc("Scroll up while the pointer is in the upper edge zone.")
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.scrollOnMouseNearTop).onChange(async (value) => {
				this.plugin.settings.scrollOnMouseNearTop = value;
				await this.plugin.saveSettings();
			}));
		new Setting(containerEl)
			.setName("Only near document bottom")
			.setDesc("Limit automatic scrolling to the final part of the note. This also applies to upward mouse scrolling.")
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.requireNearDocumentBottom).onChange(async (value) => {
				this.plugin.settings.requireNearDocumentBottom = value;
				await this.plugin.saveSettings();
				this.display();
			}));
		if (this.plugin.settings.requireNearDocumentBottom) {
			new Setting(containerEl)
				.setName("Document depth")
				.setDesc("Start allowing auto-scroll after reaching this percentage of the note.")
				.addSlider((slider) => slider.setLimits(MIN_DOCUMENT_DEPTH, MAX_DOCUMENT_DEPTH, 1).setDynamicTooltip()
					.setValue(this.plugin.settings.documentBottomThresholdPercent).onChange(async (value) => {
						this.plugin.settings.documentBottomThresholdPercent = value;
						await this.plugin.saveSettings();
					}));
		}

		new Setting(containerEl).setName("Scroll feel").setHeading();
		new Setting(containerEl)
			.setName("Maximum scroll step")
			.setDesc("Cap the distance moved by each automatic scroll action.")
			.addSlider((slider) => slider.setLimits(MIN_SCROLL_AMOUNT, MAX_SCROLL_AMOUNT, 8).setDynamicTooltip()
				.setValue(this.plugin.settings.scrollAmount).onChange(async (value) => {
					this.plugin.settings.scrollAmount = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName("Scroll cooldown")
			.setDesc("Minimum time between mouse-triggered scroll steps. Set to 0 for no delay.")
			.addSlider((slider) => slider.setLimits(MIN_SCROLL_COOLDOWN, MAX_SCROLL_COOLDOWN, 25).setDynamicTooltip()
				.setValue(this.plugin.settings.scrollCooldownMs).onChange(async (value) => {
					this.plugin.settings.scrollCooldownMs = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName("Smooth scrolling")
			.setDesc("Animate automatic viewport movement.")
			.addToggle((toggle) => toggle.setValue(this.plugin.settings.smoothScroll).onChange(async (value) => {
				this.plugin.settings.smoothScroll = value;
				await this.plugin.saveSettings();
			}));
	}

	private addArrowAmount(containerEl: HTMLElement, direction: "Up" | "Down") {
		const key = direction === "Up" ? "arrowUpScrollAmount" : "arrowDownScrollAmount";
		new Setting(containerEl)
			.setName(`${direction} arrow scroll amount`)
			.setDesc(`Viewport pixels to move for each ${direction} press.`)
			.addSlider((slider) => slider.setLimits(MIN_ARROW_DOWN_SCROLL_AMOUNT, MAX_ARROW_DOWN_SCROLL_AMOUNT, 4)
				.setDynamicTooltip().setValue(this.plugin.settings[key]).onChange(async (value) => {
					this.plugin.settings[key] = value;
					await this.plugin.saveSettings();
				}));
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
