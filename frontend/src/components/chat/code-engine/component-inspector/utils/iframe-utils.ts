/**
 * Utility functions for iframe communication
 */
import {
  getElementStyles as originalGetElementStyles,
  updateElementStyle as originalUpdateElementStyle,
  updateElementContent as originalUpdateElementContent,
} from '../../iframe-click-handler';

// Reference to the iframe element for communication
let iframeElement: HTMLIFrameElement | null = null;

/**
 * Sets the reference to the iframe element for communication
 */
export function setIframeRef(iframe: HTMLIFrameElement) {
  iframeElement = iframe;
  console.log('Iframe reference set for component inspector');
}

/**
 * Gets computed styles for a specified element
 */
export function getElementStyles(elementId: string) {
  if (!iframeElement) {
    console.error('Iframe reference not set. Call setIframeRef first.');
    return;
  }

  return originalGetElementStyles(iframeElement, elementId);
}

/**
 * Updates styles for a specified element
 */
export function updateElementStyle(
  elementId: string,
  styles: Record<string, string>
) {
  if (!iframeElement) {
    console.error('Iframe reference not set. Call setIframeRef first.');
    return;
  }

  return originalUpdateElementStyle(iframeElement, elementId, styles);
}

/**
 * Updates content for a specified element
 */
export function updateElementContent(elementId: string, content: string) {
  if (!iframeElement) {
    console.error('Iframe reference not set. Call setIframeRef first.');
    return;
  }

  return originalUpdateElementContent(iframeElement, elementId, content);
}
