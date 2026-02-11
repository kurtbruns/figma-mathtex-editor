/**
 * ColorPicker component
 * Renders: square preview, hex input, opacity %, hidden native picker
 * Emits hex8 (#RRGGBBAA) on change
 */

import { expandColor, parseColorWithAlpha, rgbaToHex8, hexToRgbaCss } from '../utils';

export interface ColorPickerOptions {
  value: string;
  onChange: (value: string) => void;
  useAlpha?: boolean;
  /** Optional: id for the hex input (for label association) */
  hexInputId?: string;
  /** Optional: for focus/blur tracking (e.g. sub-expression dialog) */
  onFocus?: () => void;
  onBlur?: () => void;
}

export class ColorPicker {
  private container: HTMLElement;
  private swatch: HTMLDivElement;
  private pickerInput: HTMLInputElement;
  private hexInput: HTMLInputElement;
  private opacityInput: HTMLInputElement | null = null;
  private options: ColorPickerOptions;

  constructor(container: HTMLElement, options: ColorPickerOptions) {
    this.container = container;
    this.options = { useAlpha: true, ...options };

    this.container.classList.add('color-picker');
    this.container.innerHTML = '';

    // Checkerboard + color swatch (clickable)
    this.swatch = document.createElement('div');
    this.swatch.className = 'color-picker-swatch';
    const swatchInner = document.createElement('div');
    swatchInner.className = 'color-picker-swatch-inner';
    this.swatch.appendChild(swatchInner);

    this.pickerInput = document.createElement('input');
    this.pickerInput.type = 'color';
    this.pickerInput.className = 'color-picker-native';
    this.pickerInput.setAttribute('aria-hidden', 'true');

    this.hexInput = document.createElement('input');
    this.hexInput.type = 'text';
    this.hexInput.className = 'color-picker-hex';
    this.hexInput.maxLength = 6;
    this.hexInput.placeholder = '000000';
    if (this.options.hexInputId) {
      this.hexInput.id = this.options.hexInputId;
    }

    this.swatch.addEventListener('click', () => this.pickerInput.click());
    this.pickerInput.addEventListener('input', () => this.onPickerChange());
    this.pickerInput.addEventListener('change', () => this.onPickerChange());
    this.hexInput.addEventListener('focus', () => this.hexInput.select());
    this.hexInput.addEventListener('mousedown', (e) => { e.preventDefault(); this.hexInput.select(); });
    this.hexInput.addEventListener('input', () => this.onHexInput());
    this.hexInput.addEventListener('change', () => this.onHexChange());

    if (this.options.onFocus) {
      this.pickerInput.addEventListener('focus', () => this.options.onFocus!());
      this.hexInput.addEventListener('focus', () => this.options.onFocus!());
    }
    if (this.options.onBlur) {
      this.pickerInput.addEventListener('blur', () => this.options.onBlur!());
      this.hexInput.addEventListener('blur', () => this.options.onBlur!());
    }

    this.container.appendChild(this.swatch);
    this.container.appendChild(this.hexInput);

    if (this.options.useAlpha) {
      const opacityWrapper = document.createElement('span');
      opacityWrapper.className = 'color-picker-opacity-wrap';
      this.opacityInput = document.createElement('input');
      this.opacityInput.type = 'number';
      this.opacityInput.className = 'color-picker-opacity';
      this.opacityInput.min = '0';
      this.opacityInput.max = '100';
      this.opacityInput.value = '100';
      opacityWrapper.appendChild(this.opacityInput);
      const percentLabel = document.createElement('span');
      percentLabel.className = 'color-picker-opacity-label';
      percentLabel.textContent = '%';
      opacityWrapper.appendChild(percentLabel);
      this.container.appendChild(opacityWrapper);

      this.opacityInput.addEventListener('input', () => this.onOpacityInput());
      this.opacityInput.addEventListener('change', () => this.onOpacityChange());
      if (this.options.onFocus) {
        this.opacityInput.addEventListener('focus', () => this.options.onFocus!());
      }
      if (this.options.onBlur) {
        this.opacityInput.addEventListener('blur', () => this.options.onBlur!());
      }
    }

    // Hide native picker but keep it in DOM for click()
    this.container.appendChild(this.pickerInput);

    this.setValue(this.options.value);
  }

  setValue(value: string): void {
    const { r, g, b, a } = parseColorWithAlpha(value || '#000000FF');
    const hex6 = [r, g, b].map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('').toUpperCase();

    this.hexInput.value = expandColor(hex6).substring(0, 6);
    this.pickerInput.value = '#' + hex6;

    if (this.opacityInput) {
      this.opacityInput.value = String(Math.round(a * 100));
    }

    this.updateSwatch(value || '#000000FF');
  }

  getValue(): string {
    return this.getValueFromInputs();
  }

  private getValueFromInputs(): string {
    const hexRaw = this.hexInput.value.trim();
    if (!/^[0-9A-Fa-f]{1,6}$/i.test(hexRaw)) {
      return this.options.value || '#000000FF';
    }
    const hex6 = expandColor(hexRaw).substring(0, 6);
    const r = parseInt(hex6.substring(0, 2), 16) / 255;
    const g = parseInt(hex6.substring(2, 4), 16) / 255;
    const b = parseInt(hex6.substring(4, 6), 16) / 255;
    let a = 1;
    if (this.opacityInput) {
      const parsed = parseInt(this.opacityInput.value, 10);
      a = isNaN(parsed) ? 1 : Math.max(0, Math.min(100, parsed)) / 100;
    }
    return rgbaToHex8(r, g, b, a);
  }

  private updateSwatch(value: string): void {
    const inner = this.swatch.querySelector('.color-picker-swatch-inner');
    if (inner) {
      (inner as HTMLElement).style.background = hexToRgbaCss(value);
    }
  }

  private emitChange(): void {
    const value = this.getValueFromInputs();
    this.updateSwatch(value);
    this.options.onChange(value);
  }

  private onPickerChange(): void {
    const expanded = expandColor(this.pickerInput.value);
    this.hexInput.value = expanded.substring(0, 6);
    this.emitChange();
  }

  private onHexInput(): void {
    const value = this.hexInput.value.trim();
    if (/^[0-9A-Fa-f]{1,6}$/i.test(value)) {
      const expanded = expandColor(value);
      this.pickerInput.value = '#' + expanded.substring(0, 6);
    }
    this.options.onChange(this.getValueFromInputs());
  }

  private onHexChange(): void {
    const value = this.hexInput.value.trim();
    if (/^[0-9A-Fa-f]{1,6}$/i.test(value)) {
      const expanded = expandColor(value);
      this.hexInput.value = expanded.substring(0, 6);
      this.pickerInput.value = '#' + expanded.substring(0, 6);
    }
    this.emitChange();
  }

  private onOpacityInput(): void {
    this.emitChange();
  }

  private onOpacityChange(): void {
    if (this.opacityInput) {
      const parsed = parseInt(this.opacityInput.value, 10);
      const clamped = isNaN(parsed) ? 100 : Math.max(0, Math.min(100, parsed));
      this.opacityInput.value = String(clamped);
    }
    this.emitChange();
  }
}
