/**
 * Sub-expression styles component
 * Handles DOM rendering and user interaction for sub-expression styling
 * Reads/writes directly to StateStore
 */

import { StateStore } from '../core/StateStore';
import { SubExpressionStyle } from '../types';
import { SubExpressionErrorCallbacks } from '../mathRenderer';
import { expandColor, getNextSubExpressionColor, toHex8 } from '../utils';
import { ColorPicker } from './ColorPicker';

/**
 * Component for managing sub-expression styles
 */
export class SubExpressionStyles {
  private stateStore: StateStore;
  private container: HTMLElement;
  private addButton: HTMLButtonElement;
  private errorCallbacks?: SubExpressionErrorCallbacks;
  private onChangeCallback?: () => void;
  private onDirectStylingUpdateCallback?: () => void;
  private getTheme: () => string;
  private unsubscribe: (() => void) | null = null;
  private activeColorPickerIndices: Set<number> = new Set(); // Track rows with active color picker
  private existingRows: Map<number, HTMLElement> = new Map(); // Track existing rows by index
  private colorPickersByRow: Map<number, ColorPicker> = new Map(); // ColorPicker instances per row

  constructor(
    container: HTMLElement,
    stateStore: StateStore,
    errorCallbacks?: SubExpressionErrorCallbacks,
    onChangeCallback?: () => void,
    getTheme?: () => string,
    onDirectStylingUpdateCallback?: () => void
  ) {
    this.container = container;
    this.stateStore = stateStore;
    this.errorCallbacks = errorCallbacks;
    this.onChangeCallback = onChangeCallback;
    this.onDirectStylingUpdateCallback = onDirectStylingUpdateCallback;
    this.getTheme = getTheme || (() => 'dark'); // Default to dark theme

    // Find or create the rows container
    let rowsContainer = container.querySelector('#subexpression-rows') as HTMLDivElement;
    if (!rowsContainer) {
      rowsContainer = document.createElement('div');
      rowsContainer.id = 'subexpression-rows';
      container.appendChild(rowsContainer);
    }

    // Find or create the add button
    this.addButton = container.querySelector('#add-subexpression-btn') as HTMLButtonElement;
    if (!this.addButton) {
      this.addButton = document.createElement('button');
      this.addButton.id = 'add-subexpression-btn';
      this.addButton.textContent = 'Add sub-expression style';
      container.appendChild(this.addButton);
    }

    this.addButton.onclick = () => this.onAdd();

    // Subscribe to state changes with incremental updates
    let lastStyles: SubExpressionStyle[] = [];
    this.unsubscribe = this.stateStore.subscribe((state) => {
      const currentStyles = state.renderOptions.subExpressionStyles;
      
      // Structural change: length changed (add/remove rows)
      if (currentStyles.length !== lastStyles.length) {
        this.render(currentStyles);
        lastStyles = currentStyles.map(s => ({ ...s }));
        return;
      }
      
      // Value change: update rows in place
      currentStyles.forEach((style, index) => {
        const oldStyle = lastStyles[index];
        if (oldStyle && JSON.stringify(oldStyle) !== JSON.stringify(style)) {
          const row = this.existingRows.get(index);
          if (row) {
            this.updateRowInPlace(row, style, index);
          }
        }
      });
      
      lastStyles = currentStyles.map(s => ({ ...s }));
    });

    // Initial render
    const state = this.stateStore.getState();
    lastStyles = state.renderOptions.subExpressionStyles;
    this.render(state.renderOptions.subExpressionStyles);
  }

  /**
   * Get styles from state store
   */
  private getStyles(): SubExpressionStyle[] {
    return this.stateStore.getState().renderOptions.subExpressionStyles;
  }

  /**
   * Update styles in state store
   */
  private updateStyles(styles: SubExpressionStyle[]): void {
    const state = this.stateStore.getState();
    this.stateStore.updateState({
      renderOptions: {
        ...state.renderOptions,
        subExpressionStyles: styles
      }
    });
  }

  /**
   * Render the UI from styles array (incremental updates)
   */
  render(styles: SubExpressionStyle[]): void {
    const rowsContainer = this.container.querySelector('#subexpression-rows') as HTMLDivElement;
    if (!rowsContainer) return;

    const currentRowIndices = new Set<number>();
    const existingRowElements = new Map<number, HTMLElement>();

    // Collect existing rows
    Array.from(rowsContainer.querySelectorAll('.subexpression-row')).forEach((row) => {
      const index = parseInt((row as HTMLElement).getAttribute('data-row-index') || '-1');
      if (index >= 0) {
        currentRowIndices.add(index);
        existingRowElements.set(index, row as HTMLElement);
      }
    });

    const newRowIndices = new Set(styles.map((_, index) => index));

    // Remove rows that no longer exist
    currentRowIndices.forEach((index) => {
      if (!newRowIndices.has(index)) {
        const row = existingRowElements.get(index);
        if (row) {
          this.activeColorPickerIndices.delete(index);
          this.colorPickersByRow.delete(index);
          row.remove();
          this.existingRows.delete(index);
        }
      }
    });

    // Update existing rows and create new ones
    styles.forEach((style, index) => {
      const existingRow = existingRowElements.get(index);
      if (existingRow) {
        // Update existing row in place
        this.updateRowInPlace(existingRow, style, index);
      } else {
        // Create new row
        const newRow = this.createRow(rowsContainer, style, index);
        this.existingRows.set(index, newRow);
      }
    });
  }

  /**
   * Update a row in place without destroying it
   */
  private updateRowInPlace(row: HTMLElement, style: SubExpressionStyle, index: number): void {
    // Update data-row-index in case index changed
    row.setAttribute('data-row-index', index.toString());

    const texInput = row.querySelector('.subexpression-tex') as HTMLInputElement;
    const colorPicker = this.colorPickersByRow.get(index);
    const occurrenceInput = row.querySelector('.subexpression-occurrence') as HTMLInputElement;

    // Update expression
    if (texInput && texInput.value !== style.expression) {
      texInput.value = style.expression;
    }

    // Update color picker (only if not currently active)
    const colorValue = toHex8(style.color || '#5DA6F7FF');
    if (colorPicker && !this.activeColorPickerIndices.has(index) && colorPicker.getValue() !== colorValue) {
      colorPicker.setValue(colorValue);
    }

    // Update occurrences
    const occurrenceValue = style.occurrences || '';
    if (occurrenceInput && occurrenceInput.value !== occurrenceValue) {
      occurrenceInput.value = occurrenceValue;
    }
  }

  /**
   * Create a new row
   */
  private createRow(container: HTMLElement, style: SubExpressionStyle, index: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'subexpression-row';
    row.setAttribute('data-row-index', index.toString());

    const occurrenceValue = style.occurrences || '';
    const colorValue = toHex8(style.color || '#5DA6F7FF');

    row.innerHTML = `
      <input type="text" class="subexpression-tex" placeholder="exp" value="${this.escapeHtml(style.expression)}" 
             data-row-index="${index}">
      <div class="color-inputs" data-row-index="${index}"></div>
      <input type="text" class="subexpression-occurrence" placeholder="1,2 ..." value="${this.escapeHtml(occurrenceValue)}" 
             data-row-index="${index}">
      <button data-row-index="${index}">−</button>
      <div class="error-message error-tex" style="display: none;"></div>
      <div class="error-message error-color" style="display: none;"></div>
      <div class="error-message error-occurrence" style="display: none;"></div>
      <div class="grid-spacer"></div>
    `;

    const texInput = row.querySelector('.subexpression-tex') as HTMLInputElement;
    const colorInputsContainer = row.querySelector('.color-inputs') as HTMLElement;
    const occurrenceInput = row.querySelector('.subexpression-occurrence') as HTMLInputElement;
    const removeButton = row.querySelector('button') as HTMLButtonElement;

    const colorPicker = new ColorPicker(colorInputsContainer, {
      value: colorValue,
      useAlpha: true,
      onFocus: () => this.activeColorPickerIndices.add(index),
      onBlur: () => this.activeColorPickerIndices.delete(index),
      onChange: (value) => {
        this.onUpdate(index, 'color', value);
        this.onDirectStylingUpdateCallback?.();
        this.onChangeCallback?.();
      }
    });
    this.colorPickersByRow.set(index, colorPicker);

    texInput.addEventListener('change', () => this.onUpdate(index, 'expression', texInput.value.trim()));
    texInput.addEventListener('input', () => {
      this.onUpdate(index, 'expression', texInput.value.trim());
      this.onChangeCallback?.();
    });

    occurrenceInput.addEventListener('change', () => {
      this.onUpdate(index, 'occurrences', occurrenceInput.value.trim());
      this.onChangeCallback?.();
    });
    occurrenceInput.addEventListener('input', () => {
      this.onUpdate(index, 'occurrences', occurrenceInput.value.trim());
      this.onChangeCallback?.();
    });

    removeButton.addEventListener('click', () => this.onRemove(index));

    container.appendChild(row);
    return row;
  }

  /**
   * Handle add button click
   */
  onAdd(): void {
    const styles = this.getStyles();
    const theme = this.getTheme();
    const nextColor = getNextSubExpressionColor(theme, styles.length);
    
    const newStyles = [...styles, {
      expression: '',
      color: nextColor,
      occurrences: undefined
    }];
    
    this.updateStyles(newStyles);
    this.onChangeCallback?.();
  }

  /**
   * Handle remove button click
   */
  onRemove(index: number): void {
    const styles = this.getStyles();
    const newStyles = styles.filter((_, i) => i !== index);
    this.updateStyles(newStyles);
    this.onChangeCallback?.();
  }

  /**
   * Handle field update
   */
  private onUpdate(index: number, field: string, value: string): void {
    const styles = this.getStyles();
    const style = styles[index];
    if (!style) return;

    const newStyles = [...styles];
    if (field === 'expression') {
      newStyles[index] = { ...style, expression: value };
      this.errorCallbacks?.clearError?.(index, 'tex');
    } else if (field === 'color') {
      newStyles[index] = { ...style, color: value };
      this.errorCallbacks?.clearError?.(index, 'color');
    } else if (field === 'occurrences') {
      newStyles[index] = { ...style, occurrences: value || undefined };
      this.errorCallbacks?.clearError?.(index, 'occurrence');
    }
    
    this.updateStyles(newStyles);
  }

  /**
   * Show error for a specific field
   * Field names: 'tex' (for expression), 'color', 'occurrence'
   */
  showError(rowIndex: number, field: string, message: string): void {
    const row = this.container.querySelector(`.subexpression-row[data-row-index="${rowIndex}"]`);
    if (row) {
      // Map 'expression' to 'tex' for DOM class name
      const domField = field === 'expression' ? 'tex' : field;
      const errorDiv = row.querySelector(`.error-${domField}`) as HTMLElement;
      if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
      }
    }
  }

  /**
   * Clear error for a specific field
   * Field names: 'tex' (for expression), 'color', 'occurrence'
   */
  clearError(rowIndex: number, field: string): void {
    const row = this.container.querySelector(`.subexpression-row[data-row-index="${rowIndex}"]`);
    if (row) {
      // Map 'expression' to 'tex' for DOM class name
      const domField = field === 'expression' ? 'tex' : field;
      const errorDiv = row.querySelector(`.error-${domField}`) as HTMLElement;
      if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
      }
    }
  }

  /**
   * Clear all errors
   */
  clearAllErrors(): void {
    this.container.querySelectorAll('.error-message').forEach((el) => {
      (el as HTMLElement).textContent = '';
      (el as HTMLElement).style.display = 'none';
    });
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Cleanup - unsubscribe from state store
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.activeColorPickerIndices.clear();
    this.colorPickersByRow.clear();
    this.existingRows.clear();
  }
}

