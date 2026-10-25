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
	private cursorScrollFrame: number | null = null;

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
							key: "ArrowUp",
							run: (view) => {
								this.handleArrowUp(view);
								return false;
							},
						},
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
		if (this.cursorScrollFrame !== null) {
			window.cancelAnimationFrame(this.cursorScrollFrame);
		}
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
		// Selection updates cover keyboard navigation and Vim motions, including
		// motions that do not change the document.
		if (this.settings.enabled && this.settings.keepCursorVisible && update.selectionSet) {
			this.scheduleCursorAlignment(update.view);
		}

		if (
			this.settings.enabled &&
			this.settings.scrollOnTyping &&
			update.docChanged
		) {
			this.scrollIfPastThreshold(update.view);
		}
	}

	private handleArrowDown(view: EditorView) {
		if (this.settings.enabled) {
			this.handleArrowScroll(view, 1);
		}
	}

	private handleArrowUp(view: EditorView) {
		if (this.settings.enabled) {
			this.handleArrowScroll(view, -1);
		}
	}

	private handleArrowScroll(view: EditorView, direction: -1 | 1) {
		const isEnabled = direction === 1
			? this.settings.scrollOnArrowDown
			: this.settings.scrollOnArrowUp;
		if (isEnabled) {
			const amount = direction === 1
				? this.settings.arrowDownScrollAmount
				: this.settings.arrowUpScrollAmount;
			window.requestAnimationFrame(() => {
				view.scrollDOM.scrollBy({
					top: amount * direction,
					behavior: this.settings.smoothScroll ? "smooth" : "auto",
				});
			});
		}
	}

	private scheduleCursorAlignment(view: EditorView) {
		if (this.cursorScrollFrame !== null) {
			window.cancelAnimationFrame(this.cursorScrollFrame);
		}
		this.cursorScrollFrame = window.requestAnimationFrame(() => {
			this.cursorScrollFrame = null;
			if (this.settings.enabled && view.dom.isConnected) {
				this.alignCursorToViewportBand(view);
			}
		});
	}

	private alignCursorToViewportBand(view: EditorView) {
		const scrollEl = view.scrollDOM;
		const cursor = view.coordsAtPos(view.state.selection.main.head);
		if (!cursor || scrollEl.clientHeight <= 0) return;

		const scrollRect = scrollEl.getBoundingClientRect();
		const topLimit = (scrollEl.clientHeight * (100 - this.settings.scrollThresholdPercent)) / 100;
		const bottomLimit = (scrollEl.clientHeight * this.settings.scrollThresholdPercent) / 100;
		let delta = 0;
		if (cursor.top < scrollRect.top + topLimit) {
			delta = cursor.top - (scrollRect.top + topLimit);
		} else if (cursor.bottom > scrollRect.top + bottomLimit) {
			delta = cursor.bottom - (scrollRect.top + bottomLimit);
		}
		if (delta !== 0) {
			// Cursor navigation can happen repeatedly during a Vim motion. Smooth
			// scroll animations overlap in that case and use stale cursor positions,
			// which can send the viewport to a paragraph boundary.
			scrollEl.scrollTop += delta;
		}
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
		this.mouseAnimationFrame = window.requestAnimationFrame(
			this.animateMouseScroll,
		);
	}

	private stopMouseAutoScroll() {
		if (this.mouseAnimationFrame !== null) {
			window.cancelAnimationFrame(
				this.mouseAnimationFrame,
			);
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

		this.mouseAnimationFrame = window.requestAnimationFrame(
			this.animateMouseScroll,
		);
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
