import { Notice, Plugin } from "obsidian";
import { Prec } from "@codemirror/state";
import { EditorView, ViewUpdate, keymap } from "@codemirror/view";
import {
	AutoScrollSettingTab,
	DEFAULT_SETTINGS,
	type AutoScrollSettings,
	clampSettings,
} from "./settings";

const MIN_MOUSE_SCROLL_SPEED = 120;
const MAX_MOUSE_SCROLL_SPEED_MULTIPLIER = 12;
const MOUSE_DISTANCE_SPEED_MULTIPLIER = 18;

interface MouseScrollTrigger {
	direction: -1 | 1;
	distance: number;
}

export default class AutoScrollPlugin extends Plugin {
	settings!: AutoScrollSettings;
	private lastScrollTime = 0;
	private mouseAnimationFrame: number | null = null;
	private mouseAnimationView: EditorView | null = null;
	private mouseViewportY: number | null = null;
	private lastMouseFrameTime = 0;

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
			[
				EditorView.updateListener.of((update: ViewUpdate) => {
					this.handleEditorUpdate(update);
				}),
				Prec.highest(
					keymap.of([
						{
							key: "ArrowDown",
							run: (view) => {
								this.handleArrowDown(view);
								return false;
							},
						},
					]),
				),
				EditorView.domEventHandlers({
					mousemove: (event, view) => {
						this.handleEditorMousemove(event, view);
					},
					mouseleave: () => {
						this.stopMouseAutoScroll();
					},
				}),
			],
		);
	}

	onunload() {
		this.stopMouseAutoScroll();
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
			this.settings.enabled &&
			this.settings.scrollOnTyping &&
			update.docChanged
		) {
			this.scrollIfPastThreshold(update.view);
		}
	}

	private handleArrowDown(view: EditorView) {
		if (!this.settings.enabled || !this.settings.scrollOnArrowDown) {
			return;
		}

		requestAnimationFrame(() => {
			view.scrollDOM.scrollBy({
				top: this.settings.arrowDownScrollAmount,
				behavior: this.settings.smoothScroll ? "smooth" : "auto",
			});
		});
	}

	private handleEditorMousemove(event: MouseEvent, view: EditorView) {
		if (
			!this.settings.enabled ||
			(!this.settings.scrollOnMouseNearBottom &&
				!this.settings.scrollOnMouseNearTop)
		) {
			this.stopMouseAutoScroll();
			return;
		}

		if (!this.settings.smoothScroll) {
			this.scrollByMousePosition(view, event.clientY);
			return;
		}

		const trigger = this.getMouseScrollTrigger(
			event.clientY,
			view.scrollDOM,
		);

		if (!trigger) {
			this.stopMouseAutoScroll();
			return;
		}

		this.mouseAnimationView = view;
		this.mouseViewportY = event.clientY;
		this.startMouseAutoScroll();
	}

	private scrollIfPastThreshold(view: EditorView, viewportY?: number) {
		if (!this.hasCooldownElapsed()) {
			return;
		}

		const scrollEl = view.scrollDOM;

		if (
			this.settings.requireNearDocumentBottom &&
			!this.isNearConfiguredDocumentDepth(scrollEl)
		) {
			return;
		}

		const distancePastThreshold =
			viewportY === undefined
				? this.getCursorDistancePastThreshold(view, scrollEl)
				: this.getViewportYDistancePastThreshold(viewportY, scrollEl);

		if (distancePastThreshold <= 0) {
			return;
		}

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

	private startMouseAutoScroll() {
		if (this.mouseAnimationFrame !== null) {
			return;
		}

		this.lastMouseFrameTime = 0;
		this.mouseAnimationFrame = requestAnimationFrame(this.animateMouseScroll);
	}

	private stopMouseAutoScroll() {
		if (this.mouseAnimationFrame !== null) {
			cancelAnimationFrame(this.mouseAnimationFrame);
			this.mouseAnimationFrame = null;
		}

		this.mouseAnimationView = null;
		this.mouseViewportY = null;
		this.lastMouseFrameTime = 0;
	}

	private animateMouseScroll = (timestamp: number) => {
		this.mouseAnimationFrame = null;

		if (
			!this.settings.enabled ||
			(!this.settings.scrollOnMouseNearBottom &&
				!this.settings.scrollOnMouseNearTop) ||
			this.mouseAnimationView === null ||
			this.mouseViewportY === null
		) {
			this.stopMouseAutoScroll();
			return;
		}

		const view = this.mouseAnimationView;
		const scrollEl = view.scrollDOM;
		const trigger = this.getMouseScrollTrigger(this.mouseViewportY, scrollEl);

		if (!trigger) {
			this.stopMouseAutoScroll();
			return;
		}

		const elapsedMs =
			this.lastMouseFrameTime === 0 ? 16 : timestamp - this.lastMouseFrameTime;
		this.lastMouseFrameTime = timestamp;

		const maxSpeed =
			this.settings.scrollAmount * MAX_MOUSE_SCROLL_SPEED_MULTIPLIER;
		const speed = Math.min(
			maxSpeed,
			Math.max(
				MIN_MOUSE_SCROLL_SPEED,
				trigger.distance * MOUSE_DISTANCE_SPEED_MULTIPLIER,
			),
		);
		const scrollAmount = Math.min(
			this.settings.scrollAmount,
			(speed * elapsedMs) / 1000,
		);
		const previousScrollTop = scrollEl.scrollTop;

		scrollEl.scrollTop += scrollAmount * trigger.direction;
		this.lastScrollTime = Date.now();

		if (scrollEl.scrollTop === previousScrollTop) {
			this.stopMouseAutoScroll();
			return;
		}

		this.mouseAnimationFrame = requestAnimationFrame(this.animateMouseScroll);
	};

	private scrollByMousePosition(view: EditorView, viewportY: number) {
		if (!this.hasCooldownElapsed()) {
			return;
		}

		const scrollEl = view.scrollDOM;
		const trigger = this.getMouseScrollTrigger(viewportY, scrollEl);

		if (!trigger) {
			return;
		}

		const scrollAmount = Math.min(
			this.settings.scrollAmount,
			Math.max(1, trigger.distance),
		);

		scrollEl.scrollBy({
			top: scrollAmount * trigger.direction,
			behavior: "auto",
		});

		this.lastScrollTime = Date.now();
	}

	private getMouseScrollTrigger(
		viewportY: number,
		scrollEl: HTMLElement,
	): MouseScrollTrigger | null {
		const scrollRect = scrollEl.getBoundingClientRect();
		const viewportPosition = viewportY - scrollRect.top;
		const bottomThreshold =
			(scrollEl.clientHeight * this.settings.scrollThresholdPercent) / 100;
		const topThreshold =
			(scrollEl.clientHeight * (100 - this.settings.scrollThresholdPercent)) /
			100;

		if (
			this.settings.scrollOnMouseNearBottom &&
			viewportPosition > bottomThreshold
		) {
			if (
				this.settings.requireNearDocumentBottom &&
				!this.isNearConfiguredDocumentDepth(scrollEl)
			) {
				return null;
			}

			return {
				direction: 1,
				distance: Math.ceil(viewportPosition - bottomThreshold),
			};
		}

		if (
			this.settings.scrollOnMouseNearTop &&
			viewportPosition < topThreshold
		) {
			return {
				direction: -1,
				distance: Math.ceil(topThreshold - viewportPosition),
			};
		}

		return null;
	}

	private getCursorDistancePastThreshold(
		view: EditorView,
		scrollEl: HTMLElement,
	): number {
		const cursor = view.coordsAtPos(view.state.selection.main.head);

		if (!cursor) {
			return 0;
		}

		return this.getViewportYDistancePastThreshold(cursor.bottom, scrollEl);
	}

	private getViewportYDistancePastThreshold(
		viewportY: number,
		scrollEl: HTMLElement,
	): number {
		const scrollRect = scrollEl.getBoundingClientRect();
		const viewportPosition = viewportY - scrollRect.top;
		const threshold =
			(scrollEl.clientHeight * this.settings.scrollThresholdPercent) / 100;

		if (viewportPosition <= threshold) {
			return 0;
		}

		return Math.ceil(viewportPosition - threshold);
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
