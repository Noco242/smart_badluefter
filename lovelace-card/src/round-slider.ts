/**
 * Minimaler runder Slider als SVG-Komponente.
 * Bewusst keine externe Abhängigkeit, damit die Karte als single-file Bundle
 * ohne npm-Tricks in Home Assistant geladen werden kann.
 */
import { LitElement, html, css, svg, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("sbl-round-slider")
export class RoundSlider extends LitElement {
  @property({ type: Number }) min = 0;
  @property({ type: Number }) max = 100;
  @property({ type: Number }) step = 1;
  @property({ type: Number }) value = 0;
  @property({ type: Number }) current?: number;
  /** Bogen-Sweep in Grad. 270 = ~Hufeisen wie die HA Thermostat-Karte. */
  @property({ type: Number }) arc = 270;
  @property({ type: String }) color = "var(--primary-color)";
  @property({ type: String }) trackColor = "var(--disabled-color)";
  @property({ type: Boolean }) disabled = false;

  @state() private _dragging = false;

  private readonly size = 240;
  private readonly stroke = 14;
  private readonly radius = (this.size - this.stroke) / 2;

  static styles = css`
    :host { display: block; touch-action: none; user-select: none; }
    svg { width: 100%; height: 100%; overflow: visible; cursor: pointer; }
    .handle { fill: var(--card-background-color, #fff); stroke-width: 4; }
    .handle-dot { fill: var(--primary-color); }
    text.value {
      font-size: 64px; font-weight: 300;
      fill: var(--primary-text-color);
      text-anchor: middle; dominant-baseline: middle;
    }
    text.unit {
      font-size: 20px; font-weight: 400;
      fill: var(--secondary-text-color);
      text-anchor: middle;
    }
    text.label {
      font-size: 14px;
      fill: var(--secondary-text-color);
      text-anchor: middle;
    }
    text.current {
      font-size: 14px;
      fill: var(--secondary-text-color);
      text-anchor: middle;
    }
  `;

  @property({ type: String }) unit = "";
  @property({ type: String }) label = "";

  private _angleStart(): number {
    return -90 - this.arc / 2;
  }
  private _angleEnd(): number {
    return -90 + this.arc / 2;
  }

  private _valueToAngle(v: number): number {
    const clamped = Math.min(this.max, Math.max(this.min, v));
    const ratio = (clamped - this.min) / (this.max - this.min);
    return this._angleStart() + ratio * this.arc;
  }

  private _polar(angleDeg: number, r: number): { x: number; y: number } {
    const a = (angleDeg * Math.PI) / 180;
    const cx = this.size / 2;
    const cy = this.size / 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  private _arcPath(fromAngle: number, toAngle: number): string {
    const r = this.radius;
    const start = this._polar(fromAngle, r);
    const end = this._polar(toAngle, r);
    const large = Math.abs(toAngle - fromAngle) > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
  }

  private _onPointerDown = (ev: PointerEvent) => {
    if (this.disabled) return;
    (ev.target as Element).setPointerCapture(ev.pointerId);
    this._dragging = true;
    this._updateFromEvent(ev);
  };

  private _onPointerMove = (ev: PointerEvent) => {
    if (!this._dragging) return;
    this._updateFromEvent(ev);
  };

  private _onPointerUp = (ev: PointerEvent) => {
    if (!this._dragging) return;
    this._dragging = false;
    (ev.target as Element).releasePointerCapture(ev.pointerId);
    this.dispatchEvent(
      new CustomEvent("change", { detail: { value: this.value } })
    );
  };

  private _updateFromEvent(ev: PointerEvent): void {
    const svg = this.renderRoot.querySelector("svg") as SVGSVGElement | null;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    const dx = local.x - this.size / 2;
    const dy = local.y - this.size / 2;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    // Auf zulässigen Bogen klemmen
    let start = this._angleStart();
    let end = this._angleEnd();
    // Normieren auf [-180, 180]
    if (angle < start) angle = start;
    if (angle > end) angle = end;
    const ratio = (angle - start) / this.arc;
    const raw = this.min + ratio * (this.max - this.min);
    const stepped = Math.round(raw / this.step) * this.step;
    const clamped = Math.min(this.max, Math.max(this.min, stepped));
    if (clamped !== this.value) {
      this.value = clamped;
      this.dispatchEvent(
        new CustomEvent("input", { detail: { value: this.value } })
      );
    }
  }

  render() {
    const start = this._angleStart();
    const end = this._angleEnd();
    const valueAngle = this._valueToAngle(this.value);
    const handlePos = this._polar(valueAngle, this.radius);
    const currentDotPos =
      this.current !== undefined
        ? this._polar(this._valueToAngle(this.current), this.radius)
        : null;

    return html`
      <svg
        viewBox="0 0 ${this.size} ${this.size}"
        @pointerdown=${this._onPointerDown}
        @pointermove=${this._onPointerMove}
        @pointerup=${this._onPointerUp}
        @pointercancel=${this._onPointerUp}
      >
        <path
          d=${this._arcPath(start, end)}
          stroke=${this.trackColor}
          stroke-width=${this.stroke}
          stroke-linecap="round"
          fill="none"
        />
        <path
          d=${this._arcPath(start, valueAngle)}
          stroke=${this.color}
          stroke-width=${this.stroke}
          stroke-linecap="round"
          fill="none"
        />
        ${currentDotPos
          ? svg`<circle cx=${currentDotPos.x} cy=${currentDotPos.y} r="5"
                     fill="var(--secondary-text-color)" opacity="0.6"/>`
          : ""}
        <circle
          class="handle"
          cx=${handlePos.x}
          cy=${handlePos.y}
          r="14"
          stroke=${this.color}
        />
        <circle
          class="handle-dot"
          cx=${handlePos.x}
          cy=${handlePos.y}
          r="6"
        />

        <text class="label" x=${this.size / 2} y=${this.size / 2 - 50}>
          ${this.label}
        </text>
        <text class="value" x=${this.size / 2} y=${this.size / 2}>
          ${Math.round(this.value * 10) / 10}${this.unit}
        </text>
        ${this.current !== undefined
          ? html`<text class="current" x=${this.size / 2} y=${this.size / 2 + 36}>
              aktuell ${Math.round(this.current * 10) / 10}${this.unit}
            </text>`
          : ""}
      </svg>
    `;
  }
}
