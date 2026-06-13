import { Notice, Plugin } from "obsidian";
import { EditorView, ViewUpdate } from "@codemirror/view";
import {
	AutoScrollSettingTab,
	DEFAULT_SETTINGS,
	type AutoScrollSettings,
	clampSettings,
} from "./settings";

export default class AutoScrollPlugin extends Plugin {
	settings!: AutoScrollSettings;
	private lastScrollTime = 0;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new AutoScrollSettingTab(this.app, this));

		this.addCommand({
			id: "toggle",
			name: "Toggle auto-scroll",
			callback: async () => {
				this.settings.enabled = !this.settings.enabled;
				await this.saveSettings();
				new Notice(
					`Auto Scroll ${this.settings.enabled ? "enabled" : "disabled"}`,
				);
			},
		});

		this.registerEditorExtension(
			EditorView.updateListener.of((update: ViewUpdate) => {
				this.handleEditorUpdate(update);
			}),
		);
	}

	async loadSettings() {
		const savedSettings =
			((await this.loadData()) as Partial<AutoScrollSettings> | null) ?? {};

		this.settings = clampSettings({
			...DEFAULT_SETTINGS,
			...savedSettings,
		});
	}

	async saveSettings() {
		this.settings = clampSettings(this.settings);
		await this.saveData(this.settings);
	}

	private handleEditorUpdate(update: ViewUpdate) {
		if (
			!this.settings.enabled ||
			!update.docChanged ||
			!this.hasCooldownElapsed()
		) {
			return;
		}

		const view = update.view;
		const scrollEl = view.scrollDOM;

		if (
			this.settings.requireNearDocumentBottom &&
			!this.isNearConfiguredDocumentDepth(scrollEl)
		) {
			return;
		}

		const cursor = view.coordsAtPos(update.state.selection.main.head);

		if (!cursor) {
			return;
		}

		const scrollRect = scrollEl.getBoundingClientRect();
		const cursorBottom = cursor.bottom - scrollRect.top;
		const threshold =
			(scrollEl.clientHeight * this.settings.scrollThresholdPercent) / 100;

		if (cursorBottom <= threshold) {
			return;
		}

		const distancePastThreshold = Math.ceil(cursorBottom - threshold);
		const scrollAmount = Math.min(
			this.settings.scrollAmount,
			Math.max(1, distancePastThreshold),
		);

		scrollEl.scrollBy({
			top: scrollAmount,
			behavior: this.settings.smoothScroll ? "smooth" : "auto",
		});

		this.lastScrollTime = Date.now();
	}

	private hasCooldownElapsed(): boolean {
		if (this.settings.scrollCooldownMs <= 0) {
			return true;
		}

		return Date.now() - this.lastScrollTime >= this.settings.scrollCooldownMs;
	}

	private isNearConfiguredDocumentDepth(scrollEl: HTMLElement): boolean {
		const maxScrollTop = scrollEl.scrollHeight - scrollEl.clientHeight;

		if (maxScrollTop <= 0) {
			return false;
		}

		const currentDepth =
			((scrollEl.scrollTop + scrollEl.clientHeight) / scrollEl.scrollHeight) *
			100;

		return currentDepth >= this.settings.documentBottomThresholdPercent;
	}
}
