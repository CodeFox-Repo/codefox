// customInspector.js - Add this to your template's public folder
// or serve it from your own CDN

(function () {
  // Configuration
  const CONFIG = {
    HIGHLIGHT_COLOR: '#60a5fa',
    HIGHLIGHT_BG: '#60a5fa1a',
    // Replace with your development domains
    ALLOWED_ORIGINS: [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://codefox.net',
    ],
    Z_INDEX: 10000,
    SELECTED_ATTR: 'data-custom-selected',
    HOVERED_ATTR: 'data-custom-hovered',
  };

  // State
  let state = {
    hoveredElement: null,
    isActive: false,
    tooltip: null,
    selectedElements: new Map(), // Map of id -> element
  };

  // Only initialize in iframe context
  if (window.top === window.self) {
    return;
  }

  // Utility: Send message to parent window
  function sendToParent(message) {
    CONFIG.ALLOWED_ORIGINS.forEach((origin) => {
      try {
        if (window.parent) {
          console.log(`Sending message to parent`);
          window.parent.postMessage(message, origin);
        } else {
          console.error('Cannot access window.parent');
        }
      } catch (error) {
        console.error(`Failed to send message to ${origin}:`, error);
      }
    });
  }

  // Utility: Check if element has component data
  function hasComponentData(element) {
    return (
      element.hasAttribute('data-custom-id') ||
      element.hasAttribute('data-custom-path')
    );
  }

  // Utility: Extract component data
  function extractComponentData(element) {
    const id = element.getAttribute('data-custom-id') || '';
    const [filePath, lineNumber, col] = id.split(':');

    // Parse the content attribute if it exists
    let contentData = {};
    try {
      const contentAttr = element.getAttribute('data-custom-content');
      if (contentAttr) {
        contentData = JSON.parse(decodeURIComponent(contentAttr));
      }
    } catch (e) {
      console.error('Error parsing data-custom-content', e);
      contentData = {};
    }

    // Get class data either from the class attribute or from parsed content
    const classNames =
      element.getAttribute('class') || contentData.className || '';

    return {
      id,
      name: element.getAttribute('data-custom-name') || '',
      path: element.getAttribute('data-custom-path') || filePath || '',
      line: element.getAttribute('data-custom-line') || lineNumber || '',
      column: col || '0',
      file: element.getAttribute('data-custom-file') || '',
      content: contentData,
      className: classNames,
      attributes: {
        class: classNames,
      },
      // Get only direct text content, excluding children's text
      textContent: Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.nodeValue.trim())
        .join(''),
    };
  }

  // Create styles for highlighting and tooltip
  function createStyles() {
    const style = document.createElement('style');
    style.textContent = `
        [${CONFIG.HOVERED_ATTR}] {
          position: relative;
        }
  
        [${CONFIG.HOVERED_ATTR}]::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          outline: 2px dashed ${CONFIG.HIGHLIGHT_COLOR} !important;
          background-color: ${CONFIG.HIGHLIGHT_BG} !important;
          z-index: ${CONFIG.Z_INDEX};
          pointer-events: none;
        }
  
        [${CONFIG.SELECTED_ATTR}] {
          position: relative;
        }
  
        [${CONFIG.SELECTED_ATTR}]::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          outline: 2px solid ${CONFIG.HIGHLIGHT_COLOR} !important;
          outline-offset: 2px !important;
          z-index: ${CONFIG.Z_INDEX};
          pointer-events: none;
        }
  
        .custom-inspector-tooltip {
          position: fixed;
          z-index: ${CONFIG.Z_INDEX + 1};
          pointer-events: none;
          background-color: ${CONFIG.HIGHLIGHT_COLOR};
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          white-space: nowrap;
          display: none;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `;
    document.head.appendChild(style);

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-inspector-tooltip';
    document.body.appendChild(tooltip);
    state.tooltip = tooltip;
  }

  // Highlight element on hover
  function highlightElement(element) {
    element.setAttribute(CONFIG.HOVERED_ATTR, 'true');

    if (state.tooltip) {
      const rect = element.getBoundingClientRect();
      state.tooltip.textContent =
        element.getAttribute('data-custom-name') ||
        element.tagName.toLowerCase();
      state.tooltip.style.display = 'block';
      state.tooltip.style.left = `${Math.max(0, rect.left)}px`;
      state.tooltip.style.top = `${Math.max(0, rect.top - 25)}px`;
    }
  }

  // Remove highlight
  function unhighlightElement(element) {
    element.removeAttribute(CONFIG.HOVERED_ATTR);

    if (state.tooltip) {
      state.tooltip.style.display = 'none';
    }
  }

  // Debounce function
  function debounce(fn, delay) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  // Handle mouseover event
  const handleMouseOver = debounce((event) => {
    if (!state.isActive) return;

    // Find closest element with component data
    let element = event.target;
    while (element && !hasComponentData(element)) {
      element = element.parentElement;
    }

    if (!element) return;

    // Unhighlight previous element
    if (state.hoveredElement && state.hoveredElement !== element) {
      unhighlightElement(state.hoveredElement);
    }

    // Highlight current element
    state.hoveredElement = element;
    highlightElement(element);
  }, 10);

  // Handle mouseout event
  const handleMouseOut = debounce(() => {
    if (!state.isActive || !state.hoveredElement) return;

    unhighlightElement(state.hoveredElement);
    state.hoveredElement = null;
  }, 10);

  // Handle click event
  function handleClick(event) {
    if (!state.isActive) return;

    // Find closest element with component data
    let element = event.target;
    while (element && !hasComponentData(element)) {
      element = element.parentElement;
    }

    if (!element) return;

    // Prevent default behavior
    event.preventDefault();
    event.stopPropagation();

    // Extract component data
    const componentData = extractComponentData(element);

    // Add selection
    element.setAttribute(CONFIG.SELECTED_ATTR, 'true');
    state.selectedElements.set(componentData.id, element);

    // Send to parent
    sendToParent({
      type: 'ELEMENT_CLICKED',
      payload: componentData,
      isMultiSelect: event.metaKey || event.ctrlKey,
    });
  }

  // Get computed styles for an element
  function getComputedStyles(element) {
    const computedStyle = window.getComputedStyle(element);
    const styles = {};

    // Common style properties to extract
    const properties = [
      // Colors
      'color',
      'backgroundColor',
      'borderColor',
      // Text
      'fontSize',
      'fontWeight',
      'fontFamily',
      'textAlign',
      'lineHeight',
      // Spacing
      'margin',
      'marginTop',
      'marginRight',
      'marginBottom',
      'marginLeft',
      'padding',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      // Layout
      'display',
      'flexDirection',
      'justifyContent',
      'alignItems',
      'gap',
      // Size
      'width',
      'height',
      'maxWidth',
      'maxHeight',
      // Border
      'borderWidth',
      'borderStyle',
      'borderRadius',
      // Other
      'opacity',
      'boxShadow',
      'transform',
      'transition',
    ];

    properties.forEach((prop) => {
      styles[prop] = computedStyle.getPropertyValue(prop);
    });

    // Make sure backgroundColor is not empty (could be transparent or rgba(0,0,0,0))
    if (
      !styles.backgroundColor ||
      styles.backgroundColor === 'transparent' ||
      styles.backgroundColor === 'rgba(0, 0, 0, 0)'
    ) {
      // Try to detect if the element has a background color class
      const classes = element.getAttribute('class') || '';
      if (classes.includes('bg-')) {
        // Extract the actual rendered color using a temp element trick
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.visibility = 'hidden';
        tempDiv.className = classes
          .split(' ')
          .filter((cls) => cls.startsWith('bg-'))
          .join(' ');
        document.body.appendChild(tempDiv);

        // Get the computed background color
        const bgColor = window.getComputedStyle(tempDiv).backgroundColor;
        if (
          bgColor &&
          bgColor !== 'transparent' &&
          bgColor !== 'rgba(0, 0, 0, 0)'
        ) {
          styles.backgroundColor = bgColor;
        }

        document.body.removeChild(tempDiv);
      }
    }

    return styles;
  }

  // Update element style
  function updateElementStyle(elementId, styles) {
    // Find the element by ID
    let element = null;

    try {
      if (state.selectedElements.has(elementId)) {
        element = state.selectedElements.get(elementId);
      } else {
        // Find by data-custom-id
        element = document.querySelector(`[data-custom-id="${elementId}"]`);

        // If not found, try to parse the ID and find by path and line
        if (!element && elementId.includes(':')) {
          const [path, line] = elementId.split(':');
          element = document.querySelector(
            `[data-custom-path="${path}"][data-custom-line="${line}"]`,
          );
        }
      }

      if (!element) {
        sendToParent({
          type: 'ELEMENT_STYLE_UPDATED',
          payload: {
            elementId: elementId,
            success: false,
            error: `Failed to find element with ID: ${elementId}`,
          },
        });
        return false;
      }

      // Apply styles
      Object.entries(styles).forEach(([property, value]) => {
        // Special handling for 'class' property
        if (property === 'class' || property === 'className') {
          element.setAttribute('class', value);
        } else {
          element.style[property] = value;
        }
      });

      // Return the updated element data
      const updatedData = extractComponentData(element);

      console.log('Style update successful, sending response');
      sendToParent({
        type: 'ELEMENT_STYLE_UPDATED',
        payload: {
          elementId: elementId,
          success: true,
          elementData: updatedData,
          appliedStyles: styles,
        },
      });

      return true;
    } catch (error) {
      console.error('Error applying styles:', error);
      sendToParent({
        type: 'ELEMENT_STYLE_UPDATED',
        payload: {
          elementId: elementId,
          success: false,
          error: error.message || 'Unknown error applying styles',
        },
      });
      return false;
    }
  }

  // Update element content
  function updateElementContent(elementId, content) {
    console.log(
      `Received content update request for element: ${elementId}`,
      content,
    );

    // Find the element
    let element = null;

    try {
      if (state.selectedElements.has(elementId)) {
        element = state.selectedElements.get(elementId);
        console.log('Found element in selectedElements map');
      } else {
        // Find by data-custom-id
        element = document.querySelector(`[data-custom-id="${elementId}"]`);
        console.log('Element search by data-custom-id:', !!element);

        // If not found, try to parse the ID and find by path and line
        if (!element && elementId.includes(':')) {
          const [path, line] = elementId.split(':');
          element = document.querySelector(
            `[data-custom-path="${path}"][data-custom-line="${line}"]`,
          );
          console.log('Element search by path and line:', !!element);
        }
      }

      if (!element) {
        console.error(`No element found with ID: ${elementId}`);
        sendToParent({
          type: 'ELEMENT_CONTENT_UPDATED',
          payload: {
            elementId: elementId,
            success: false,
            error: `Failed to find element with ID: ${elementId}`,
          },
        });
        return false;
      }

      // Update content
      console.log('Applying content to element:', element);
      element.innerHTML = content;

      // Return the updated element data
      const updatedData = extractComponentData(element);

      console.log('Content update successful, sending response');
      sendToParent({
        type: 'ELEMENT_CONTENT_UPDATED',
        payload: {
          elementId: elementId,
          success: true,
          elementData: updatedData,
          appliedContent: content,
        },
      });

      return true;
    } catch (error) {
      console.error('Error updating content:', error);
      sendToParent({
        type: 'ELEMENT_CONTENT_UPDATED',
        payload: {
          elementId: elementId,
          success: false,
          error: error.message || 'Unknown error updating content',
        },
      });
      return false;
    }
  }

  // Handle messages from parent
  function handleMessage(event) {
    if (!CONFIG.ALLOWED_ORIGINS.includes(event.origin)) return;
    if (!event.data || typeof event.data !== 'object') {
      console.warn('Received invalid message structure:', event.data);
      return;
    }

    if (!event.data.type) {
      console.warn('Received message with no type:', event.data);
      return;
    }

    console.log('Received message:', event.data.type, event.data);

    switch (event.data.type) {
      case 'TOGGLE_INSPECTOR':
        state.isActive = event.data.enabled;

        if (state.isActive) {
          // Enable inspector
          document.addEventListener('mouseover', handleMouseOver);
          document.addEventListener('mouseout', handleMouseOut);
          document.addEventListener('click', handleClick, true);
          document.body.style.cursor = 'pointer';
        } else {
          // Disable inspector
          document.removeEventListener('mouseover', handleMouseOver);
          document.removeEventListener('mouseout', handleMouseOut);
          document.removeEventListener('click', handleClick, true);
          document.body.style.cursor = '';

          // Clear any highlighting
          if (state.hoveredElement) {
            unhighlightElement(state.hoveredElement);
            state.hoveredElement = null;
          }

          // Clear any selections
          document
            .querySelectorAll(`[${CONFIG.SELECTED_ATTR}]`)
            .forEach((el) => {
              el.removeAttribute(CONFIG.SELECTED_ATTR);
            });

          // Clear selection map
          state.selectedElements.clear();
        }
        break;

      case 'GET_COMPONENT_TREE':
        // Send component tree to parent
        const root = document.querySelector('#root');
        if (root) {
          const componentTree = buildComponentTree(root);
          sendToParent({
            type: 'COMPONENT_TREE',
            payload: componentTree,
          });
        }
        break;

      case 'GET_ELEMENT_STYLES':
        // Get computed styles for an element
        const elementId = event.data.payload.elementId;
        let element = null;

        if (state.selectedElements.has(elementId)) {
          element = state.selectedElements.get(elementId);
        } else {
          // Find by data-custom-id
          element = document.querySelector(`[data-custom-id="${elementId}"]`);

          // If not found, try to parse the ID and find by path and line
          if (!element && elementId.includes(':')) {
            const [path, line] = elementId.split(':');
            element = document.querySelector(
              `[data-custom-path="${path}"][data-custom-line="${line}"]`,
            );
          }
        }

        if (element) {
          const styles = getComputedStyles(element);
          sendToParent({
            type: 'ELEMENT_STYLES',
            payload: {
              elementId,
              styles,
              success: true,
            },
          });
        } else {
          sendToParent({
            type: 'ELEMENT_STYLES',
            payload: {
              elementId,
              success: false,
              error: 'Element not found',
            },
          });
        }
        break;

      case 'UPDATE_ELEMENT_STYLE':
        // Update element style
        console.log('Processing style update:', event.data.payload);
        if (
          !event.data.payload ||
          !event.data.payload.elementId ||
          !event.data.payload.styles
        ) {
          console.error('Invalid style update payload:', event.data.payload);
          sendToParent({
            type: 'ELEMENT_STYLE_UPDATED',
            payload: {
              success: false,
              error: 'Invalid style update request',
            },
          });
          return;
        }
        updateElementStyle(
          event.data.payload.elementId,
          event.data.payload.styles,
        );
        break;

      case 'UPDATE_ELEMENT_CONTENT':
        // Update element content
        console.log('Processing content update:', event.data.payload);
        if (
          !event.data.payload ||
          !event.data.payload.elementId ||
          event.data.payload.content === undefined
        ) {
          console.error('Invalid content update payload:', event.data.payload);
          sendToParent({
            type: 'ELEMENT_CONTENT_UPDATED',
            payload: {
              success: false,
              error: 'Invalid content update request',
            },
          });
          return;
        }
        updateElementContent(
          event.data.payload.elementId,
          event.data.payload.content,
        );
        break;
    }
  }

  // Build component tree (simplified)
  function buildComponentTree(element) {
    if (!element) return null;

    const result = {
      type: 'element',
      tagName: element.tagName.toLowerCase(),
      children: [],
    };

    if (hasComponentData(element)) {
      result.component = extractComponentData(element);
    }

    // Process children
    Array.from(element.children).forEach((child) => {
      const childTree = buildComponentTree(child);
      if (childTree) {
        result.children.push(childTree);
      }
    });

    return result;
  }

  // Initialize
  function initialize() {
    console.log('[Custom Inspector] Initializing...');

    // Create styles
    createStyles();

    // Listen for messages from parent
    window.addEventListener('message', handleMessage);

    // Let parent know we're ready
    sendToParent({
      type: 'INSPECTOR_READY',
      payload: {
        url: window.location.href,
      },
    });

    console.log('[Custom Inspector] Ready');
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
