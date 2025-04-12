// This file integrates with custom component inspector system

// Allowed origins for communication
const ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:5173'];

// Function to setup communication with the iframe
export function setupIframeComm(iframe: HTMLIFrameElement) {
  // Listen for messages from the iframe
  window.addEventListener('message', (event) => {
    // Process only messages from our iframe with component click data
    if (iframe.contentWindow === event.source) {
      console.log('Received message from iframe:', event.data.type);

      if (!event.data || !event.data.type) {
        console.warn('Received message with no type from iframe', event.data);
        return;
      }

      if (event.data.type === 'ELEMENT_CLICKED') {
        // Custom inspector sends ELEMENT_CLICKED when user clicks on a component
        console.log('Processing ELEMENT_CLICKED message', event.data.payload);
        try {
          window.postMessage(
            {
              type: 'COMPONENT_CLICK',
              componentData: {
                id: event.data.payload.id || '',
                name: event.data.payload.name || 'Component',
                path: event.data.payload.path || '',
                line: event.data.payload.line || '0',
                file: event.data.payload.file || '',
                content: {
                  text: event.data.payload.textContent || '',
                  className: event.data.payload.className || '',
                  ...(event.data.payload.content || {}),
                },
              },
            },
            '*'
          );
          console.log('Successfully forwarded COMPONENT_CLICK message');
        } catch (error) {
          console.error('Error forwarding ELEMENT_CLICKED message:', error);
        }
      } else if (event.data.type === 'INSPECTOR_READY') {
        console.log('Custom component inspector is ready');

        // If inspect mode is enabled, toggle it on
        const inspectModeEnabled =
          localStorage.getItem('inspectModeEnabled') === 'true';
        if (inspectModeEnabled) {
          toggleInspectMode(iframe, true);
        }
      } else if (event.data.type === 'ELEMENT_STYLES') {
        // Forward computed styles to the UI
        console.log('Forwarding ELEMENT_STYLES message', event.data.payload);
        try {
          window.postMessage(event.data, '*');
          console.log('Successfully forwarded ELEMENT_STYLES message');
        } catch (error) {
          console.error('Error forwarding ELEMENT_STYLES message:', error);
        }
      } else if (event.data.type === 'ELEMENT_STYLE_UPDATED') {
        // Forward style update confirmation to the UI
        console.log(
          'Forwarding ELEMENT_STYLE_UPDATED message',
          event.data.payload
        );
        try {
          window.postMessage(event.data, '*');
          console.log('Successfully forwarded ELEMENT_STYLE_UPDATED message');
        } catch (error) {
          console.error(
            'Error forwarding ELEMENT_STYLE_UPDATED message:',
            error
          );
        }
      } else if (event.data.type === 'ELEMENT_CONTENT_UPDATED') {
        // Forward content update confirmation to the UI
        console.log(
          'Forwarding ELEMENT_CONTENT_UPDATED message',
          event.data.payload
        );
        try {
          window.postMessage(event.data, '*');
          console.log('Successfully forwarded ELEMENT_CONTENT_UPDATED message');
        } catch (error) {
          console.error(
            'Error forwarding ELEMENT_CONTENT_UPDATED message:',
            error
          );
        }
      } else {
        console.warn(
          'Received unhandled message type from iframe:',
          event.data.type,
          event.data
        );
      }
    }
  });

  // When iframe loads, check if customInspector.js needs to be injected
  iframe.addEventListener('load', () => {
    console.log('Iframe loaded, checking for customInspector.js');

    // First check if the custom inspector needs to be injected
    const checkAndInjectInspector = () => {
      try {
        // Try to inject customInspector.js if needed
        if (iframe.contentDocument) {
          // Check if customInspector.js is already loaded
          if (
            iframe.contentDocument.querySelector(
              'script[src*="customInspector.js"]'
            )
          ) {
            console.log('Custom inspector script already loaded');
          }
        } else {
          // Cross-origin iframe, can't directly inject, but the script should be included in the app
          console.log('Cannot access iframe document (cross-origin)');
        }
      } catch (error) {
        console.error('Error injecting inspector:', error);
      }
    };

    // Try to inject the script
    setTimeout(checkAndInjectInspector, 500);
  });
}

// Function to toggle inspect mode using our custom inspector
export function toggleInspectMode(iframe: HTMLIFrameElement, enabled: boolean) {
  // Store the state in localStorage so we can restore it when iframe reloads
  localStorage.setItem('inspectModeEnabled', enabled.toString());

  iframe.contentWindow?.postMessage(
    {
      type: 'TOGGLE_INSPECTOR',
      enabled,
    },
    '*'
  );
  console.log('Toggle inspect mode:', enabled);
}

// Function to get computed styles for an element
export function getElementStyles(iframe: HTMLIFrameElement, elementId: string) {
  iframe.contentWindow?.postMessage(
    {
      type: 'GET_ELEMENT_STYLES',
      payload: {
        elementId,
      },
    },
    '*'
  );
}

// Function to update element styles
export function updateElementStyle(
  iframe: HTMLIFrameElement,
  elementId: string,
  styles: Record<string, string>
) {
  if (!iframe) {
    console.error('Iframe reference is null or undefined');
    return;
  }

  if (!iframe.contentWindow) {
    console.error('Cannot access iframe contentWindow');
    return;
  }

  if (!elementId) {
    console.error('Element ID is required');
    return;
  }

  console.log(
    `Sending UPDATE_ELEMENT_STYLE message for element ${elementId}:`,
    styles
  );

  // Define allowed origins
  const targetOrigin = '*'; // Consider restricting to specific origins in production

  try {
    // Check if the content window is accessible and the iframe is loaded
    if (iframe.contentDocument?.readyState !== 'complete') {
      console.warn(
        'Iframe may not be fully loaded yet, but attempting to send message'
      );
    }

    iframe.contentWindow.postMessage(
      {
        type: 'UPDATE_ELEMENT_STYLE',
        payload: {
          elementId,
          styles,
        },
      },
      targetOrigin
    );

    console.log('Style update message sent successfully');
  } catch (error) {
    console.error('Error sending style update message:', error);
    throw error;
  }
}

// Function to update element content
export function updateElementContent(
  iframe: HTMLIFrameElement,
  elementId: string,
  content: string
) {
  if (!iframe) {
    console.error('Iframe reference is null or undefined');
    return;
  }

  if (!iframe.contentWindow) {
    console.error('Cannot access iframe contentWindow');
    return;
  }

  if (!elementId) {
    console.error('Element ID is required');
    return;
  }

  console.log(
    `Sending UPDATE_ELEMENT_CONTENT message for element ${elementId}`
  );

  // Define allowed origins
  const targetOrigin = '*'; // Consider restricting to specific origins in production

  try {
    // Check if the content window is accessible and the iframe is loaded
    if (iframe.contentDocument?.readyState !== 'complete') {
      console.warn(
        'Iframe may not be fully loaded yet, but attempting to send message'
      );
    }

    iframe.contentWindow.postMessage(
      {
        type: 'UPDATE_ELEMENT_CONTENT',
        payload: {
          elementId,
          content,
        },
      },
      targetOrigin
    );

    console.log('Content update message sent successfully');
  } catch (error) {
    console.error('Error sending content update message:', error);
    throw error;
  }
}
