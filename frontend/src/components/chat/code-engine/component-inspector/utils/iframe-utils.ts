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

  // Special handling for 'className' property
  const hasClassName = styles.className !== undefined;
  let className = hasClassName ? styles.className : null;

  // Create a copy of styles without the className property
  const stylesWithoutClassName = { ...styles };
  if (hasClassName) {
    delete stylesWithoutClassName.className;
  }

  // Use the original function but with modified styles if needed
  return originalUpdateElementStyle(
    iframeElement,
    elementId,
    hasClassName ? { ...stylesWithoutClassName, class: className } : styles
  );
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
